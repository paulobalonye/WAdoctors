type IntegrationStatusEntry = {
  ready: boolean;
  missing: string[];
  notes: string[];
};

function present(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function buildEntry(params: {
  required: Array<{ key: string; present: boolean }>;
  notes?: string[];
}): IntegrationStatusEntry {
  const missing = params.required.filter((item) => !item.present).map((item) => item.key);
  return {
    ready: missing.length === 0,
    missing,
    notes: params.notes ?? []
  };
}

export type IntegrationStatusResult = {
  summary: {
    readyCount: number;
    total: number;
  };
  aiTriage: IntegrationStatusEntry & {
    enabled: boolean;
    provider: "openai";
    model: string;
  };
  whatsapp: IntegrationStatusEntry;
  webex: IntegrationStatusEntry;
  stripe: IntegrationStatusEntry;
  relay: IntegrationStatusEntry & {
    dispatchMode: "inline" | "queue";
  };
};

export function buildIntegrationStatus(params: {
  relayDispatchMode: "inline" | "queue";
  redisUrl: string | undefined;
  aiTriage: {
    enabled: boolean;
    provider: "openai";
    apiKey: string | undefined;
    model: string;
  };
  whatsapp: {
    webhookSecret: string | undefined;
    verifyToken: string | undefined;
    accessToken: string | undefined;
    phoneNumberId: string | undefined;
  };
  webex: {
    webhookSecret: string | undefined;
    botAccessToken: string | undefined;
    botPersonId: string | undefined;
    defaultRoomId: string | undefined;
  };
  stripe: {
    webhookSecret: string | undefined;
  };
}): IntegrationStatusResult {
  const whatsapp = buildEntry({
    required: [
      { key: "WHATSAPP_WEBHOOK_SECRET", present: present(params.whatsapp.webhookSecret) },
      { key: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", present: present(params.whatsapp.verifyToken) },
      { key: "WHATSAPP_ACCESS_TOKEN", present: present(params.whatsapp.accessToken) },
      { key: "WHATSAPP_PHONE_NUMBER_ID", present: present(params.whatsapp.phoneNumberId) }
    ]
  });

  const webex = buildEntry({
    required: [
      { key: "WEBEX_WEBHOOK_SECRET", present: present(params.webex.webhookSecret) },
      { key: "WEBEX_BOT_ACCESS_TOKEN", present: present(params.webex.botAccessToken) },
      { key: "WEBEX_BOT_PERSON_ID", present: present(params.webex.botPersonId) },
      { key: "WEBEX_DEFAULT_ROOM_ID", present: present(params.webex.defaultRoomId) }
    ]
  });

  const stripe = buildEntry({
    required: [{ key: "STRIPE_WEBHOOK_SECRET", present: present(params.stripe.webhookSecret) }]
  });

  const relayRequired: Array<{ key: string; present: boolean }> = [];
  if (params.relayDispatchMode === "queue") {
    relayRequired.push({ key: "REDIS_URL", present: present(params.redisUrl) });
  }

  const relayEntry = buildEntry({
    required: relayRequired,
    notes: [`RELAY_DISPATCH_MODE=${params.relayDispatchMode}`]
  });

  const relay: IntegrationStatusResult["relay"] = {
    ...relayEntry,
    dispatchMode: params.relayDispatchMode
  };

  const aiRequired = params.aiTriage.enabled
    ? [{ key: "OPENAI_API_KEY", present: present(params.aiTriage.apiKey) }]
    : [];
  const aiTriageEntry = buildEntry({
    required: aiRequired,
    notes: params.aiTriage.enabled
      ? [`provider=${params.aiTriage.provider}`, `model=${params.aiTriage.model}`]
      : ["AI triage disabled"]
  });

  const aiTriage: IntegrationStatusResult["aiTriage"] = {
    ...aiTriageEntry,
    enabled: params.aiTriage.enabled,
    provider: params.aiTriage.provider,
    model: params.aiTriage.model
  };

  const entries = [whatsapp, webex, stripe, relay, aiTriage];
  const readyCount = entries.filter((entry) => entry.ready).length;

  return {
    summary: {
      readyCount,
      total: entries.length
    },
    aiTriage,
    whatsapp,
    webex,
    stripe,
    relay
  };
}
