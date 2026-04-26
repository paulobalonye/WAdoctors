import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";

export type WebhookProvider = "whatsapp" | "webex" | "stripe";

export type IdempotencyResult = {
  isDuplicate: boolean;
  eventKey: string;
  payloadHash: string;
};

function hashPayload(rawBody: Buffer): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export async function registerWebhookDelivery(params: {
  provider: WebhookProvider;
  externalId?: string | null;
  rawBody: Buffer;
}): Promise<IdempotencyResult> {
  const payloadHash = hashPayload(params.rawBody);
  const eventKey = params.externalId?.trim() || payloadHash;

  try {
    await prisma.webhookEvent.create({
      data: {
        provider: params.provider,
        externalId: eventKey,
        payloadHash
      }
    });

    return {
      isDuplicate: false,
      eventKey,
      payloadHash
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      return {
        isDuplicate: true,
        eventKey,
        payloadHash
      };
    }

    throw error;
  }
}
