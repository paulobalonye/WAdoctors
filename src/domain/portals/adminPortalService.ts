import { DoctorKycStatus, Prisma, type CaseStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { getRelayQueue } from "../../queues/relayQueue.js";
import { hashPortalPassword } from "../auth/authService.js";
import { defaultDoctorAvailability } from "../cases/doctorAvailability.js";
import { buildWhatsAppWorkflowPreviewWithAI } from "../consultations/whatsappWorkflow.js";
import { dispatchDoctorToWhatsApp, dispatchPatientToWebex } from "../messages/relayDispatcher.js";
import { buildCaseTriageView } from "./caseTriageView.js";
import {
  triageAIEnabled,
  triageAIMinConfidence,
  triageAIPromptVersion,
  triageAIProvider
} from "../triage/runtime.js";
import { buildRelayQueueDisabledSummary, buildRelayQueueHealthSummary } from "./relayHealth.js";
import { buildIntegrationStatus } from "./integrationStatus.js";
import {
  clearFailedRelayJobs,
  listFailedRelayJobs,
  retryRecentFailedRelayJobsByName,
  retryRecentFailedRelayJobs,
  retrySingleFailedRelayJob,
  type RelayQueueAdapter
} from "./relayOperations.js";
import { buildTriageInsightsSummary } from "./triageInsights.js";
import { buildWebhookSummary } from "./webhookSummary.js";

const ACTIVE_CASE_STATUSES: CaseStatus[] = ["NEW", "TRIAGING", "ASSIGNED", "IN_PROGRESS", "ESCALATED"];
type RelayQueueInstance = NonNullable<ReturnType<typeof getRelayQueue>>;

function getRelayAlertThresholds() {
  return {
    pendingWarning: env.RELAY_ALERT_PENDING_WARNING,
    pendingCritical: env.RELAY_ALERT_PENDING_CRITICAL,
    failedWarning: env.RELAY_ALERT_FAILED_WARNING,
    failedCritical: env.RELAY_ALERT_FAILED_CRITICAL,
    oldestFailedMinutesWarning: env.RELAY_ALERT_OLDEST_FAILED_MINUTES_WARNING,
    oldestFailedMinutesCritical: env.RELAY_ALERT_OLDEST_FAILED_MINUTES_CRITICAL
  };
}

function getRelayQueueAccess():
  | {
      queue: RelayQueueInstance;
    }
  | {
      reason: string;
    } {
  if (env.RELAY_DISPATCH_MODE !== "queue") {
    return { reason: "Relay queue disabled because dispatch mode is inline" };
  }

  if (!env.REDIS_URL) {
    return { reason: "Relay queue unavailable because REDIS_URL is not configured" };
  }

  const queue = getRelayQueue();
  if (!queue) {
    return { reason: "Relay queue unavailable" };
  }

  return { queue };
}

function buildRelayQueueAdapter(queue: RelayQueueInstance): RelayQueueAdapter {
  return {
    getJobById: async (jobId) => {
      const job = await queue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        id: job.id != null ? String(job.id) : null,
        name: job.name,
        caseId:
          job.data && typeof job.data === "object" && "caseId" in job.data
            ? String((job.data as { caseId?: unknown }).caseId ?? "")
            : null,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        finishedOn: job.finishedOn,
        timestamp: job.timestamp,
        getState: async () => job.getState(),
        retry: async () => {
          await job.retry();
        }
      };
    },
    getFailedJobs: async (limit) => {
      const safeLimit = Math.min(Math.max(limit, 1), 50);
      const jobs = await queue.getJobs(["failed"], 0, safeLimit - 1, false);
      return jobs.map((job) => ({
        id: job.id != null ? String(job.id) : null,
        name: job.name,
        caseId:
          job.data && typeof job.data === "object" && "caseId" in job.data
            ? String((job.data as { caseId?: unknown }).caseId ?? "")
            : null,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        finishedOn: job.finishedOn,
        timestamp: job.timestamp,
        getState: async () => job.getState(),
        retry: async () => {
          await job.retry();
        }
      }));
    },
    cleanFailed: async (graceMs, limit) => queue.clean(graceMs, limit, "failed")
  };
}

