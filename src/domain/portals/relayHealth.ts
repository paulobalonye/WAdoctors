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

export type RelayQueueAlertThresholds = {
  pendingWarning: number;
  pendingCritical: number;
  failedWarning: number;
  failedCritical: number;
  oldestFailedMinutesWarning: number;
  oldestFailedMinutesCritical: number;
};

const defaultRelayAlertThresholds: RelayQueueAlertThresholds = {
  pendingWarning: 20,
  pendingCritical: 50,
  failedWarning: 5,
  failedCritical: 10,
  oldestFailedMinutesWarning: 15,
  oldestFailedMinutesCritical: 60
};

export type RelayQueueAlert = {
  code: "QUEUE_UNREACHABLE" | "PENDING_BACKLOG" | "FAILED_BACKLOG" | "STALE_FAILED_JOB";
  severity: "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
};

export type RelayQueueHealthSummary = {
  dispatchMode: "inline" | "queue";
  redisConfigured: boolean;
  queueEnabled: boolean;
  queueReachable: boolean;
  reason?: string;
  oldestFailedAgeMinutes: number | null;
  alertState: "ok" | "warning" | "critical";
  alerts: RelayQueueAlert[];
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

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeThresholds(
  input?: Partial<RelayQueueAlertThresholds>
): RelayQueueAlertThresholds {
  const pendingWarning = normalizePositiveInt(input?.pendingWarning, defaultRelayAlertThresholds.pendingWarning);
  const pendingCritical = Math.max(
    pendingWarning,
    normalizePositiveInt(input?.pendingCritical, defaultRelayAlertThresholds.pendingCritical)
  );
  const failedWarning = normalizePositiveInt(input?.failedWarning, defaultRelayAlertThresholds.failedWarning);
  const failedCritical = Math.max(
    failedWarning,
    normalizePositiveInt(input?.failedCritical, defaultRelayAlertThresholds.failedCritical)
  );
  const oldestFailedMinutesWarning = normalizePositiveInt(
    input?.oldestFailedMinutesWarning,
    defaultRelayAlertThresholds.oldestFailedMinutesWarning
  );
  const oldestFailedMinutesCritical = Math.max(
    oldestFailedMinutesWarning,
    normalizePositiveInt(
      input?.oldestFailedMinutesCritical,
      defaultRelayAlertThresholds.oldestFailedMinutesCritical
    )
  );

  return {
    pendingWarning,
    pendingCritical,
    failedWarning,
    failedCritical,
    oldestFailedMinutesWarning,
    oldestFailedMinutesCritical
  };
}

function timestampToMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
}

function timestampToIso(value: unknown): string | null {
  const timestampMs = timestampToMs(value);
  if (!timestampMs) {
    return null;
  }

  const iso = new Date(timestampMs).toISOString();
  return iso;
}

