import { describe, expect, it } from "vitest";
import { buildWebhookSummary } from "./webhookSummary.js";

describe("buildWebhookSummary", () => {
  it("merges overall and windowed provider stats into a normalized summary", () => {
    const summary = buildWebhookSummary({
      windowHours: 24,
      totalEvents: 21,
      eventsLastWindow: 7,
      overallByProvider: [
        {
          provider: "whatsapp",
          count: 12,
          lastReceivedAt: new Date("2026-04-27T02:00:00.000Z")
        },
        {
          provider: "webex",
          count: 6,
          lastReceivedAt: new Date("2026-04-27T01:30:00.000Z")
        },
        {
          provider: "stripe",
          count: 3,
          lastReceivedAt: null
        }
      ],
      windowByProvider: [
        {
          provider: "webex",
          count: 4
        },
        {
          provider: "whatsapp",
          count: 2
        },
        {
          provider: "stripe",
          count: 1
        }
      ]
    });

    expect(summary).toMatchObject({
      windowHours: 24,
      totalEvents: 21,
      eventsLastWindow: 7
    });

    expect(summary.providers).toEqual([
      {
        provider: "whatsapp",
        totalEvents: 12,
        eventsLastWindow: 2,
        lastReceivedAt: "2026-04-27T02:00:00.000Z"
      },
      {
        provider: "webex",
        totalEvents: 6,
        eventsLastWindow: 4,
        lastReceivedAt: "2026-04-27T01:30:00.000Z"
      },
      {
        provider: "stripe",
        totalEvents: 3,
        eventsLastWindow: 1,
        lastReceivedAt: null
      }
    ]);
  });

  it("adds providers seen only in the windowed slice", () => {
    const summary = buildWebhookSummary({
      windowHours: 24,
      totalEvents: 3,
      eventsLastWindow: 3,
      overallByProvider: [
        {
          provider: "whatsapp",
          count: 3,
          lastReceivedAt: new Date("2026-04-27T02:00:00.000Z")
        }
      ],
      windowByProvider: [
        {
          provider: "unknown-provider",
          count: 1
        },
        {
          provider: "whatsapp",
          count: 2
        }
      ]
    });

    expect(summary.providers).toEqual([
      {
        provider: "whatsapp",
        totalEvents: 3,
        eventsLastWindow: 2,
        lastReceivedAt: "2026-04-27T02:00:00.000Z"
      },
      {
        provider: "unknown-provider",
        totalEvents: 0,
        eventsLastWindow: 1,
        lastReceivedAt: null
      }
    ]);
  });
});