export async function getAdminOverview() {
  const [patients, doctors, activeDoctors, totalCases, openCases, completedCases] = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.triageCase.count(),
    prisma.triageCase.count({
      where: {
        status: {
          in: ACTIVE_CASE_STATUSES
        }
      }
    }),
    prisma.triageCase.count({
      where: {
        status: "COMPLETED"
      }
    })
  ]);

  const casesByStatusRaw = await prisma.triageCase.groupBy({
    by: ["status"],
    _count: {
      _all: true
    }
  });

  const casesByStatus = Object.fromEntries(casesByStatusRaw.map((item) => [item.status, item._count._all]));

  return {
    patients,
    doctors,
    activeDoctors,
    totalCases,
    openCases,
    completedCases,
    casesByStatus
  };
}

export function getAdminIntegrationStatus() {
  const aiEnabled = env.AI_TRIAGE_ENABLED === "true" || Boolean(env.OPENAI_API_KEY?.trim());

  return buildIntegrationStatus({
    relayDispatchMode: env.RELAY_DISPATCH_MODE,
    redisUrl: env.REDIS_URL,
    aiTriage: {
      enabled: aiEnabled,
      provider: "openai",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_TRIAGE_MODEL,
      promptVersion: triageAIPromptVersion,
      minConfidence: triageAIMinConfidence
    },
    whatsapp: {
      webhookSecret: env.WHATSAPP_WEBHOOK_SECRET,
      verifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
    },
    webex: {
      webhookSecret: env.WEBEX_WEBHOOK_SECRET,
      botAccessToken: env.WEBEX_BOT_ACCESS_TOKEN,
      botPersonId: env.WEBEX_BOT_PERSON_ID,
      defaultRoomId: env.WEBEX_DEFAULT_ROOM_ID
    },
    stripe: {
      webhookSecret: env.STRIPE_WEBHOOK_SECRET
    }
  });
}

export async function listAdminCases(params: {
  status?: CaseStatus;
  limit: number;
  triageSource?: "AI" | "HEURISTIC";
  triageRoute?: "ROUTE_TO_DOCTOR" | "SEND_SELF_CARE" | "ESCALATE_EMERGENCY" | "OUT_OF_STATE";
}) {
  const safeLimit = Math.min(Math.max(params.limit, 1), 200);
  const fetchLimit = Math.min(Math.max(safeLimit * 5, safeLimit), 500);

  const cases = await prisma.triageCase.findMany({
    where: {
      ...(params.status ? { status: params.status } : {})
    },
    include: {
      patient: {
        select: {
          id: true,
          whatsappPhone: true,
          fullName: true
        }
      },
      assignedDoctor: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: fetchLimit
  });

  const mapped = cases.map((item) => ({
    ...item,
    triage: buildCaseTriageView({
      aiSummary: item.aiSummary,
      aiTranscript: item.aiTranscript
    })
  }));

  const filtered = mapped.filter((item) => {
    if (params.triageSource && item.triage?.source !== params.triageSource) {
      return false;
    }

    if (params.triageRoute && item.triage?.route !== params.triageRoute) {
      return false;
    }

    return true;
  });

  return filtered.slice(0, safeLimit);
}

export async function getAdminCase(caseId: string) {
  const triageCase = await prisma.triageCase.findUnique({
    where: { id: caseId },
    include: {
      patient: true,
      assignedDoctor: true
    }
  });

  if (!triageCase) {
    return null;
  }

  return {
    ...triageCase,
    triage: buildCaseTriageView({
      aiSummary: triageCase.aiSummary,
      aiTranscript: triageCase.aiTranscript
    })
  };
}

export async function getAdminCaseMessages(caseId: string) {
  return prisma.message.findMany({
    where: { caseId },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function setAdminCaseStatus(params: {
  caseId: string;
  status: CaseStatus;
  actorId: string;
}) {
  const existing = await prisma.triageCase.findUnique({
    where: { id: params.caseId }
  });

  if (!existing) {
    throw new Error("Case not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const triageCase = await tx.triageCase.update({
      where: { id: params.caseId },
      data: {
        status: params.status
      }
    });

    await tx.auditLog.create({
      data: {
        tableName: "triage_cases",
        recordId: params.caseId,
        action: "UPDATE",
        actorId: params.actorId,
        actorType: "ADMIN",
        oldValues: { status: existing.status },
        newValues: { status: params.status, reason: "Updated by admin portal" }
      }
    });

    return triageCase;
  });

  return updated;
}

export async function assignAdminCaseDoctor(params: {
  caseId: string;
  doctorId: string | null;
  actorId: string;
}) {
  const existing = await prisma.triageCase.findUnique({
    where: { id: params.caseId }
  });

  if (!existing) {
    throw new Error("Case not found");
  }

  if (params.doctorId) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: params.doctorId }
    });
    if (!doctor) {
      throw new Error("Doctor not found");
    }
  }

  return prisma.$transaction(async (tx) => {
    const triageCase = await tx.triageCase.update({
      where: { id: params.caseId },
      data: {
        assignedDoctorId: params.doctorId
      }
    });

    await tx.auditLog.create({
      data: {
        tableName: "triage_cases",
        recordId: params.caseId,
        action: "UPDATE",
        actorId: params.actorId,
        actorType: "ADMIN",
        oldValues: { assignedDoctorId: existing.assignedDoctorId ?? null },
        newValues: {
          assignedDoctorId: params.doctorId,
          reason: "Updated assignment by admin portal"
        }
      }
    });

    return triageCase;
  });
}

