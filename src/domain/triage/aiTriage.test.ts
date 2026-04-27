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
    expect(result.fallbackReason).toBe("AI_DISABLED");
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
    expect(result.fallbackReason).toBeUndefined();
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
    expect(result.fallbackReason).toBe("AI_PROVIDER_ERROR");
  });

  it("falls back to heuristic triage on low-confidence AI responses", async () => {
    const provider: TriageAIProvider = {
      assess: vi.fn().mockResolvedValue({
        urgencyScore: 5,
        summary: "Possible emergency",
        redFlags: ["unsteady"],
        confidence: 0.21
      })
    };

    const result = await buildTriageAssessment({
      messageText: "I have a cough and headache",
      patientState: "OH",
      aiEnabled: true,
      provider
    });

    expect(provider.assess).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("HEURISTIC");
    expect(result.urgencyScore).toBe(3);
    expect(result.route).toBe("ROUTE_TO_DOCTOR");
    expect(result.fallbackReason).toBe("AI_LOW_CONFIDENCE");
  });

  it("forces emergency route on critical override keywords", async () => {
    const result = await buildTriageAssessment({
      messageText: "My friend is unconscious and not breathing well",
      patientState: "OH",
      aiEnabled: false
    });

    expect(result.source).toBe("HEURISTIC");
    expect(result.baselineUrgency).toBe(2);
    expect(result.urgencyScore).toBe(5);
    expect(result.route).toBe("ESCALATE_EMERGENCY");
    expect(result.safetyOverride).toBe(true);
    expect(result.safetySignal).toBe("unconscious");
  });
});
