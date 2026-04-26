import { CaseStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { sendWebexTextMessage } from "../../integrations/webexClient.js";
import { sendWhatsAppTextMessage } from "../../integrations/whatsappClient.js";
import { transitionCaseStatus } from "../cases/caseRepository.js";

export async function relayPatientMessageToWebex(params: {
  caseId: string;
  patientPhone: string;
  text: string;
}) {
  const triageCase = await prisma.triageCase.findUnique({
    where: { id: params.caseId }
  });

  if (!triageCase) {
    return {
      relayed: false,
      reason: "Case not found"
    };
  }

  const targetRoomId = triageCase.webexSpaceId ?? env.WEBEX_DEFAULT_ROOM_ID;

  if (!targetRoomId) {
    return {
      relayed: false,
      reason: "No Webex room configured"
    };
  }

  const formatted = `Patient ${params.patientPhone}: ${params.text}`;
  const relay = await sendWebexTextMessage({
    roomId: targetRoomId,
    text: formatted
  });

  if (!relay.sent) {
    return {
      relayed: false,
      reason: relay.reason ?? "Unknown Webex relay failure"
    };
  }

  if (!triageCase.webexSpaceId) {
    await prisma.triageCase.update({
      where: { id: params.caseId },
      data: {
        webexSpaceId: targetRoomId
      }
    });
  }

  if (triageCase.status === CaseStatus.ASSIGNED) {
    await transitionCaseStatus({
      caseId: triageCase.id,
      to: CaseStatus.IN_PROGRESS,
      actorId: "SYSTEM_RELAY",
      actorType: "SYSTEM",
      reason: "Patient message relayed to doctor in Webex"
    });
  }

  return {
    relayed: true,
    roomId: targetRoomId,
    messageId: relay.messageId
  };
}

export async function relayDoctorMessageToWhatsApp(params: { caseId: string; doctorText: string }) {
  const triageCase = await prisma.triageCase.findUnique({
    where: { id: params.caseId },
    include: {
      patient: true
    }
  });

  if (!triageCase) {
    return {
      relayed: false,
      reason: "Case not found"
    };
  }

  const relay = await sendWhatsAppTextMessage({
    to: triageCase.patient.whatsappPhone,
    body: params.doctorText
  });

  if (!relay.sent) {
    return {
      relayed: false,
      reason: relay.reason ?? "Unknown WhatsApp relay failure"
    };
  }

  return {
    relayed: true,
    messageId: relay.messageId
  };
}