export async function listAdminDoctors() {
  const doctors = await prisma.doctor.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  const caseLoad = await prisma.triageCase.groupBy({
    by: ["assignedDoctorId"],
    where: {
      status: {
        in: ACTIVE_CASE_STATUSES
      }
    },
    _count: {
      _all: true
    }
  });

  const caseLoadMap = new Map(
    caseLoad.filter((item) => item.assignedDoctorId).map((item) => [item.assignedDoctorId as string, item._count._all])
  );

  return doctors.map((doctor) => ({
    ...doctor,
    activeCaseLoad: caseLoadMap.get(doctor.id) ?? 0
  }));
}

export async function createAdminDoctor(params: {
  email: string;
  fullName: string;
  password: string;
  npiNumber: string;
  licenseState?: string;
  specialty?: string;
  webexPersonId?: string;
  isActive?: boolean;
  kycStatus?: DoctorKycStatus;
  availability?: unknown;
  maxConcurrentCases?: number;
}) {
  const passwordHash = await hashPortalPassword(params.password);
  const availability = (params.availability ?? defaultDoctorAvailability()) as Prisma.InputJsonValue;

  return prisma.doctor.create({
    data: {
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName,
      passwordHash,
      npiNumber: params.npiNumber,
      licenseState: params.licenseState,
      specialty: params.specialty,
      webexPersonId: params.webexPersonId,
      availability,
      maxConcurrentCases: params.maxConcurrentCases ?? 3,
      isActive: params.isActive ?? false,
      kycStatus: params.kycStatus ?? DoctorKycStatus.PENDING
    }
  });
}

export async function createAdminUser(params: {
  email: string;
  fullName: string;
  password: string;
}) {
  const passwordHash = await hashPortalPassword(params.password);

  return prisma.adminUser.create({
    data: {
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName,
      passwordHash
    }
  });
}

export async function resetDoctorPortalPassword(params: { doctorId: string; password: string }) {
  const passwordHash = await hashPortalPassword(params.password);

  return prisma.doctor.update({
    where: { id: params.doctorId },
    data: {
      passwordHash
    }
  });
}

export async function setDoctorSchedule(params: {
  doctorId: string;
  availability: unknown;
  maxConcurrentCases?: number;
}) {
  const availability = params.availability as Prisma.InputJsonValue;

  return prisma.doctor.update({
    where: { id: params.doctorId },
    data: {
      availability,
      ...(typeof params.maxConcurrentCases === "number"
        ? { maxConcurrentCases: params.maxConcurrentCases }
        : {})
    }
  });
}

export async function setDoctorActive(params: { doctorId: string; isActive: boolean }) {
  return prisma.doctor.update({
    where: { id: params.doctorId },
    data: {
      isActive: params.isActive
    }
  });
}

export async function setDoctorKycStatus(params: {
  doctorId: string;
  kycStatus: DoctorKycStatus;
}) {
  return prisma.doctor.update({
    where: { id: params.doctorId },
    data: {
      kycStatus: params.kycStatus
    }
  });
}

export async function listRecentWebhookEvents(limit: number) {
  return prisma.webhookEvent.findMany({
    orderBy: {
      receivedAt: "desc"
    },
    take: limit
  });
}

export async function getWebhookSummary(windowHours: number) {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [totalEvents, eventsLastWindow, overallByProviderRaw, windowByProviderRaw] = await Promise.all([
    prisma.webhookEvent.count(),
    prisma.webhookEvent.count({
      where: {
        receivedAt: {
          gte: cutoff
        }
      }
    }),
    prisma.webhookEvent.groupBy({
      by: ["provider"],
      _count: {
        _all: true
      },
      _max: {
        receivedAt: true
      }
    }),
    prisma.webhookEvent.groupBy({
      by: ["provider"],
      where: {
        receivedAt: {
          gte: cutoff
        }
      },
      _count: {
        _all: true
      }
    })
  ]);

  return buildWebhookSummary({
    windowHours,
    totalEvents,
    eventsLastWindow,
    overallByProvider: overallByProviderRaw.map((item) => ({
      provider: item.provider,
      count: item._count._all,
      lastReceivedAt: item._max.receivedAt
    })),
    windowByProvider: windowByProviderRaw.map((item) => ({
      provider: item.provider,
      count: item._count._all
    }))
  });
}

