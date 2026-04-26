import { Queue, Worker, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import {
  relayDoctorMessageToWhatsApp,
  relayPatientMessageToWebex
} from "../domain/messages/relayService.js";

export type RelayJobData =
  | {
      type: "PATIENT_TO_WEBEX";
      caseId: string;
      patientPhone: string;
      text: string;
    }
  | {
      type: "DOCTOR_TO_WHATSAPP";
      caseId: string;
      doctorText: string;
    };

const RELAY_QUEUE_NAME = "relay-jobs";

let relayConnection: Redis | null = null;
let relayQueue: Queue<RelayJobData> | null = null;

function getRelayConnection(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!relayConnection) {
    relayConnection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null
    });
  }

  return relayConnection;
}

export function getRelayQueue(): Queue<RelayJobData> | null {
  const connection = getRelayConnection();
  if (!connection) {
    return null;
  }

  if (!relayQueue) {
    relayQueue = new Queue<RelayJobData>(RELAY_QUEUE_NAME, {
      connection
    });
  }

  return relayQueue;
}

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 1000
  },
  removeOnComplete: 1000,
  removeOnFail: 1000
};

export async function enqueueRelayJob(data: RelayJobData) {
  const queue = getRelayQueue();
  if (!queue) {
    return {
      queued: false,
      reason: "REDIS_URL not configured"
    };
  }

  const job = await queue.add(data.type, data, defaultJobOptions);
  return {
    queued: true,
    jobId: String(job.id)
  };
}

export function createRelayWorker(): Worker<RelayJobData> | null {
  const connection = getRelayConnection();
  if (!connection) {
    return null;
  }

  return new Worker<RelayJobData>(
    RELAY_QUEUE_NAME,
    async (job) => {
      if (job.data.type === "PATIENT_TO_WEBEX") {
        const result = await relayPatientMessageToWebex({
          caseId: job.data.caseId,
          patientPhone: job.data.patientPhone,
          text: job.data.text
        });

        if (!result.relayed) {
          throw new Error(result.reason ?? "Patient->Webex relay failed");
        }
        return result;
      }

      const result = await relayDoctorMessageToWhatsApp({
        caseId: job.data.caseId,
        doctorText: job.data.doctorText
      });

      if (!result.relayed) {
        throw new Error(result.reason ?? "Doctor->WhatsApp relay failed");
      }
      return result;
    },
    {
      connection
    }
  );
}