export function buildRelayQueueHealthSummary(params: {
  dispatchMode: "inline" | "queue";
  redisConfigured: boolean;
  queueReachable: boolean;
  counts: Partial<RelayQueueCountFields>;
  failedJobs: RelayFailedJobInput[];
  reason?: string;
  thresholds?: Partial<RelayQueueAlertThresholds>;
  now?: Date;
}): RelayQueueHealthSummary {
  const waiting = normalizeCount(params.counts.waiting);
  const active = normalizeCount(params.counts.active);
  const delayed = normalizeCount(params.counts.delayed);
  const paused = normalizeCount(params.counts.paused);
  const failed = normalizeCount(params.counts.failed);
  const completed = normalizeCount(params.counts.completed);
  const totalPending = waiting + active + delayed;
  const nowMs = params.now instanceof Date ? params.now.getTime() : Date.now();
  const thresholds = normalizeThresholds(params.thresholds);
  const failedRecent = params.failedJobs.map((job) => {
    const finishedOnMs = timestampToMs(job.finishedOn);
    const createdOnMs = timestampToMs(job.timestamp);
    const failedAtMs = finishedOnMs ?? createdOnMs;
    const failedAt = failedAtMs ? new Date(failedAtMs).toISOString() : null;
    return {
      jobId: job.id?.trim() || "unknown",
      name: job.name || "UNKNOWN_JOB",
      failedReason: job.failedReason?.trim() || "Unknown failure",
      attemptsMade: normalizeCount(job.attemptsMade),
      failedAt,
      failedAtMs
    };
  });

  let oldestFailedAgeMinutes: number | null = null;
  for (const job of failedRecent) {
    if (!job.failedAtMs) {
      continue;
    }

    const ageMinutes = Math.max(0, Math.floor((nowMs - job.failedAtMs) / 60000));
    if (oldestFailedAgeMinutes == null || ageMinutes > oldestFailedAgeMinutes) {
      oldestFailedAgeMinutes = ageMinutes;
    }
  }

  const alerts: RelayQueueAlert[] = [];
  if (params.dispatchMode === "queue") {
    if (!params.queueReachable) {
      alerts.push({
        code: "QUEUE_UNREACHABLE",
        severity: "critical",
        message: params.reason?.trim() || "Relay queue is not reachable",
        value: 0,
        threshold: 1
      });
    } else {
      if (totalPending >= thresholds.pendingCritical) {
        alerts.push({
          code: "PENDING_BACKLOG",
          severity: "critical",
          message: `Pending relay jobs ${totalPending} reached critical threshold ${thresholds.pendingCritical}`,
          value: totalPending,
          threshold: thresholds.pendingCritical
        });
      } else if (totalPending >= thresholds.pendingWarning) {
        alerts.push({
          code: "PENDING_BACKLOG",
          severity: "warning",
          message: `Pending relay jobs ${totalPending} reached warning threshold ${thresholds.pendingWarning}`,
          value: totalPending,
          threshold: thresholds.pendingWarning
        });
      }

      if (failed >= thresholds.failedCritical) {
        alerts.push({
          code: "FAILED_BACKLOG",
          severity: "critical",
          message: `Failed relay jobs ${failed} reached critical threshold ${thresholds.failedCritical}`,
          value: failed,
          threshold: thresholds.failedCritical
        });
      } else if (failed >= thresholds.failedWarning) {
        alerts.push({
          code: "FAILED_BACKLOG",
          severity: "warning",
          message: `Failed relay jobs ${failed} reached warning threshold ${thresholds.failedWarning}`,
          value: failed,
          threshold: thresholds.failedWarning
        });
      }

      if (oldestFailedAgeMinutes != null) {
        if (oldestFailedAgeMinutes >= thresholds.oldestFailedMinutesCritical) {
          alerts.push({
            code: "STALE_FAILED_JOB",
            severity: "critical",
            message:
              `Oldest failed relay job is ${oldestFailedAgeMinutes} minutes old ` +
              `(critical threshold ${thresholds.oldestFailedMinutesCritical})`,
            value: oldestFailedAgeMinutes,
            threshold: thresholds.oldestFailedMinutesCritical
          });
        } else if (oldestFailedAgeMinutes >= thresholds.oldestFailedMinutesWarning) {
          alerts.push({
            code: "STALE_FAILED_JOB",
            severity: "warning",
            message:
              `Oldest failed relay job is ${oldestFailedAgeMinutes} minutes old ` +
              `(warning threshold ${thresholds.oldestFailedMinutesWarning})`,
            value: oldestFailedAgeMinutes,
            threshold: thresholds.oldestFailedMinutesWarning
          });
        }
      }
    }
  }

  const alertState = alerts.some((alert) => alert.severity === "critical")
    ? "critical"
    : alerts.some((alert) => alert.severity === "warning")
      ? "warning"
      : "ok";

  return {
    dispatchMode: params.dispatchMode,
    redisConfigured: params.redisConfigured,
    queueEnabled: params.dispatchMode === "queue",
    queueReachable: params.queueReachable,
    reason: params.reason,
    oldestFailedAgeMinutes,
    alertState,
    alerts,
    counts: {
      waiting,
      active,
      delayed,
      paused,
      failed,
      completed,
      totalPending
    },
    failedRecent: failedRecent.map((job) => ({
      jobId: job.jobId,
      name: job.name,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      failedAt: timestampToIso(job.failedAtMs)
    }))
  };
}

export function buildRelayQueueDisabledSummary(
  reason: string,
  thresholds?: Partial<RelayQueueAlertThresholds>
): RelayQueueHealthSummary {
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
    failedJobs: [],
    thresholds
  });
}
