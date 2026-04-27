import { describe, expect, it } from "vitest";
import { buildRelayJobId } from "./relayQueue.js";

describe("buildRelayJobId", () => {
  it("builds deterministic job id when relay key is present", () => {
    const id = buildRelayJobId({
      type: "PATIENT_TO_WEBEX",
      caseId: "case-1",
      patientPhone: "+15550001111",
      text: "hello",
      relayKey: "wamid-123"
    });

    expect(id).toBe("PATIENT_TO_WEBEX:case-1:wamid-123");
  });

  it("returns undefined when relay key is empty", () => {
    const id = buildRelayJobId({
      type: "DOCTOR_TO_WHATSAPP",
      caseId: "case-2",
      doctorText: "Doctor: keep hydrated",
      relayKey: "   "
    });

    expect(id).toBeUndefined();
  });
});
