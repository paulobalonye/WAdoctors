import { CaseStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { transitionCaseStatus } from "../cases/caseRepository.js";
import { dispatchDoctorToWhatsApp } from "../messages/relayDispatcher.js";
import { buildCaseTriageView } from "./caseTriageView.js";

function assertDoctorOwnsCase(caseDoctorId: string | null, doctorId: string): void {
  if (!caseDoctorId || caseDoctorId !== doctorId) {
    throw new Error("Doctor is not assigned to this case");
  }
}

export async function getDoctorProfile(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId }
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  return doctor;
}

export async function listDoctorCases(params: {
  doctorId: string;
  status?: CaseStatus;
  triageSource?: "AI" | "HEURISTIC";
  triageRoute?: "ROUTE_TO_DOCTOR" | "SEND_SELF_CARE" | "ESCALATE_EMERGENCY" | "OUT_OF_STATE";
}) {
  const cases = await prisma.triageCase.findMany({
    where: {
      assignedDoctorId: params.doctorId,
      ...(params.status ? { status: params.status } : {})
    },
    include: {
      patient: {
        select: {
          id: true,
          whatsappPhone: true,
          fullName: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const mapped = cases.map((item) => ({
    ...item,
    triage: buildCaseTriageView({
      aiSummary: item.aiSummary,
      aiTranscript: item.aiTranscript
    })
  }));

  return mapped.filter((item) => {
    if (params.triageSource && item.triage?.source !== params.triageSource) {
      return false;
    }

    if (params.triageRoute && item.triage?.route !== params.triageRoute) {
      return false;
    }

    return true;
  });
}

export async function getDoctorCaseMessages(params: {
  doctorId: string;
  caseId: string;
}) {
  const triageCase = await prisma.triageCase.findUnique({
    where: { id: params.caseId }
  });

  if (!triageCase) {
    throw new Error("Case not found");
  }

  assertDoctorOwnsCase(triageCase.assignedDoctorId, params.doctorId);

  return prisma.message.findMany({
    where: {
      caseId: params.caseId
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function sendDoctorPortalMessage(params: {
  doctorId: string;
  caseId: string;
  text: string;
}) {
  const triageCase = await prisma.triageCase.findUnique({
    where: { id: params.caseId }
  });

  if (!triageCase) {
    throw new Error("Case not found");
  }

  assertDoctorOwnsCase(triageCase.assignedDoctorId, params.doctorId);

  const trimmedText = params.text.trim();
  if (!trimmedText) {
    throw new Error("Message text cannot be empty");
  }

  await prisma.message.create({
    data: {
      caseId: triageCase.id,
      senderType: "DOCTOR",
      senderId: params.doctorId,
      platform: "WEBEX",
      phiScope: "POSSIBLE",
      content: trimmedText
    }
  });

  if (triageCase.status === CaseStatus.ASSIGNED) {
    await transitionCaseStatus({
      caseId: triageCase.id,
      to: CaseStatus.IN_PROGRESS,
      actorId: params.doctorId,
      actorType: "DOCTOR",
      reason: "Doctor replied from portal"
    });
  }

  const dispatchResult = await dispatchDoctorToWhatsApp({
    caseId: triageCase.id,
    doctorText: `Doctor: ${trimmedText}`
  });

  return {
    caseId: triageCase.id,
    dispatched: dispatchResult.dispatched,
    mode: dispatchResult.mode,
    reason: dispatchResult.reason
  };
}

export async function closeDoctorCase(params: {
  doctorId: string;
  caseId: string;
  summary?: string;
}) {
  const triageCase = await prisma.triageCase.findUnique({
    where: { id: params.caseId }
  });

  if (!triageCase) {
    throw new Error("Case not found");
  }

  assertDoctorOwnsCase(triageCase.assignedDoctorId, params.doctorId);

  if (triageCase.status !== CaseStatus.COMPLETED) {
    await transitionCaseStatus({
      caseId: triageCase.id,
      to: CaseStatus.COMPLETED,
      actorId: params.doctorId,
      actorType: "DOCTOR",
      reason: "Case closed by doctor via portal"
    });
  }

  const closeSummary = params.summary?.trim() || "Your consultation has been completed.";
  await prisma.message.create({
    data: {
      caseId: triageCase.id,
      senderType: "SYSTEM",
      senderId: params.doctorId,
      platform: "WEBEX",
      phiScope: "POSSIBLE",
      content: `Case closed summary: ${closeSummary}`
    }
  });

  const dispatchResult = await dispatchDoctorToWhatsApp({
    caseId: triageCase.id,
    doctorText: `Visit summary: ${closeSummary}`
  });

  return {
    caseId: triageCase.id,
    closed: true,
    dispatched: dispatchResult.dispatched,
    mode: dispatchResult.mode,
    reason: dispatchResult.reason
  };
}
