import { describe, expect, it } from "vitest";
import { inferUrgencyFromText, routeOhioUrgentCareCase } from "./ohioUrgentCareRouting.js";

describe("ohio urgent care triage routing", () => {
  it("routes non-ohio users out of state", () => {
    expect(routeOhioUrgentCareCase({ patientState: "CA", urgencyScore: 3 })).toBe("OUT_OF_STATE");
  });

  it("escalates emergency-level urgency", () => {
    expect(routeOhioUrgentCareCase({ patientState: "OH", urgencyScore: 5 })).toBe("ESCALATE_EMERGENCY");
  });

  it("routes moderate urgency to a doctor", () => {
    expect(routeOhioUrgentCareCase({ patientState: "OH", urgencyScore: 3 })).toBe("ROUTE_TO_DOCTOR");
  });

  it("maps self-care for low urgency", () => {
    expect(routeOhioUrgentCareCase({ patientState: "OH", urgencyScore: 1 })).toBe("SEND_SELF_CARE");
  });
});

describe("urgency inference", () => {
  it("detects emergency symptom phrases", () => {
    expect(inferUrgencyFromText("I have chest pain and can't breathe")).toBe(5);
  });

  it("detects urgent symptom phrases", () => {
    expect(inferUrgencyFromText("high fever and severe pain")).toBe(4);
  });

  it("falls back to low urgency for non-empty generic text", () => {
    expect(inferUrgencyFromText("I feel unwell")).toBe(2);
  });
});
