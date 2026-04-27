import { describe, expect, it, vi } from "vitest";
import { buildWhatsAppWorkflowPreview, buildWhatsAppWorkflowPreviewWithAI } from "./whatsappWorkflow.js";

describe("buildWhatsAppWorkflowPreview", () => {
  it("builds heuristic route metadata for ohio urgent messages", () => {
    const result = buildWhatsAppWorkflowPreview({
      messageText: "I have a fever and severe pain in my throat",
      patientState: "OH"
    });

    expect(result.triageSource).toBe("HEURISTIC");
    expect(result.route).toBe("ROUTE_TO_DOCTOR");
    expect(result.baselineUrgency).toBe(result.urgencyScore);
    expect(result.triageSafetyOverride).toBe(false);
    expect(result.finalStatus).toBe("ASSIGNED");
    expect(result.transitions.map((item) => item.to)).toEqual(["TRIAGING", "ASSIGNED"]);
  });
});

describe("buildWhatsAppWorkflowPreviewWithAI", () => {
  it("uses AI assessment and keeps state transitions aligned to route", async () => {
    const provider = {
      assess: vi.fn().mockResolvedValue({
        urgencyScore: 5,
        summary: "Possible emergency indicators.",
        redFlags: ["shortness of breath"],
        confidence: 0.88
      })
    };

    const result = await buildWhatsAppWorkflowPreviewWithAI({
      messageText: "Trouble breathing with chest pressure",
      patientState: "OH",
      aiEnabled: true,
      provider
    });

    expect(provider.assess).toHaveBeenCalledTimes(1);
    expect(result.triageSource).toBe("AI");
    expect(result.route).toBe("ESCALATE_EMERGENCY");
    expect(result.finalStatus).toBe("ESCALATED");
    expect(result.triageRedFlags).toEqual(["shortness of breath"]);
    expect(result.triageFallbackReason).toBeUndefined();
    expect(result.triageSafetyOverride).toBe(false);
    expect(result.transitions.map((item) => item.to)).toEqual(["TRIAGING", "ESCALATED"]);
  });

  it("falls back to heuristic metadata when AI provider fails", async () => {
    const provider = {
      assess: vi.fn().mockRejectedValue(new Error("provider failed"))
    };

    const result = await buildWhatsAppWorkflowPreviewWithAI({
      messageText: "Mild headache",
      patientState: "OH",
      aiEnabled: true,
      provider
    });

    expect(provider.assess).toHaveBeenCalledTimes(1);
    expect(result.triageSource).toBe("HEURISTIC");
    expect(result.triageFallbackReason).toBe("AI_PROVIDER_ERROR");
    expect(result.triageSafetyOverride).toBe(false);
    expect(result.transitions[0]?.to).toBe("TRIAGING");
  });
});
