import { CaseStatus } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { type AuthedRequest, requireRole } from "../auth/roles.js";
import {
  closeDoctorCase,
  getDoctorCaseMessages,
  getDoctorProfile,
  listDoctorCases,
  sendDoctorPortalMessage
} from "../domain/portals/doctorPortalService.js";

const doctorCaseStatusSchema = z.nativeEnum(CaseStatus).optional();
const sendMessageBodySchema = z.object({
  text: z.string().min(1)
});
const closeCaseBodySchema = z.object({
  summary: z.string().optional()
});

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message.toLowerCase().includes("not found") ? 404 : 400;
  res.status(status).json({ error: message });
}

export const doctorPortalRouter = Router();
doctorPortalRouter.use(requireRole("DOCTOR"));

doctorPortalRouter.get("/me", async (req: AuthedRequest, res: Response) => {
  try {
    const doctor = await getDoctorProfile(req.auth!.userId);
    res.status(200).json(doctor);
  } catch (error) {
    handleError(res, error);
  }
});

doctorPortalRouter.get("/cases", async (req: AuthedRequest, res: Response) => {
  try {
    const status = doctorCaseStatusSchema.safeParse(req.query.status);
    if (!status.success) {
      res.status(400).json({ error: "Invalid case status filter" });
      return;
    }

    const cases = await listDoctorCases({
      doctorId: req.auth!.userId,
      status: status.data
    });

    res.status(200).json(cases);
  } catch (error) {
    handleError(res, error);
  }
});

doctorPortalRouter.get("/cases/:caseId/messages", async (req: AuthedRequest, res: Response) => {
  try {
    const messages = await getDoctorCaseMessages({
      doctorId: req.auth!.userId,
      caseId: req.params.caseId
    });
    res.status(200).json(messages);
  } catch (error) {
    handleError(res, error);
  }
});

doctorPortalRouter.post("/cases/:caseId/messages", async (req: AuthedRequest, res: Response) => {
  try {
    const body = sendMessageBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const result = await sendDoctorPortalMessage({
      doctorId: req.auth!.userId,
      caseId: req.params.caseId,
      text: body.data.text
    });

    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

doctorPortalRouter.post("/cases/:caseId/close", async (req: AuthedRequest, res: Response) => {
  try {
    const body = closeCaseBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error.flatten().fieldErrors });
      return;
    }

    const result = await closeDoctorCase({
      doctorId: req.auth!.userId,
      caseId: req.params.caseId,
      summary: body.data.summary
    });

    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});
