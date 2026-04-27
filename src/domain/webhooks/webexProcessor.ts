import { CaseStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { fetchWebexMessageById } from "../../integrations/webexClient.js";
import { extractWebexWebhook } from "../../webhooks/payloads.js";
import { addCaseMessage, transitionCaseStatus } from "../cases/caseRepository.js";
import { dispatchDoctorToWhatsApp } from "../messages/relayDispatcher.js";

export type WebexProcessResult = {
  processed: boolean;
  reason?: string;
  caseId?: string;
  relayedToWhatsApp?: boolean;
};

function isRelayedPatientMessageEcho(text: string): boolean {
  return /^patient\s+\+?[0-9][0-9\s\-().]*:/i.test(String(text || "").trim());
}

export async function processWebexWebhookPayload(payload: unknown): Promise<WebexProcessResult> {
  const event = extractWebexWebhook(payload);

  if (event.resource !== "messages" || event.event !== "created" || !event.roomId) {
    return {
      processed: false,
      reason: "Unsupported Webex webhook event"
    };
  }

  if (env.WEBEX_BOT_PERSON_ID && event.personId && event.personId === env.WEBEX_BOT_PERSON_ID) {
    return {
      processed: false,
      reason: "Ignoring bot-originated message"
    };
  }

  const triageCase = await prisma.triageCase.findFirst({
    where: {
      webexSpaceId: event.roomId
    },
    include: {
      patient: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!triageCase) {
    return {
      processed: false,
      reason: "No active case mapped to Webex room"
    };
  }

  let doctorText = "";
  if (event.messageId) {
    const messageDetails = await fetchWebexMessageById(event.messageId);
    doctorText = messageDetails?.text ?? "";
  }

  if (!doctorText) {
    return {
      processed: false,
      reason: "Unable to resolve Webex message text"
    };
  }

  if (isRelayedPatientMessageEcho(doctorText)) {
    return {
      processed: false,
      reason: "Ignoring relayed patient message echo"
    };
  }

  await addCaseMessage({
    caseId: triageCase.id,
    senderType: "DOCTOR",
    platform: "WEBEX",
    phiScope: "POSSIBLE",
    content: doctorText
  });

  if (triageCase.status === CaseStatus.ASSIGNED) {
    await transitionCaseStatus({
      caseId: triageCase.id,
      to: CaseStatus.IN_PROGRESS,
      actorId: "SYSTEM_WEBEX",
      actorType: "SYSTEM",
      reason: "Doctor posted first message in Webex room"
    });
  }

  const outboundText = `Doctor: ${doctorText}`;
  const relayResult = await dispatchDoctorToWhatsApp({
    caseId: triageCase.id,
    doctorText: outboundText,
    relayKey: event.messageId
  });

  return {
    processed: true,
    caseId: triageCase.id,
    relayedToWhatsApp: relayResult.dispatched,
    reason: relayResult.dispatched ? undefined : relayResult.reason
  };
}
