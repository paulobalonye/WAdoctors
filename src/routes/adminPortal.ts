import { DoctorKycStatus, type CaseStatus } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { type AuthedRequest, requireRole } from "../auth/roles.js";
import {
  assignAdminCaseDoctor,
  createAdminDoctor,
  createAdminUser,
  clearAdminFailedRelayJobs,
  getAdminIntegrationStatus,
  getRelayQueueHealth,
  getWebhookSummary,
  getAdminOverview,
  getAdminCase,
  getAdminCaseMessages,
  listAdminCases,
  listAdminDoctors,
  listRecentWebhookEvents,
  retryAdminRelayFailedJob,
  retryAdminRecentFailedRelayJobs,
  retryAdminRecentWhatsAppFailedRelayJobs,
  retryAdminRecentWebexFailedRelayJobs,
  resetDoctorPortalPassword,
  setDoctorSchedule,
  setAdminCaseStatus,
  setDoctorActive,
  setDoctorKycStatus
} from "../domain/portals/adminPortalService.js";

const caseStatusSchema = z.nativeEnum({
  NEW: "NEW",
  TRIAGING: "TRIAGING",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ESCALATED: "ESCALATED"
} as const).optional();

const doctorActiveBodySchema = z.object({
  isActive: z.boolean()
});

const doctorKycBodySchema = z.object({
  kycStatus: z.nativeEnum(DoctorKycStatus)
});

const createDoctorBodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8),
  npiNumber: z.string().min(5),
  licenseState: z.string().length(2).optional(),
  specialty: z.string().optional(),
  webexPersonId: z.string().optional(),
  isActive: z.boolean().optional(),
  kycStatus: z.nativeEnum(DoctorKycStatus).optional(),
  availability: z.unknown().optional(),
  maxConcurrentCases: z.number().int().min(1).max(20).optional()
});

const createAdminUserBodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8)
});

const resetDoctorPasswordBodySchema = z.object({
  password: z.string().min(8)
});

const doctorScheduleBodySchema = z.object({
  availability: z.unknown(),
  maxConcurrentCases: z.number().int().min(1).max(20).optional()
});

const caseStatusBodySchema = z.object({
  status: z.nativeEnum({
    NEW: "NEW",
    TRIAGING: "TRIAGING",
    ASSIGNED: "ASSIGNED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    ESCALATED: "ESCALATED"
  } as const)
});

const caseAssignBodySchema = z.object({
  doctorId: z.string().nullable()
});

const retryRecentRelayBodySchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  caseId: z.string().min(1).max(128).optional()
});

const clearFailedRelayBodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  graceSeconds: z.number().int().min(0).max(7 * 24 * 60 * 60).optional()
});

function parseLimit(value: unknown, fallback = 50): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 200);
}

function parseWindowHours(value: unknown, fallback = 24): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 24 * 7);
}

function parseFailedLimit(value: unknown, fallback = 20): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 50);
}

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message.toLowerCase().includes("not found") ? 404 : 400;
  res.status(status).json({ error: message });
}

export const adminPortalRouter = Router();
adminPortalRouter.use(requireRole("ADMIN"));

