import { env } from "../../config/env.js";

type RelayQueueCountFields = {
  waiting: number;
  active: number;
  delayed: number;
  paused: number;
  failed: number;
  completed: number;
};

type RelayFailedJobInput = {
  id: string | null;
  name: string;
  failedReason?: string | null;
  attemptsMade?: number | null;
  finishedOn?: number | null;
  timestamp?: number | null;
};

export type RelayQueueHealthSummary = {
  dispatchMode: "inline" | "queue";
  redisConfigured: boolean;
  queueEnabled: boolean;
  queueReachable: boolean;
  reason?: string;
  counts: RelayQueueCountFields & {
    totalPending: number;
  };
  failedRecent: Array<{
    jobId: string;
    name: string;
    failedReason: string;
    attemptsMade: number;
    failedAt: string | null;
  }>;
};

function normalizeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function timestampToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const iso = new Date(value).toISOString();
  return iso;
}

export function buildRelayQueueHealthSummary(params: {
  dispatchMode: "inline" | "queue";
  redisConfigured: boolean;
  queueReachable: boolean;
  counts: Partial<RelayQueueCountFields>;
  failedJobs: RelayFailedJobInput[];
  reason?: string;
}): RelayQueueHealthSummary {
  const waiting = normalizeCount(params.counts.waiting);
  const active = normalizeCount(params.counts.active);
  const delayed = normalizeCount(params.counts.delayed);
  const paused = normalizeCount(params.counts.paused);
  const failed = normalizeCount(params.counts.failed);
  const completed = normalizeCount(params.counts.completed);
  const totalPending = waiting + active + delayed;

  return {
    dispatchMode: params.dispatchMode,
    redisConfigured: params.redisConfigured,
    queueEnabled: params.dispatchMode === "queue",
    queueReachable: params.queueReachable,
    reason: params.reason,
    counts: {
      waiting,
      active,
      delayed,
      paused,
      failed,
      completed,
      totalPending
    },
    failedRecent: params.failedJobs.map((job) => {
      const failedAt = timestampToIso(job.finishedOn) ?? timestampToIso(job.timestamp);
      return {
        jobId: job.id?.trim() || "unknown",
        name: job.name || "UNKNOWN_JOB",
        failedReason: job.failedReason?.trim() || "Unknown failure",
        attemptsMade: normalizeCount(job.attemptsMade),
        failedAt
      };
    })
  };
}

export function buildRelayQueueDisabledSummary(reason: string): RelayQueueHealthSummary {
  return buildRelayQueueHealthSummary({
    dispatchMode: env.RELAY_DISPATCH_MODE,
    redisConfigured: Boolean(env.REDIS_URL),
    queueReachable: false,
    reason,
    counts: {
      waiting: 0,
      active: 0,
      delayed: 0,
      paused: 0,
      failed: 0,
      completed: 0
    },
    failedJobs: []
  });
}
