import { prisma } from "../../lib/prisma.js";
import { parseCaseTriageStorage } from "../consultations/triageStorage.js";
import {
  addWebexRoomMember,
  createWebexRoom,
  sendWebexTextMessage
} from "../../integrations/webexClient.js";

export type WorkspaceResult = {
  ensured: boolean;
  roomId?: string;
  reason?: string;
};

function caseTitle(caseId: string): string {
  return `WAdoctors Case ${caseId.slice(0, 8)}`;
}

export function buildInitialCaseSummary(params: {
  caseId: string;
  patientPhone: string;
  complaint?: string | null;
  urgencyScore?: number | null;
  aiSummary?: string | null;
  aiTranscript?: string | null;
}): string {
  const lines = [
    `New Case Assigned`,
    `Case: ${params.caseId}`,
    `Patient: ${params.patientPhone}`,
    `Complaint: ${params.complaint ?? "Not provided"}`,
    `Urgency Score: ${params.urgencyScore ?? "Unknown"}`
  ];

  const triage = parseCaseTriageStorage(params.aiTranscript);
  if (triage) {
    lines.push(`Triage Source: ${triage.triageSource}`);
    lines.push(`Triage Route: ${triage.route}`);
    lines.push(`Triage Confidence: ${Math.round(triage.triageConfidence * 100)}%`);
    if (triage.triageFallbackReason) {
      lines.push(`Triage Fallback: ${triage.triageFallbackReason}`);
    }
    if (triage.triageSafetyOverride) {
      lines.push(
        `Triage Safety Override: ${triage.triageSafetySignal ? triage.triageSafetySignal : "enabled"}`
      );
    }
    if (triage.triageRedFlags.length) {
      lines.push(`Triage Red Flags: ${triage.triageRedFlags.join(", ")}`);
    }
    if (triage.triageSummary) {
      lines.push(`Triage Summary: ${triage.triageSummary}`);
    }
  } else if (params.aiSummary?.trim()) {
    lines.push(`Triage Note: ${params.aiSummary.trim()}`);
  }

  return lines.join("\n");
}

export async function ensureCaseWorkspace(caseId: string): Promise<WorkspaceResult> {
  const triageCase = await prisma.triageCase.findUnique({
    where: { id: caseId },
    include: {
      patient: true,
      assignedDoctor: true
    }
  });

  if (!triageCase) {
    return {
      ensured: false,
      reason: "Case not found"
    };
  }

  if (triageCase.webexSpaceId) {
    return {
      ensured: true,
      roomId: triageCase.webexSpaceId
    };
  }

  const room = await createWebexRoom(caseTitle(triageCase.id));
  if (!room.created || !room.roomId) {
    return {
      ensured: false,
      reason: room.reason ?? "Unable to create Webex room"
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.triageCase.update({
      where: { id: triageCase.id },
      data: { webexSpaceId: room.roomId }
    });

    await tx.auditLog.create({
      data: {
        tableName: "triage_cases",
        recordId: triageCase.id,
        action: "UPDATE",
        actorId: "SYSTEM_WORKSPACE",
        actorType: "SYSTEM",
        oldValues: { webexSpaceId: null },
        newValues: {
          webexSpaceId: room.roomId,
          reason: "Created dedicated Webex room for case"
        }
      }
    });
  });

  if (triageCase.assignedDoctor?.webexPersonId) {
    await addWebexRoomMember({
      roomId: room.roomId,
      personId: triageCase.assignedDoctor.webexPersonId
    });
  }

  const summary = buildInitialCaseSummary({
    caseId: triageCase.id,
    patientPhone: triageCase.patient.whatsappPhone,
    complaint: triageCase.chiefComplaint,
    urgencyScore: triageCase.urgencyScore,
    aiSummary: triageCase.aiSummary,
    aiTranscript: triageCase.aiTranscript
  });

  await sendWebexTextMessage({
    roomId: room.roomId,
    text: summary
  });

  return {
    ensured: true,
    roomId: room.roomId
  };
}