export async function getRelayQueueHealth(failedLimit: number) {
  const thresholds = getRelayAlertThresholds();
  const access = getRelayQueueAccess();
  if ("reason" in access) {
    return buildRelayQueueDisabledSummary(access.reason, thresholds);
  }

  try {
    const counts = await access.queue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "paused",
      "failed",
      "completed"
    );

    const safeLimit = Math.min(Math.max(failedLimit, 1), 50);
    const failedJobs = await access.queue.getJobs(["failed"], 0, safeLimit - 1, false);

    return buildRelayQueueHealthSummary({
      dispatchMode: env.RELAY_DISPATCH_MODE,
      redisConfigured: true,
      queueReachable: true,
      counts: {
        waiting: counts.waiting,
        active: counts.active,
        delayed: counts.delayed,
        paused: counts.paused,
        failed: counts.failed,
        completed: counts.completed
      },
      failedJobs: failedJobs.map((job) => ({
        id: job.id != null ? String(job.id) : null,
        name: job.name,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        finishedOn: job.finishedOn,
        timestamp: job.timestamp
      })),
      thresholds
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unable to inspect relay queue";
    return buildRelayQueueHealthSummary({
      dispatchMode: env.RELAY_DISPATCH_MODE,
      redisConfigured: true,
      queueReachable: false,
      reason,
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        paused: 0,
        failed: 0,
        completed: 0
      },
      failedJobs: [],
      thresholds
    });
  }
}

