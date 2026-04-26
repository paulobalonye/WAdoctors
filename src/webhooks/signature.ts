import { createHmac, timingSafeEqual } from "node:crypto";

type SignatureCheck = {
  isValid: boolean;
  reason?: string;
};

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export function verifyWhatsAppSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): SignatureCheck {
  if (!signatureHeader) {
    return { isValid: false, reason: "Missing X-Hub-Signature-256 header" };
  }

  const normalized = signatureHeader.trim().toLowerCase();
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedSignature = `sha256=${expected}`;

  if (!safeCompare(normalized, expectedSignature)) {
    return { isValid: false, reason: "Invalid WhatsApp signature" };
  }

  return { isValid: true };
}

export function verifyWebexSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  webhookSecret: string
): SignatureCheck {
  if (!signatureHeader) {
    return { isValid: false, reason: "Missing X-Spark-Signature header" };
  }

  // Webex uses HMAC-SHA1 in X-Spark-Signature when webhook secret is set.
  const expected = createHmac("sha1", webhookSecret).update(rawBody).digest("hex");
  const normalized = signatureHeader.trim().toLowerCase();

  if (!safeCompare(normalized, expected)) {
    return { isValid: false, reason: "Invalid Webex signature" };
  }

  return { isValid: true };
}

function parseStripeSignatureHeader(
  headerValue: string
): { timestamp: number; v1Signatures: string[] } | null {
  const parts = headerValue.split(",");
  const v1Signatures: string[] = [];
  let timestamp: number | null = null;

  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || !rawValue) {
      continue;
    }

    const key = rawKey.trim();
    const value = rawValue.trim();

    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        timestamp = parsed;
      }
    }

    if (key === "v1") {
      v1Signatures.push(value.toLowerCase());
    }
  }

  if (!timestamp || v1Signatures.length === 0) {
    return null;
  }

  return { timestamp, v1Signatures };
}

export function verifyStripeSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  endpointSecret: string,
  toleranceSeconds = 300
): SignatureCheck {
  if (!signatureHeader) {
    return { isValid: false, reason: "Missing Stripe-Signature header" };
  }

  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) {
    return { isValid: false, reason: "Malformed Stripe-Signature header" };
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowEpochSeconds - parsed.timestamp) > toleranceSeconds) {
    return { isValid: false, reason: "Stripe signature timestamp outside tolerance" };
  }

  const signedPayload = `${parsed.timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", endpointSecret)
    .update(signedPayload, "utf8")
    .digest("hex")
    .toLowerCase();

  const hasMatch = parsed.v1Signatures.some((candidate) => safeCompare(candidate, expected));

  if (!hasMatch) {
    return { isValid: false, reason: "No Stripe signature matches expected digest" };
  }

  return { isValid: true };
}
