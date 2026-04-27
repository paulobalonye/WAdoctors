import { describe, expect, it } from "vitest";
import { buildInitialCaseSummary } from "./workspaceService.js";

describe("buildInitialCaseSummary", () => {
  it("includes normalized triage metadata when transcript is present", () => {
    const summary = buildInitialCaseSummary({
      caseId: "case-1234",
      patientPhone: "+15550001111",
      complaint: "Chest pain and dizziness",
      urgencyScore: 5,
      aiSummary: "AI triage summary",
      aiTranscript: JSON.stringify({
        version: 1,
        triageSource: "AI",
        triageSummary: "Possible acute cardiac event.",
        triageConfidence: 0.93,
        triageRedFlags: ["chest pain", "dizziness"],
        baselineUrgency: 4,
        urgencyScore: 5,
        route: "ESCALATE_EMERGENCY"
      })
    });

    expect(summary).toContain("Triage Source: AI");
    expect(summary).toContain("Triage Route: ESCALATE_EMERGENCY");
    expect(summary).toContain("Triage Confidence: 93%");
    expect(summary).toContain("Triage Red Flags: chest pain, dizziness");
    expect(summary).toContain("Triage Summary: Possible acute cardiac event.");
  });

  it("falls back to aiSummary note when transcript is missing", () => {
    const summary = buildInitialCaseSummary({
      caseId: "case-5555",
      patientPhone: "+15550002222",
      complaint: "Headache",
      urgencyScore: 2,
      aiSummary: "HEURISTIC triage | urgency 2/5 ...",
      aiTranscript: ""
    });

    expect(summary).toContain("Triage Note: HEURISTIC triage | urgency 2/5 ...");
  });
});
