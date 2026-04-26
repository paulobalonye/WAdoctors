export type ParsedWhatsAppMessage = {
  id: string;
  from: string;
  text: string;
  type: string;
  timestamp?: string;
};

function getStringFromObject(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const result = (value as Record<string, unknown>)[key];
  return typeof result === "string" && result.trim().length > 0 ? result : undefined;
}

export function extractWhatsAppExternalId(payload: unknown): string | undefined {
  const messages = extractWhatsAppMessages(payload);
  if (messages.length > 0) {
    return messages[0].id;
  }

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const entries = (payload as Record<string, unknown>).entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    return undefined;
  }

  const firstEntry = entries[0];
  if (!firstEntry || typeof firstEntry !== "object") {
    return undefined;
  }

  const changes = (firstEntry as Record<string, unknown>).changes;
  if (!Array.isArray(changes) || changes.length === 0) {
    return undefined;
  }

  const firstChange = changes[0];
  if (!firstChange || typeof firstChange !== "object") {
    return undefined;
  }

  const value = (firstChange as Record<string, unknown>).value;
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const statuses = (value as Record<string, unknown>).statuses;
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return undefined;
  }

  return getStringFromObject(statuses[0], "id");
}

export function extractWhatsAppMessages(payload: unknown): ParsedWhatsAppMessage[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const payloadRecord = payload as Record<string, unknown>;
  const entries = payloadRecord.entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const firstEntry = entries[0];
  if (!firstEntry || typeof firstEntry !== "object") {
    return [];
  }

  const changes = (firstEntry as Record<string, unknown>).changes;
  if (!Array.isArray(changes) || changes.length === 0) {
    return [];
  }

  const firstChange = changes[0];
  if (!firstChange || typeof firstChange !== "object") {
    return [];
  }

  const value = (firstChange as Record<string, unknown>).value;
  if (!value || typeof value !== "object") {
    return [];
  }

  const messages = (value as Record<string, unknown>).messages;
  if (!Array.isArray(messages)) {
    return [];
  }

  const parsed: ParsedWhatsAppMessage[] = [];

  for (const item of messages) {
    const id = getStringFromObject(item, "id");
    const from = getStringFromObject(item, "from");
    const type = getStringFromObject(item, "type") ?? "unknown";
    const timestamp = getStringFromObject(item, "timestamp");

    if (!id || !from) {
      continue;
    }

    const textContainer =
      item && typeof item === "object" ? (item as Record<string, unknown>).text : undefined;
    const text = getStringFromObject(textContainer, "body") ?? `[${type} message]`;

    parsed.push({
      id,
      from,
      type,
      text,
      timestamp
    });
  }

  return parsed;
}

export type ParsedWebexWebhook = {
  eventId?: string;
  resource?: string;
  event?: string;
  messageId?: string;
  roomId?: string;
  personId?: string;
};

export function extractWebexWebhook(payload: unknown): ParsedWebexWebhook {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const payloadRecord = payload as Record<string, unknown>;
  const data = payloadRecord.data;

  return {
    eventId: getStringFromObject(payloadRecord, "id"),
    resource: getStringFromObject(payloadRecord, "resource"),
    event: getStringFromObject(payloadRecord, "event"),
    messageId: getStringFromObject(data, "id"),
    roomId: getStringFromObject(data, "roomId"),
    personId: getStringFromObject(data, "personId")
  };
}

export function extractWebexExternalId(payload: unknown): string | undefined {
  const parsed = extractWebexWebhook(payload);
  return parsed.eventId ?? parsed.messageId;
}

export function extractStripeExternalId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  return getStringFromObject(payload, "id");
}
