import { describe, expect, it } from "vitest";
import { buildTriageInsightsSummary } from "./triageInsights.js";

describe("buildTriageInsightsSummary", () => {
  it("builds aggregated triage metrics and rankings", () => {
    const summary = buildTriageInsightsSummary({
      windowHours: 24,
      limit: 100,
      now: new Date("2026-04-27T15:00:00.000Z"),
      cases: [
        {
          triage: {
            source: "AI",
            route: "ESCALATE_EMERGENCY",
            confidence: 0.92,
            redFlags: ["chest pain", "shortness of breath"],
            baselineUrgency: 4,
            urgencyScore: 5,
            summary: "Possible acute emergency."
          }
        },
        {
          triage: {
            source: "AI",
            route: "ROUTE_TO_DOCTOR",
            confidence: 0.63,
            redFlags: ["fever"],
            baselineUrgency: 3,
            urgencyScore: 4,
            summary: "Urgent care follow-up recommended."
          }
        },
        {
          triage: {
            source: "HEURISTIC",
            route: "ROUTE_TO_DOCTOR",
            confidence: null,
            redFlags: ["fever"],
            baselineUrgency: 3,
            urgencyScore: 3,
            summary: "Keyword baseline."
          }
        },
        {
          triage: null
        }
      ]
    });

    expect(summary).toMatchObject({
      windowHours: 24,
      limit: 100,
      generatedAt: "2026-04-27T15:00:00.000Z",
      totalCases: 4,
      withTriage: 3,
      withoutTriage: 1,
      sourceCounts: {
        AI: 2,
        HEURISTIC: 1
      },
      confidenceBands: {
        HIGH: 1,
        MEDIUM: 1,
        LOW: 0,
        UNKNOWN: 1
      }
    });

    expect(summary.routeCounts).toEqual([
      { route: "ROUTE_TO_DOCTOR", count: 2 },
      { route: "ESCALATE_EMERGENCY", count: 1 }
    ]);

    expect(summary.topRedFlags).toEqual([
      { flag: "fever", count: 2 },
      { flag: "chest pain", count: 1 },
      { flag: "shortness of breath", count: 1 }
    ]);
  });

  it("returns empty rankings when no cases have triage metadata", () => {
    const summary = buildTriageInsightsSummary({
      windowHours: 12,
      limit: 20,
      cases: [{ triage: null }]
    });

    expect(summary.totalCases).toBe(1);
    expect(summary.withTriage).toBe(0);
    expect(summary.routeCounts).toEqual([]);
    expect(summary.topRedFlags).toEqual([]);
  });
});
