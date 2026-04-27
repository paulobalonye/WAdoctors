import { describe, expect, it } from "vitest";
import { formatIntegrationReadinessWarnings } from "./readiness.js";

describe("formatIntegrationReadinessWarnings", () => {
  it("returns empty list when all integrations are ready", () => {
    const warnings = formatIntegrationReadinessWarnings({
      summary: { readyCount: 5, total: 5 },
      aiTriage: { ready: true, missing: [], notes: ["provider=openai"], enabled: true, provider: "openai", model: "gpt-4.1-mini" },
      whatsapp: { ready: true, missing: [], notes: [] },
      webex: { ready: true, missing: [], notes: [] },
      stripe: { ready: true, missing: [], notes: [] },
      relay: { ready: true, missing: [], notes: ["RELAY_DISPATCH_MODE=queue"], dispatchMode: "queue" }
    });

    expect(warnings).toEqual([]);
  });

  it("returns clear warning lines for not-ready integrations", () => {
    const warnings = formatIntegrationReadinessWarnings({
      summary: { readyCount: 1, total: 5 },
      aiTriage: {
        ready: false,
        missing: ["OPENAI_API_KEY"],
        notes: ["provider=openai", "model=gpt-4.1-mini"],
        enabled: true,
        provider: "openai",
        model: "gpt-4.1-mini"
      },
      whatsapp: {
        ready: false,
        missing: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
        notes: []
      },
      webex: {
        ready: false,
        missing: ["WEBEX_BOT_ACCESS_TOKEN"],
        notes: []
      },
      stripe: { ready: true, missing: [], notes: [] },
      relay: {
        ready: false,
        missing: ["REDIS_URL"],
        notes: ["RELAY_DISPATCH_MODE=queue"],
        dispatchMode: "queue"
      }
    });

    expect(warnings).toEqual([
      "Integration readiness: 1/5 ready.",
      "AI Triage missing: OPENAI_API_KEY",
      "WhatsApp missing: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID",
      "Webex missing: WEBEX_BOT_ACCESS_TOKEN",
      "Relay Queue missing: REDIS_URL",
      "Relay Queue notes: RELAY_DISPATCH_MODE=queue"
    ]);
  });
});
