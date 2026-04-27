import { CaseStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { assertCaseStatusTransition } from "./stateMachine.js";

const ACTIVE_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.NEW,
  CaseStatus.TRIAGING,
  CaseStatus.ASSIGNED,
  CaseStatus.IN_PROGRESS,
  CaseStatus.ESCALATED
];

export async function ensurePatientByPhone(phone: string) {
  const existing = await prisma.patient.findUnique({
    where: {
      whatsappPhone: phone
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.patient.create({
    data: {
      whatsappPhone: phone,
      fullName: `Patient ${phone}`
    }
  });
}

export async function getActiveCaseForPatient(patientId: string) {
  return prisma.triageCase.findFirst({
    where: {
      patientId,
      status: {
        in: ACTIVE_CASE_STATUSES
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function createNewCase(params: {
  patientId: string;
  chiefComplaint: string;
  urgencyScore?: number;
  aiSummary?: string;
  aiTranscript?: string;
}) {
  return prisma.triageCase.create({
    data: {
      patientId: params.patientId,
      chiefComplaint: params.chiefComplaint,
      urgencyScore: params.urgencyScore,
      aiSummary: params.aiSummary,
      aiTranscript: params.aiTranscript,
      status: CaseStatus.NEW,
      startedAt: new Date()
    }
  });
}

export async function transitionCaseStatus(params: {
  caseId: string;
  to: CaseStatus;
  actorId: string;
  actorType: "SYSTEM" | "DOCTOR" | "PATIENT" | "ADMIN";
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const currentCase = await tx.triageCase.findUnique({
      where: { id: params.caseId }
    });

    if (!currentCase) {
      throw new Error(`Case not found: ${params.caseId}`);
    }

    if (currentCase.status === params.to) {
      return currentCase;
    }

    assertCaseStatusTransition(currentCase.status, params.to);

    const updatePayload: Prisma.TriageCaseUpdateInput = {
      status: params.to
    };

    if (params.to === CaseStatus.COMPLETED) {
      updatePayload.completedAt = new Date();
    }

    const updatedCase = await tx.triageCase.update({
      where: { id: params.caseId },
      data: updatePayload
    });

    await tx.auditLog.create({
      data: {
        tableName: "triage_cases",
        recordId: params.caseId,
        action: "UPDATE",
        actorId: params.actorId,
        actorType: params.actorType,
        oldValues: { status: currentCase.status },
        newValues: { status: params.to, reason: params.reason }
      }
    });

    return updatedCase;
  });
}

export async function addCaseMessage(params: {
  caseId: string;
  senderType: "PATIENT" | "DOCTOR" | "AI" | "SYSTEM";
  senderId?: string;
  platform: "WHATSAPP" | "WEBEX";
  phiScope?: "NONE" | "POSSIBLE" | "PHI";
  content: string;
}) {
  return prisma.message.create({
    data: {
      caseId: params.caseId,
      senderType: params.senderType,
      senderId: params.senderId,
      platform: params.platform,
      phiScope: params.phiScope ?? "POSSIBLE",
      content: params.content
    }
  });
}

export async function setCaseWebexSpaceIfMissing(caseId: string, webexSpaceId: string) {
  const existing = await prisma.triageCase.findUnique({
    where: { id: caseId },
    select: { webexSpaceId: true }
  });

  if (!existing || existing.webexSpaceId) {
    return;
  }

  await prisma.triageCase.update({
    where: { id: caseId },
    data: { webexSpaceId }
  });
}