export async function getAdminTriageSummary(params: {
  windowHours: number;
  limit: number;
}) {
  const safeWindowHours = Math.min(Math.max(params.windowHours, 1), 24 * 7);
  const safeLimit = Math.min(Math.max(params.limit, 1), 200);
  const windowStart = new Date(Date.now() - safeWindowHours * 60 * 60 * 1000);

  const cases = await prisma.triageCase.findMany({
    where: {
      createdAt: {
        gte: windowStart
      }
    },
    select: {
      aiSummary: true,
      aiTranscript: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: safeLimit
  });

  return buildTriageInsightsSummary({
    windowHours: safeWindowHours,
    limit: safeLimit,
    cases: cases.map((item) => ({
      triage: buildCaseTriageView({
        aiSummary: item.aiSummary,
        aiTranscript: item.aiTranscript
      })
    }))
  });
}

export async function evaluateAdminTriage(params: {
  messageText: string;
  patientState?: string;
}) {
  const workflow = await buildWhatsAppWorkflowPreviewWithAI({
    messageText: params.messageText,
    patientState: (params.patientState || env.LAUNCH_STATE).trim().toUpperCase(),
    aiEnabled: triageAIEnabled,
    provider: triageAIProvider,
    minAIConfidence: triageAIMinConfidence
  });

  return {
    launchState: env.LAUNCH_STATE,
    evaluatedState: (params.patientState || env.LAUNCH_STATE).trim().toUpperCase(),
    aiEnabled: triageAIEnabled,
    aiConfig: {
      model: env.OPENAI_TRIAGE_MODEL,
      promptVersion: triageAIPromptVersion,
      minConfidence: triageAIMinConfidence
    },
    triage: {
      source: workflow.triageSource,
      urgencyScore: workflow.urgencyScore,
      baselineUrgency: workflow.baselineUrgency,
      route: workflow.route,
      confidence: workflow.triageConfidence,
      redFlags: workflow.triageRedFlags,
      summary: workflow.triageSummary,
      fallbackReason: workflow.triageFallbackReason ?? null,
      safetyOverride: workflow.triageSafetyOverride,
      safetySignal: workflow.triageSafetySignal ?? ""
    },
    finalStatus: workflow.finalStatus,
    transitions: workflow.transitions
  };
}

export async function retryAdminRelayFailedJob(jobId: string) {
  const access = getRelayQueueAccess();
  if ("reason" in access) {
    return {
      ok: false,
      jobId: jobId.trim(),
      retried: false,
      reason: access.reason
    };
  }

  const adapter = buildRelayQueueAdapter(access.queue);
  return retrySingleFailedRelayJob(adapter, jobId);
}

export async function retryAdminRecentFailedRelayJobs(limit: number) {
  const access = getRelayQueueAccess();
  if ("reason" in access) {
    return {
      ok: false,
      requestedLimit: Math.min(Math.max(limit, 1), 50),
      examined: 0,
      retried: 0,
      failed: 0,
      failures: [] as Array<{ jobId: string; reason: string }>,
      reason: access.reason
    };
  }

  const adapter = buildRelayQueueAdapter(access.queue);
  const result = await retryRecentFailedRelayJobs(adapter, limit);
  return {
    ...result,
    reason: result.ok ? undefined : result.failures[0]?.reason
  };
}

export async function retryAdminRecentWebexFailedRelayJobs(params: {
  limit: number;
  caseId?: string;
}) {
  const access = getRelayQueueAccess();
  if ("reason" in access) {
    return {
      ok: false,
      requestedLimit: Math.min(Math.max(params.limit, 1), 50),
      examined: 0,
      matched: 0,
      retried: 0,
      failed: 0,
      failures: [] as Array<{ jobId: string; reason: string }>,
      reason: access.reason
    };
  }

  const adapter = buildRelayQueueAdapter(access.queue);
  const result = await retryRecentFailedRelayJobsByName(adapter, {
    limit: params.limit,
    name: "PATIENT_TO_WEBEX",
    caseId: params.caseId
  });

  return {
    ...result,
    reason: result.ok ? undefined : result.failures[0]?.reason
  };
}

export async function retryAdminRecentWhatsAppFailedRelayJobs(params: {
  limit: number;
  caseId?: string;
}) {
  const access = getRelayQueueAccess();
  if ("reason" in access) {
    return {
      ok: false,
      requestedLimit: Math.min(Math.max(params.limit, 1), 50),
      examined: 0,
      matched: 0,
      retried: 0,
      failed: 0,
      failures: [] as Array<{ jobId: string; reason: string }>,
      reason: access.reason
    };
  }

  const adapter = buildRelayQueueAdapter(access.queue);
  const result = await retryRecentFailedRelayJobsByName(adapter, {
    limit: params.limit,
    name: "DOCTOR_TO_WHATSAPP",
    caseId: params.caseId
  });

  return {
    ...result,
    reason: result.ok ? undefined : result.failures[0]?.reason
  };
}

export async function clearAdminFailedRelayJobs(params: { limit: number; graceSeconds: number }) {
  const access = getRelayQueueAccess();
  if ("reason" in access) {
    return {
      ok: false,
      limit: Math.min(Math.max(params.limit, 1), 200),
      graceSeconds: Math.min(Math.max(params.graceSeconds, 0), 7 * 24 * 60 * 60),
      removedCount: 0,
      removedJobIds: [] as string[],
      reason: access.reason
    };
  }

  try {
    const adapter = buildRelayQueueAdapter(access.queue);
    return await clearFailedRelayJobs(adapter, params);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Failed to clear failed relay jobs";
    return {
      ok: false,
      limit: Math.min(Math.max(params.limit, 1), 200),
      graceSeconds: Math.min(Math.max(params.graceSeconds, 0), 7 * 24 * 60 * 60),
      removedCount: 0,
      removedJobIds: [] as string[],
      reason
    };
  }
}

export async function injectAdminRelayFailure(params: {
  direction: "PATIENT_TO_WEBEX" | "DOCTOR_TO_WHATSAPP";
  caseId?: string;
}) {
  const access = getRelayQueueAccess();
  if ("reason" in access) {
    return {
      ok: false,
      direction: params.direction,
      caseId: params.caseId?.trim() || "",
      reason: access.reason
    };
  }

  const caseId = params.caseId?.trim() || `missing-case-${Date.now()}`;
  const payload =
    params.direction === "PATIENT_TO_WEBEX"
      ? {
          type: "PATIENT_TO_WEBEX" as const,
          caseId,
          patientPhone: "+15550000000",
          text: "[dev] injected relay failure"
        }
      : {
          type: "DOCTOR_TO_WHATSAPP" as const,
          caseId,
          doctorText: "[dev] injected relay failure"
        };

  const job = await access.queue.add(payload.type, payload, {
    attempts: 1,
    backoff: {
      type: "fixed",
      delay: 0
    },
    removeOnComplete: false,
    removeOnFail: false
  });

  return {
    ok: true,
    direction: payload.type,
    caseId,
    jobId: job.id != null ? String(job.id) : "unknown",
    reason: "Injected relay failure job queued"
  };
}

export async function listAdminFailedRelayJobs(params: {
  limit: number;
  name?: "PATIENT_TO_WEBEX" | "DOCTOR_TO_WHATSAPP";
  caseId?: string;
}) {
  const access = getRelayQueueAccess();
  if ("reason" in access) {
    return {
      ok: false,
      requestedLimit: Math.min(Math.max(params.limit, 1), 200),
      totalFetched: 0,
      totalMatched: 0,
      jobs: [] as Array<{
        jobId: string;
        name: string;
        caseId: string;
        failedReason: string;
        attemptsMade: number;
        failedAt: string | null;
      }>,
      reason: access.reason
    };
  }

  const adapter = buildRelayQueueAdapter(access.queue);
  const result = await listFailedRelayJobs(adapter, params);
  return {
    ok: true,
    ...result
  };
}

export async function replayAdminCaseRelay(params: {
  caseId: string;
  direction: "PATIENT_TO_WEBEX" | "DOCTOR_TO_WHATSAPP";
  actorId: string;
  messageId?: string;
}) {
  const caseId = params.caseId.trim();
  const sourceMessageId = params.messageId?.trim();

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: caseId },
    include: {
      patient: {
        select: {
          whatsappPhone: true
        }
      }
    }
  });

  if (!triageCase) {
    throw new Error("Case not found");
  }

  if (params.direction === "PATIENT_TO_WEBEX") {
    const sourceMessage = await prisma.message.findFirst({
      where: {
        caseId,
        senderType: "PATIENT",
        platform: "WHATSAPP",
        ...(sourceMessageId ? { id: sourceMessageId } : {})
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const text = String(sourceMessage?.content || "").trim();
    if (!sourceMessage || !text) {
      throw new Error("No patient WhatsApp message found for replay");
    }

    const dispatch = await dispatchPatientToWebex({
      caseId,
      patientPhone: triageCase.patient.whatsappPhone,
      text,
      relayKey: sourceMessage.id
    });

    await prisma.auditLog.create({
      data: {
        tableName: "triage_cases",
        recordId: caseId,
        action: "UPDATE",
        actorId: params.actorId,
        actorType: "ADMIN",
        oldValues: Prisma.JsonNull,
        newValues: {
          action: "REPLAY_RELAY",
          direction: params.direction,
          sourceMessageId: sourceMessage.id,
          dispatched: dispatch.dispatched,
          mode: dispatch.mode,
          duplicate: dispatch.duplicate ?? false,
          reason: dispatch.reason ?? null
        }
      }
    });

    return {
      caseId,
      direction: params.direction,
      sourceMessageId: sourceMessage.id,
      dispatched: dispatch.dispatched,
      mode: dispatch.mode,
      jobId: dispatch.jobId,
      duplicate: dispatch.duplicate ?? false,
      reason: dispatch.reason
    };
  }

  const sourceMessage = await prisma.message.findFirst({
    where: {
      caseId,
      senderType: {
        in: ["DOCTOR", "SYSTEM"]
      },
      platform: "WEBEX",
      ...(sourceMessageId ? { id: sourceMessageId } : {})
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const baseText = String(sourceMessage?.content || "").trim();
  if (!sourceMessage || !baseText) {
    throw new Error("No doctor Webex message found for replay");
  }

  const doctorText = /^doctor:\s+/i.test(baseText) ? baseText : `Doctor: ${baseText}`;
  const dispatch = await dispatchDoctorToWhatsApp({
    caseId,
    doctorText,
    relayKey: sourceMessage.id
  });

  await prisma.auditLog.create({
    data: {
      tableName: "triage_cases",
      recordId: caseId,
      action: "UPDATE",
      actorId: params.actorId,
      actorType: "ADMIN",
      oldValues: Prisma.JsonNull,
      newValues: {
        action: "REPLAY_RELAY",
        direction: params.direction,
        sourceMessageId: sourceMessage.id,
        dispatched: dispatch.dispatched,
        mode: dispatch.mode,
        duplicate: dispatch.duplicate ?? false,
        reason: dispatch.reason ?? null
      }
    }
  });

  return {
    caseId,
    direction: params.direction,
    sourceMessageId: sourceMessage.id,
    dispatched: dispatch.dispatched,
    mode: dispatch.mode,
    jobId: dispatch.jobId,
    duplicate: dispatch.duplicate ?? false,
    reason: dispatch.reason
  };
}
