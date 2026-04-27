import { describe, expect, it } from "vitest";
import { buildCaseTriageView } from "./caseTriageView.js";

describe("buildCaseTriageView", () => {
  it("returns parsed triage metadata when transcript is present", () => {
    const view = buildCaseTriageView({
      aiSummary: "AI triage summary",
      aiTranscript: JSON.stringify({
        version: 1,
        triageSource: "AI",
        triageSummary: "Possible emergency",
        triageConfidence: 0.91,
        triageRedFlags: ["chest pain"],
        baselineUrgency: 4,
        urgencyScore: 5,
        route: "ESCALATE_EMERGENCY"
      })
    });

    expect(view).toEqual({
      source: "AI",
      route: "ESCALATE_EMERGENCY",
      confidence: 0.91,
      redFlags: ["chest pain"],
      baselineUrgency: 4,
      urgencyScore: 5,
      summary: "Possible emergency",
      fallbackReason: null,
      safetyOverride: false,
      safetySignal: ""
    });
  });

  it("falls back to summary-only shape when transcript is missing", () => {
    const view = buildCaseTriageView({
      aiSummary: "HEURISTIC triage summary",
      aiTranscript: ""
    });

    expect(view).toEqual({
      source: "HEURISTIC",
      route: "",
      confidence: null,
      redFlags: [],
      baselineUrgency: null,
      urgencyScore: null,
      summary: "HEURISTIC triage summary",
      fallbackReason: null,
      safetyOverride: false,
      safetySignal: ""
    });
  });

  it("returns null when case has no triage metadata", () => {
    expect(buildCaseTriageView({ aiSummary: "", aiTranscript: "" })).toBeNull();
  });
});
