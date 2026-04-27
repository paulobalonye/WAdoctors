import { describe, expect, it } from "vitest";
import { buildCaseTriageStorage, parseCaseTriageStorage } from "./triageStorage.js";

describe("buildCaseTriageStorage", () => {
  it("builds summary + transcript from workflow triage metadata", () => {
    const storage = buildCaseTriageStorage({
      triageSource: "AI",
      triageSummary: "Possible respiratory distress pattern.",
      triageConfidence: 0.82,
      triageRedFlags: ["shortness of breath", "chest tightness"],
      baselineUrgency: 4,
      urgencyScore: 5,
      route: "ESCALATE_EMERGENCY"
    });

    expect(storage.aiSummary).toContain("AI triage");
    expect(storage.aiSummary).toContain("urgency 5/5");
    expect(storage.aiSummary).toContain("baseline 4/5");
    expect(storage.aiSummary).toContain("route ESCALATE_EMERGENCY");

    const parsed = parseCaseTriageStorage(storage.aiTranscript);
    expect(parsed).toEqual({
      version: 1,
      triageSource: "AI",
      triageSummary: "Possible respiratory distress pattern.",
      triageConfidence: 0.82,
      triageRedFlags: ["shortness of breath", "chest tightness"],
      baselineUrgency: 4,
      urgencyScore: 5,
      route: "ESCALATE_EMERGENCY"
    });
  });

  it("normalizes malformed transcript values", () => {
    const parsed = parseCaseTriageStorage(
      JSON.stringify({
        version: 9,
        triageSource: "UNKNOWN",
        triageSummary: "  ",
        triageConfidence: 4,
        triageRedFlags: ["  ", "fainting", "fainting"],
        baselineUrgency: -2,
        urgencyScore: 99,
        route: "MISSING"
      })
    );

    expect(parsed).toEqual({
      version: 1,
      triageSource: "HEURISTIC",
      triageSummary: "",
      triageConfidence: 1,
      triageRedFlags: ["fainting"],
      baselineUrgency: 1,
      urgencyScore: 5,
      route: "ROUTE_TO_DOCTOR"
    });
  });

  it("returns null for invalid transcript JSON", () => {
    expect(parseCaseTriageStorage("not-json")).toBeNull();
  });

  it("stores fallback and safety override metadata when provided", () => {
    const storage = buildCaseTriageStorage({
      triageSource: "HEURISTIC",
      triageSummary: "AI fallback to heuristic: low confidence (24%)",
      triageConfidence: 0.55,
      triageRedFlags: ["unconscious"],
      baselineUrgency: 2,
      urgencyScore: 5,
      route: "ESCALATE_EMERGENCY",
      triageFallbackReason: "AI_LOW_CONFIDENCE",
      triageSafetyOverride: true,
      triageSafetySignal: "unconscious"
    });

    expect(storage.aiSummary).toContain("fallback: AI_LOW_CONFIDENCE");
    expect(storage.aiSummary).toContain("safety override: unconscious");

    const parsed = parseCaseTriageStorage(storage.aiTranscript);
    expect(parsed).toMatchObject({
      triageFallbackReason: "AI_LOW_CONFIDENCE",
      triageSafetyOverride: true,
      triageSafetySignal: "unconscious"
    });
  });
});
