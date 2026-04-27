export type RelayQueueJobAdapter = {
  id: string | null;
  name: string;
  caseId?: string | null;
  failedReason?: string | null;
  attemptsMade?: number | null;
  finishedOn?: number | null;
  timestamp?: number | null;
  getState: () => Promise<string>;
  retry: () => Promise<void>;
};

export type RelayQueueAdapter = {
  getJobById: (jobId: string) => Promise<RelayQueueJobAdapter | null>;
  getFailedJobs: (limit: number) => Promise<RelayQueueJobAdapter[]>;
  cleanFailed: (graceMs: number, limit: number) => Promise<string[]>;
};

function normalizeLimit(limit: number, min: number, max: number): number {
  if (!Number.isFinite(limit)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(limit), min), max);
}

function normalizeGraceSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.min(Math.floor(value), 7 * 24 * 60 * 60);
}

function toIsoTimestamp(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value).toISOString();
}

export async function retrySingleFailedRelayJob(adapter: RelayQueueAdapter, jobId: string) {
  const normalizedJobId = jobId.trim();
  const job = await adapter.getJobById(normalizedJobId);

  if (!job) {
    return {
      ok: false,
      jobId: normalizedJobId,
      retried: false,
      reason: "Relay job not found"
    };
  }

  const state = await job.getState();
  if (state !== "failed") {
    return {
      ok: false,
      jobId: normalizedJobId,
      retried: false,
      reason: `Relay job is ${state}, not failed`
    };
  }

  try {
    await job.retry();
    return {
      ok: true,
      jobId: normalizedJobId,
      retried: true
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Retry failed";
    return {
      ok: false,
      jobId: normalizedJobId,
      retried: false,
      reason
    };
  }
}

export async function retryRecentFailedRelayJobs(adapter: RelayQueueAdapter, limit: number) {
  const requestedLimit = normalizeLimit(limit, 1, 50);
  const jobs = await adapter.getFailedJobs(requestedLimit);
  const failures: Array<{ jobId: string; reason: string }> = [];
  let retried = 0;

  for (const job of jobs) {
    try {
      await job.retry();
      retried += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Retry failed";
      failures.push({
        jobId: job.id?.trim() || "unknown",
        reason
      });
    }
  }

  return {
    ok: failures.length === 0,
    requestedLimit,
    examined: jobs.length,
    retried,
    failed: failures.length,
    failures
  };
}

export async function retryRecentFailedRelayJobsByName(
  adapter: RelayQueueAdapter,
  params: {
    limit: number;
    name: string;
    caseId?: string;
  }
) {
  const requestedLimit = normalizeLimit(params.limit, 1, 50);
  const normalizedName = params.name.trim();
  const normalizedCaseId = params.caseId?.trim() || "";
  const jobs = await adapter.getFailedJobs(requestedLimit);
  const failures: Array<{ jobId: string; reason: string }> = [];
  let matched = 0;
  let retried = 0;

  for (const job of jobs) {
    if (job.name !== normalizedName) {
      continue;
    }
    if (normalizedCaseId && job.caseId?.trim() !== normalizedCaseId) {
      continue;
    }

    matched += 1;
    try {
      await job.retry();
      retried += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Retry failed";
      failures.push({
        jobId: job.id?.trim() || "unknown",
        reason
      });
    }
  }

  return {
    ok: failures.length === 0,
    requestedLimit,
    examined: jobs.length,
    matched,
    retried,
    failed: failures.length,
    failures
  };
}

export async function clearFailedRelayJobs(
  adapter: RelayQueueAdapter,
  params: {
    limit: number;
    graceSeconds: number;
  }
) {
  const limit = normalizeLimit(params.limit, 1, 200);
  const graceSeconds = normalizeGraceSeconds(params.graceSeconds);
  const graceMs = graceSeconds * 1000;
  const removedJobIds = await adapter.cleanFailed(graceMs, limit);

  return {
    ok: true,
    limit,
    graceSeconds,
    removedCount: removedJobIds.length,
    removedJobIds
  };
}

export async function listFailedRelayJobs(
  adapter: RelayQueueAdapter,
  params: {
    limit: number;
    name?: string;
    caseId?: string;
  }
) {
  const requestedLimit = normalizeLimit(params.limit, 1, 200);
  const normalizedName = params.name?.trim();
  const normalizedCaseId = params.caseId?.trim();
  const jobs = await adapter.getFailedJobs(requestedLimit);

  const filtered = jobs.filter((job) => {
    if (normalizedName && job.name !== normalizedName) {
      return false;
    }
    if (normalizedCaseId && job.caseId?.trim() !== normalizedCaseId) {
      return false;
    }
    return true;
  });

  return {
    requestedLimit,
    totalFetched: jobs.length,
    totalMatched: filtered.length,
    jobs: filtered
      .map((job) => ({
        jobId: job.id?.trim() || "unknown",
        name: job.name || "UNKNOWN_JOB",
        caseId: job.caseId?.trim() || "",
        failedReason: job.failedReason?.trim() || "Unknown failure",
        attemptsMade: normalizeLimit(Number(job.attemptsMade ?? 0), 0, 1_000_000),
        failedAt: toIsoTimestamp(job.finishedOn) ?? toIsoTimestamp(job.timestamp)
      }))
      .sort((a, b) => {
        const aMs = a.failedAt ? Date.parse(a.failedAt) : 0;
        const bMs = b.failedAt ? Date.parse(b.failedAt) : 0;
        return bMs - aMs;
      })
  };
}
