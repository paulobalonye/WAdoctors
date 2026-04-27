export type ParsedWhatsAppMessage = {
  id: string;
  from: string;
  text: string;
  type: string;
  timestamp?: string;
};

function extractWhatsAppChangeValues(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const entries = (payload as Record<string, unknown>).entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const values: Array<Record<string, unknown>> = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const changes = (entry as Record<string, unknown>).changes;
    if (!Array.isArray(changes) || changes.length === 0) {
      continue;
    }

    for (const change of changes) {
      if (!change || typeof change !== "object") {
        continue;
      }

      const value = (change as Record<string, unknown>).value;
      if (value && typeof value === "object") {
        values.push(value as Record<string, unknown>);
      }
    }
  }

  return values;
}

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

  const values = extractWhatsAppChangeValues(payload);
  for (const value of values) {
    const statuses = value.statuses;
    if (!Array.isArray(statuses) || statuses.length === 0) {
      continue;
    }

    for (const status of statuses) {
      const statusId = getStringFromObject(status, "id");
      if (statusId) {
        return statusId;
      }
    }
  }

  return undefined;
}

export function extractWhatsAppMessages(payload: unknown): ParsedWhatsAppMessage[] {
  const values = extractWhatsAppChangeValues(payload);
  const parsed: ParsedWhatsAppMessage[] = [];
  const seenMessageIds = new Set<string>();

  for (const value of values) {
    const messages = value.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      continue;
    }

    for (const item of messages) {
      const id = getStringFromObject(item, "id");
      const from = getStringFromObject(item, "from");
      const type = getStringFromObject(item, "type") ?? "unknown";
      const timestamp = getStringFromObject(item, "timestamp");

      if (!id || !from || seenMessageIds.has(id)) {
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
      seenMessageIds.add(id);
    }
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
