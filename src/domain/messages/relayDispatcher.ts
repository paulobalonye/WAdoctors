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
  reason?: string;
};

export async function dispatchPatientToWebex(params: {
  caseId: string;
  patientPhone: string;
  text: string;
}): Promise<RelayDispatchResult> {
  if (env.RELAY_DISPATCH_MODE === "queue") {
    const queued = await enqueueRelayJob({
      type: "PATIENT_TO_WEBEX",
      caseId: params.caseId,
      patientPhone: params.patientPhone,
      text: params.text
    });

    if (queued.queued) {
      return {
        dispatched: true,
        mode: "queue",
        queued: true,
        jobId: queued.jobId
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
}): Promise<RelayDispatchResult> {
  if (env.RELAY_DISPATCH_MODE === "queue") {
    const queued = await enqueueRelayJob({
      type: "DOCTOR_TO_WHATSAPP",
      caseId: params.caseId,
      doctorText: params.doctorText
    });

    if (queued.queued) {
      return {
        dispatched: true,
        mode: "queue",
        queued: true,
        jobId: queued.jobId
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
