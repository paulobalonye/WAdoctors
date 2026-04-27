import { describe, expect, it, vi } from "vitest";
import { buildTriageAssessment, type TriageAIProvider } from "./aiTriage.js";

describe("buildTriageAssessment", () => {
  it("falls back to heuristic triage when AI is disabled", async () => {
    const result = await buildTriageAssessment({
      messageText: "I have a cough and sore throat",
      patientState: "OH",
      aiEnabled: false
    });

    expect(result.source).toBe("HEURISTIC");
    expect(result.urgencyScore).toBe(3);
    expect(result.route).toBe("ROUTE_TO_DOCTOR");
  });

  it("uses AI assessment and keeps higher urgency than baseline", async () => {
    const provider: TriageAIProvider = {
      assess: vi.fn().mockResolvedValue({
        urgencyScore: 1,
        summary: "Low urgency per AI",
        redFlags: ["none"],
        confidence: 0.72
      })
    };

    const result = await buildTriageAssessment({
      messageText: "I'm having chest pain and can't breathe",
      patientState: "OH",
      aiEnabled: true,
      provider
    });

    expect(provider.assess).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("AI");
    expect(result.baselineUrgency).toBe(5);
    expect(result.urgencyScore).toBe(5);
    expect(result.route).toBe("ESCALATE_EMERGENCY");
    expect(result.summary).toBe("Low urgency per AI");
    expect(result.confidence).toBeCloseTo(0.72);
  });

  it("falls back to heuristic triage when provider fails", async () => {
    const provider: TriageAIProvider = {
      assess: vi.fn().mockRejectedValue(new Error("provider unavailable"))
    };

    const result = await buildTriageAssessment({
      messageText: "Severe vomiting for two days",
      patientState: "OH",
      aiEnabled: true,
      provider
    });

    expect(provider.assess).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("HEURISTIC");
    expect(result.urgencyScore).toBe(4);
    expect(result.route).toBe("ROUTE_TO_DOCTOR");
  });
});
