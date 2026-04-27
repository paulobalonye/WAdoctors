import { describe, expect, it } from "vitest";
import { buildIntegrationStatus } from "./integrationStatus.js";

describe("buildIntegrationStatus", () => {
  it("marks integrations ready when required secrets are present", () => {
    const status = buildIntegrationStatus({
      relayDispatchMode: "queue",
      redisUrl: "redis://127.0.0.1:6380",
      aiTriage: {
        enabled: true,
        provider: "openai",
        apiKey: "openai-key",
        model: "gpt-4.1-mini",
        promptVersion: "v1",
        minConfidence: 0.45
      },
      whatsapp: {
        webhookSecret: "wa-secret",
        verifyToken: "wa-verify",
        accessToken: "wa-token",
        phoneNumberId: "wa-phone-id"
      },
      webex: {
        webhookSecret: "wx-secret",
        botAccessToken: "wx-token",
        botPersonId: "wx-person-id",
        defaultRoomId: "wx-room-id"
      },
      stripe: {
        webhookSecret: "stripe-secret"
      }
    });

    expect(status.summary.readyCount).toBe(5);
    expect(status.summary.total).toBe(5);
    expect(status.aiTriage.ready).toBe(true);
    expect(status.aiTriage.enabled).toBe(true);
    expect(status.aiTriage.notes).toEqual([
      "provider=openai",
      "model=gpt-4.1-mini",
      "promptVersion=v1",
      "minConfidence=0.45"
    ]);
    expect(status.whatsapp.ready).toBe(true);
    expect(status.webex.ready).toBe(true);
    expect(status.stripe.ready).toBe(true);
    expect(status.relay.ready).toBe(true);
  });

  it("returns missing requirements for partially configured integrations", () => {
    const status = buildIntegrationStatus({
      relayDispatchMode: "queue",
      redisUrl: "",
      aiTriage: {
        enabled: true,
        provider: "openai",
        apiKey: "",
        model: "gpt-4.1-mini",
        promptVersion: "v1",
        minConfidence: 0.45
      },
      whatsapp: {
        webhookSecret: "",
        verifyToken: "",
        accessToken: "",
        phoneNumberId: ""
      },
      webex: {
        webhookSecret: "wx-secret",
        botAccessToken: "",
        botPersonId: "",
        defaultRoomId: ""
      },
      stripe: {
        webhookSecret: ""
      }
    });

    expect(status.summary.readyCount).toBe(0);
    expect(status.aiTriage.ready).toBe(false);
    expect(status.aiTriage.missing).toEqual(["OPENAI_API_KEY"]);
    expect(status.whatsapp.ready).toBe(false);
    expect(status.whatsapp.missing).toEqual([
      "WHATSAPP_WEBHOOK_SECRET",
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID"
    ]);

    expect(status.webex.ready).toBe(false);
    expect(status.webex.missing).toEqual([
      "WEBEX_BOT_ACCESS_TOKEN",
      "WEBEX_BOT_PERSON_ID",
      "WEBEX_DEFAULT_ROOM_ID"
    ]);

    expect(status.relay.ready).toBe(false);
    expect(status.relay.missing).toEqual(["REDIS_URL"]);
    expect(status.relay.notes).toEqual(["RELAY_DISPATCH_MODE=queue"]);
  });

  it("marks AI triage as ready with disabled mode", () => {
    const status = buildIntegrationStatus({
      relayDispatchMode: "inline",
      redisUrl: "",
      aiTriage: {
        enabled: false,
        provider: "openai",
        apiKey: "",
        model: "gpt-4.1-mini",
        promptVersion: "v1",
        minConfidence: 0.45
      },
      whatsapp: {
        webhookSecret: "wa-secret",
        verifyToken: "wa-verify",
        accessToken: "wa-token",
        phoneNumberId: "wa-phone-id"
      },
      webex: {
        webhookSecret: "wx-secret",
        botAccessToken: "wx-token",
        botPersonId: "wx-person-id",
        defaultRoomId: "wx-room-id"
      },
      stripe: {
        webhookSecret: "stripe-secret"
      }
    });

    expect(status.aiTriage.ready).toBe(true);
    expect(status.aiTriage.notes).toEqual(["AI triage disabled"]);
  });
});
