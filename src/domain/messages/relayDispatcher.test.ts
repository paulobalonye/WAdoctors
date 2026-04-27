import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { dispatchDoctorToWhatsApp, dispatchPatientToWebex } from "./relayDispatcher.js";
import { enqueueRelayJob } from "../../queues/relayQueue.js";
import { relayDoctorMessageToWhatsApp, relayPatientMessageToWebex } from "./relayService.js";

vi.mock("../../queues/relayQueue.js", () => ({
  enqueueRelayJob: vi.fn()
}));

vi.mock("./relayService.js", () => ({
  relayPatientMessageToWebex: vi.fn(),
  relayDoctorMessageToWhatsApp: vi.fn()
}));

const originalDispatchMode = env.RELAY_DISPATCH_MODE;

afterEach(() => {
  (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = originalDispatchMode;
  vi.clearAllMocks();
});

describe("dispatchPatientToWebex", () => {
  it("enqueues relay jobs in queue mode with relay key", async () => {
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "queue";
    const enqueueMock = vi.mocked(enqueueRelayJob);
    enqueueMock.mockResolvedValue({
      queued: true,
      jobId: "job-123",
      duplicate: false
    });

    const result = await dispatchPatientToWebex({
      caseId: "case-1",
      patientPhone: "+15550001111",
      text: "hello doctor",
      relayKey: "wamid-123"
    });

    expect(enqueueMock).toHaveBeenCalledWith({
      type: "PATIENT_TO_WEBEX",
      caseId: "case-1",
      patientPhone: "+15550001111",
      text: "hello doctor",
      relayKey: "wamid-123"
    });
    expect(result).toEqual({
      dispatched: true,
      mode: "queue",
      queued: true,
      jobId: "job-123",
      duplicate: false
    });
    expect(vi.mocked(relayPatientMessageToWebex)).not.toHaveBeenCalled();
  });

  it("falls back to inline relay when queue enqueue fails", async () => {
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "queue";
    const enqueueMock = vi.mocked(enqueueRelayJob);
    const inlineMock = vi.mocked(relayPatientMessageToWebex);
    enqueueMock.mockResolvedValue({
      queued: false,
      reason: "queue unavailable"
    });
    inlineMock.mockResolvedValue({
      relayed: true,
      roomId: "room-2",
      messageId: "message-2"
    });

    const result = await dispatchPatientToWebex({
      caseId: "case-2",
      patientPhone: "+15550002222",
      text: "still waiting"
    });

    expect(result).toMatchObject({
      dispatched: true,
      mode: "inline",
      relayed: true
    });
    expect(inlineMock).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchDoctorToWhatsApp", () => {
  it("enqueues doctor relay jobs in queue mode with relay key", async () => {
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "queue";
    const enqueueMock = vi.mocked(enqueueRelayJob);
    enqueueMock.mockResolvedValue({
      queued: true,
      jobId: "job-doctor-1",
      duplicate: true
    });

    const result = await dispatchDoctorToWhatsApp({
      caseId: "case-3",
      doctorText: "Doctor: hydrate and rest",
      relayKey: "webex-message-1"
    });

    expect(enqueueMock).toHaveBeenCalledWith({
      type: "DOCTOR_TO_WHATSAPP",
      caseId: "case-3",
      doctorText: "Doctor: hydrate and rest",
      relayKey: "webex-message-1"
    });
    expect(result).toEqual({
      dispatched: true,
      mode: "queue",
      queued: true,
      jobId: "job-doctor-1",
      duplicate: true
    });
    expect(vi.mocked(relayDoctorMessageToWhatsApp)).not.toHaveBeenCalled();
  });
});
