import express, { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { processWebexWebhookPayload } from "../domain/webhooks/webexProcessor.js";
import { processWhatsAppWebhookPayload } from "../domain/webhooks/whatsappProcessor.js";
import { registerWebhookDelivery } from "../webhooks/idempotency.js";
import {
  extractStripeExternalId,
  extractWebexExternalId,
  extractWhatsAppExternalId
} from "../webhooks/payloads.js";
import {
  verifyStripeSignature,
  verifyWebexSignature,
  verifyWhatsAppSignature
} from "../webhooks/signature.js";

export const webhookRouter = Router();
const rawJsonParser = express.raw({ type: "application/json", limit: "2mb" });

function getRawBody(req: Request): Buffer {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body, "utf8");
  }

  return Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
}

function tryParseJson<T>(rawBody: Buffer): T | null {
  try {
    return JSON.parse(rawBody.toString("utf8")) as T;
  } catch {
    return null;
  }
}

webhookRouter.get("/whatsapp", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ error: "Webhook verification failed" });
});

webhookRouter.post("/whatsapp", rawJsonParser, async (req: Request, res: Response) => {
  const rawBody = getRawBody(req);
  const signatureCheck = verifyWhatsAppSignature(
    rawBody,
    req.get("x-hub-signature-256") ?? undefined,
    env.WHATSAPP_WEBHOOK_SECRET
  );

  if (!signatureCheck.isValid) {
    return res.status(401).json({ error: signatureCheck.reason });
  }

  const payload = tryParseJson<Record<string, unknown>>(rawBody);
  if (!payload) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const externalId = extractWhatsAppExternalId(payload);
  const idempotency = await registerWebhookDelivery({
    provider: "whatsapp",
    externalId,
    rawBody
  });

  if (idempotency.isDuplicate) {
    return res.status(200).json({
      received: true,
      provider: "whatsapp",
      duplicate: true,
      eventKey: idempotency.eventKey
    });
  }

  const processing = await processWhatsAppWebhookPayload(payload);

  return res.status(200).json({
    received: true,
    provider: "whatsapp",
    duplicate: false,
    eventKey: idempotency.eventKey,
    processing
  });
});

webhookRouter.post("/webex", rawJsonParser, async (req: Request, res: Response) => {
  const rawBody = getRawBody(req);
  const signatureCheck = verifyWebexSignature(
    rawBody,
    req.get("x-spark-signature") ?? undefined,
    env.WEBEX_WEBHOOK_SECRET
  );

  if (!signatureCheck.isValid) {
    return res.status(401).json({ error: signatureCheck.reason });
  }

  const payload = tryParseJson<Record<string, unknown>>(rawBody);
  if (!payload) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const idempotency = await registerWebhookDelivery({
    provider: "webex",
    externalId: extractWebexExternalId(payload),
    rawBody
  });

  let processing: Awaited<ReturnType<typeof processWebexWebhookPayload>> | undefined;
  if (!idempotency.isDuplicate) {
    processing = await processWebexWebhookPayload(payload);
  }

  return res.status(200).json({
    received: true,
    provider: "webex",
    duplicate: idempotency.isDuplicate,
    eventKey: idempotency.eventKey,
    processing
  });
});

webhookRouter.post("/stripe", rawJsonParser, async (req: Request, res: Response) => {
  const rawBody = getRawBody(req);
  const signatureCheck = verifyStripeSignature(
    rawBody,
    req.get("stripe-signature") ?? undefined,
    env.STRIPE_WEBHOOK_SECRET
  );

  if (!signatureCheck.isValid) {
    return res.status(401).json({ error: signatureCheck.reason });
  }

  const payload = tryParseJson<Record<string, unknown>>(rawBody);
  if (!payload) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const idempotency = await registerWebhookDelivery({
    provider: "stripe",
    externalId: extractStripeExternalId(payload),
    rawBody
  });

  return res.status(200).json({
    received: true,
    provider: "stripe",
    duplicate: idempotency.isDuplicate,
    eventKey: idempotency.eventKey
  });
});
