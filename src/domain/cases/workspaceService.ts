import { prisma } from "../../lib/prisma.js";
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

function initialCaseSummary(params: {
  caseId: string;
  patientPhone: string;
  complaint?: string | null;
  urgencyScore?: number | null;
}): string {
  return [
    `New Case Assigned`,
    `Case: ${params.caseId}`,
    `Patient: ${params.patientPhone}`,
    `Complaint: ${params.complaint ?? "Not provided"}`,
    `Urgency Score: ${params.urgencyScore ?? "Unknown"}`
  ].join("\n");
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

  const summary = initialCaseSummary({
    caseId: triageCase.id,
    patientPhone: triageCase.patient.whatsappPhone,
    complaint: triageCase.chiefComplaint,
    urgencyScore: triageCase.urgencyScore
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