adminPortalRouter.get("/overview", async (_req: AuthedRequest, res: Response) => {
  try {
    const data = await getAdminOverview();
    res.status(200).json(data);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.get("/integrations/status", (_req: AuthedRequest, res: Response) => {
  try {
    const status = getAdminIntegrationStatus();
    res.status(200).json(status);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.get("/cases", async (req: AuthedRequest, res: Response) => {
  try {
    const parsedStatus = caseStatusSchema.safeParse(req.query.status);
    if (!parsedStatus.success) {
      res.status(400).json({ error: "Invalid case status filter" });
      return;
    }

    const data = await listAdminCases({
      status: parsedStatus.data as CaseStatus | undefined,
      limit: parseLimit(req.query.limit, 100)
    });

    res.status(200).json(data);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.get("/cases/:caseId", async (req: AuthedRequest, res: Response) => {
  try {
    const triageCase = await getAdminCase(req.params.caseId);
    if (!triageCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    res.status(200).json(triageCase);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.get("/cases/:caseId/messages", async (req: AuthedRequest, res: Response) => {
  try {
    const messages = await getAdminCaseMessages(req.params.caseId);
    res.status(200).json(messages);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.patch("/cases/:caseId/status", async (req: AuthedRequest, res: Response) => {
  try {
    const body = caseStatusBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const updated = await setAdminCaseStatus({
      caseId: req.params.caseId,
      status: body.data.status as CaseStatus,
      actorId: req.auth!.userId
    });

    res.status(200).json(updated);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.patch("/cases/:caseId/assign", async (req: AuthedRequest, res: Response) => {
  try {
    const body = caseAssignBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const updated = await assignAdminCaseDoctor({
      caseId: req.params.caseId,
      doctorId: body.data.doctorId,
      actorId: req.auth!.userId
    });

    res.status(200).json(updated);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.get("/doctors", async (_req: AuthedRequest, res: Response) => {
  try {
    const doctors = await listAdminDoctors();
    res.status(200).json(doctors);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.post("/doctors", async (req: AuthedRequest, res: Response) => {
  try {
    const body = createDoctorBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const doctor = await createAdminDoctor(body.data);
    res.status(201).json(doctor);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.patch("/doctors/:doctorId/password", async (req: AuthedRequest, res: Response) => {
  try {
    const body = resetDoctorPasswordBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const doctor = await resetDoctorPortalPassword({
      doctorId: req.params.doctorId,
      password: body.data.password
    });

    res.status(200).json({
      id: doctor.id,
      email: doctor.email,
      passwordReset: true
    });
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.patch("/doctors/:doctorId/schedule", async (req: AuthedRequest, res: Response) => {
  try {
    const body = doctorScheduleBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const doctor = await setDoctorSchedule({
      doctorId: req.params.doctorId,
      availability: body.data.availability,
      maxConcurrentCases: body.data.maxConcurrentCases
    });

    res.status(200).json(doctor);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.post("/admin-users", async (req: AuthedRequest, res: Response) => {
  try {
    const body = createAdminUserBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const adminUser = await createAdminUser(body.data);
    res.status(201).json({
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      isActive: adminUser.isActive
    });
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.patch("/doctors/:doctorId/active", async (req: AuthedRequest, res: Response) => {
  try {
    const body = doctorActiveBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const doctor = await setDoctorActive({
      doctorId: req.params.doctorId,
      isActive: body.data.isActive
    });

    res.status(200).json(doctor);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.patch("/doctors/:doctorId/kyc", async (req: AuthedRequest, res: Response) => {
  try {
    const body = doctorKycBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const doctor = await setDoctorKycStatus({
      doctorId: req.params.doctorId,
      kycStatus: body.data.kycStatus
    });

    res.status(200).json(doctor);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.get("/webhooks", async (req: AuthedRequest, res: Response) => {
  try {
    const events = await listRecentWebhookEvents(parseLimit(req.query.limit, 50));
    res.status(200).json(events);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.get("/webhooks/summary", async (req: AuthedRequest, res: Response) => {
  try {
    const summary = await getWebhookSummary(parseWindowHours(req.query.windowHours, 24));
    res.status(200).json(summary);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.get("/relay/health", async (req: AuthedRequest, res: Response) => {
  try {
    const health = await getRelayQueueHealth(parseFailedLimit(req.query.failedLimit, 20));
    res.status(200).json(health);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.post("/relay/failed/:jobId/retry", async (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId?.trim();
    if (!jobId) {
      res.status(400).json({ error: "jobId is required" });
      return;
    }

    const result = await retryAdminRelayFailedJob(jobId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.post("/relay/failed/retry", async (req: AuthedRequest, res: Response) => {
  try {
    const body = retryRecentRelayBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const result = await retryAdminRecentFailedRelayJobs(body.data.limit ?? 10);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.post("/relay/failed/retry-webex", async (req: AuthedRequest, res: Response) => {
  try {
    const body = retryRecentRelayBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const result = await retryAdminRecentWebexFailedRelayJobs({
      limit: body.data.limit ?? 10,
      caseId: body.data.caseId
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.post("/relay/failed/retry-whatsapp", async (req: AuthedRequest, res: Response) => {
  try {
    const body = retryRecentRelayBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const result = await retryAdminRecentWhatsAppFailedRelayJobs({
      limit: body.data.limit ?? 10,
      caseId: body.data.caseId
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

adminPortalRouter.post("/relay/failed/clear", async (req: AuthedRequest, res: Response) => {
  try {
    const body = clearFailedRelayBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const result = await clearAdminFailedRelayJobs({
      limit: body.data.limit ?? 100,
      graceSeconds: body.data.graceSeconds ?? 300
    });

    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});
