import { env } from "../../config/env.js";
import { enqueueRelayJob } from "../../queues/relayQueue.js";
import {
  relayDoctorMessageToWhatsApp,
  relayPatientMessageToWebex
} from "./relayService.js";

export type RelayDispatchResult = {
  dispatched: boolean;
  mode: "inline" | "queue";
  relayed?: boolean;
  queued?: boolean;
  jobId?: string;
  duplicate?: boolean;
  reason?: string;
};

export async function dispatchPatientToWebex(params: {
  caseId: string;
  patientPhone: string;
  text: string;
  relayKey?: string;
}): Promise<RelayDispatchResult> {
  if (env.RELAY_DISPATCH_MODE === "queue") {
    const queued = await enqueueRelayJob({
      type: "PATIENT_TO_WEBEX",
      caseId: params.caseId,
      patientPhone: params.patientPhone,
      text: params.text,
      relayKey: params.relayKey
    });

    if (queued.queued) {
      return {
        dispatched: true,
        mode: "queue",
        queued: true,
        jobId: queued.jobId,
        duplicate: Boolean(queued.duplicate)
      };
    }
  }

  const inline = await relayPatientMessageToWebex(params);
  return {
    dispatched: inline.relayed,
    mode: "inline",
    relayed: inline.relayed,
    reason: inline.relayed ? undefined : inline.reason
  };
}

export async function dispatchDoctorToWhatsApp(params: {
  caseId: string;
  doctorText: string;
  relayKey?: string;
}): Promise<RelayDispatchResult> {
  if (env.RELAY_DISPATCH_MODE === "queue") {
    const queued = await enqueueRelayJob({
      type: "DOCTOR_TO_WHATSAPP",
      caseId: params.caseId,
      doctorText: params.doctorText,
      relayKey: params.relayKey
    });

    if (queued.queued) {
      return {
        dispatched: true,
        mode: "queue",
        queued: true,
        jobId: queued.jobId,
        duplicate: Boolean(queued.duplicate)
      };
    }
  }

  const inline = await relayDoctorMessageToWhatsApp(params);
  return {
    dispatched: inline.relayed,
    mode: "inline",
    relayed: inline.relayed,
    reason: inline.relayed ? undefined : inline.reason
  };
}
