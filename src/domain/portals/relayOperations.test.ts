import { describe, expect, it, vi } from "vitest";
import {
  clearFailedRelayJobs,
  listFailedRelayJobs,
  retryRecentFailedRelayJobsByName,
  retryRecentFailedRelayJobs,
  retrySingleFailedRelayJob,
  type RelayQueueAdapter
} from "./relayOperations.js";

function buildFailedJob(params: {
  id: string;
  caseId?: string;
  state?: string;
  retryImpl?: () => Promise<void>;
}) {
  const retry = vi.fn(async () => {
    if (params.retryImpl) {
      await params.retryImpl();
    }
  });

  return {
    id: params.id,
    name: "PATIENT_TO_WEBEX",
    caseId: params.caseId ?? "case-default",
    failedReason: "No Webex room configured",
    attemptsMade: 3,
    finishedOn: 1710000000000,
    timestamp: 1709000000000,
    getState: vi.fn(async () => params.state ?? "failed"),
    retry
  };
}

describe("retrySingleFailedRelayJob", () => {
  it("returns not found when job id does not exist", async () => {
    const adapter: RelayQueueAdapter = {
      getJobById: async () => null,
      getFailedJobs: async () => [],
      cleanFailed: async () => []
    };

    const result = await retrySingleFailedRelayJob(adapter, "missing-job");

    expect(result).toEqual({
      ok: false,
      jobId: "missing-job",
      retried: false,
      reason: "Relay job not found"
    });
  });

  it("retries only failed jobs", async () => {
    const queuedJob = buildFailedJob({ id: "job-1", state: "active" });
    const adapter: RelayQueueAdapter = {
      getJobById: async () => queuedJob,
      getFailedJobs: async () => [],
      cleanFailed: async () => []
    };

    const result = await retrySingleFailedRelayJob(adapter, "job-1");

    expect(result.ok).toBe(false);
    expect(result.retried).toBe(false);
    expect(result.reason).toContain("not failed");
    expect(queuedJob.retry).not.toHaveBeenCalled();
  });
});

describe("retryRecentFailedRelayJobs", () => {
  it("retries recent failed jobs and reports failures", async () => {
    const first = buildFailedJob({ id: "job-1" });
    const second = buildFailedJob({
      id: "job-2",
      retryImpl: async () => {
        throw new Error("retry failed");
      }
    });

    const adapter: RelayQueueAdapter = {
      getJobById: async () => null,
      getFailedJobs: async () => [first, second],
      cleanFailed: async () => []
    };

    const result = await retryRecentFailedRelayJobs(adapter, 10);

    expect(result.ok).toBe(false);
    expect(result.requestedLimit).toBe(10);
    expect(result.examined).toBe(2);
    expect(result.retried).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([
      {
        jobId: "job-2",
        reason: "retry failed"
      }
    ]);
  });
});

describe("retryRecentFailedRelayJobsByName", () => {
  it("retries only matching failed jobs and ignores others", async () => {
    const webexJob = buildFailedJob({ id: "job-webex", caseId: "case-1" });
    const whatsappJob = {
      ...buildFailedJob({ id: "job-whatsapp", caseId: "case-1" }),
      name: "DOCTOR_TO_WHATSAPP"
    };

    const adapter: RelayQueueAdapter = {
      getJobById: async () => null,
      getFailedJobs: async () => [webexJob, whatsappJob],
      cleanFailed: async () => []
    };

    const result = await retryRecentFailedRelayJobsByName(adapter, {
      limit: 20,
      name: "PATIENT_TO_WEBEX"
    });

    expect(result.ok).toBe(true);
    expect(result.requestedLimit).toBe(20);
    expect(result.examined).toBe(2);
    expect(result.matched).toBe(1);
    expect(result.retried).toBe(1);
    expect(result.failed).toBe(0);
    expect(webexJob.retry).toHaveBeenCalledTimes(1);
    expect(whatsappJob.retry).not.toHaveBeenCalled();
  });

  it("supports optional caseId filtering for targeted retries", async () => {
    const targetCaseJob = buildFailedJob({ id: "job-target", caseId: "case-target" });
    const otherCaseJob = buildFailedJob({ id: "job-other", caseId: "case-other" });

    const adapter: RelayQueueAdapter = {
      getJobById: async () => null,
      getFailedJobs: async () => [targetCaseJob, otherCaseJob],
      cleanFailed: async () => []
    };

    const result = await retryRecentFailedRelayJobsByName(adapter, {
      limit: 20,
      name: "PATIENT_TO_WEBEX",
      caseId: "case-target"
    });

    expect(result.ok).toBe(true);
    expect(result.examined).toBe(2);
    expect(result.matched).toBe(1);
    expect(result.retried).toBe(1);
    expect(result.failed).toBe(0);
    expect(targetCaseJob.retry).toHaveBeenCalledTimes(1);
    expect(otherCaseJob.retry).not.toHaveBeenCalled();
  });
});

describe("clearFailedRelayJobs", () => {
  it("passes normalized grace/limit to adapter clean and returns removed ids", async () => {
    const cleanFailed = vi.fn(async (graceMs: number, limit: number) => {
      expect(graceMs).toBe(30000);
      expect(limit).toBe(12);
      return ["job-7", "job-8"];
    });

    const adapter: RelayQueueAdapter = {
      getJobById: async () => null,
      getFailedJobs: async () => [],
      cleanFailed
    };

    const result = await clearFailedRelayJobs(adapter, {
      limit: 12,
      graceSeconds: 30
    });

    expect(result).toEqual({
      ok: true,
      limit: 12,
      graceSeconds: 30,
      removedCount: 2,
      removedJobIds: ["job-7", "job-8"]
    });
  });
});

describe("listFailedRelayJobs", () => {
  it("filters by name and caseId when provided", async () => {
    const matchingJob = buildFailedJob({ id: "job-1", caseId: "case-1" });
    const otherNameJob = {
      ...buildFailedJob({ id: "job-2", caseId: "case-1" }),
      name: "DOCTOR_TO_WHATSAPP"
    };
    const otherCaseJob = buildFailedJob({ id: "job-3", caseId: "case-2" });

    const adapter: RelayQueueAdapter = {
      getJobById: async () => null,
      getFailedJobs: async () => [matchingJob, otherNameJob, otherCaseJob],
      cleanFailed: async () => []
    };

    const result = await listFailedRelayJobs(adapter, {
      limit: 10,
      name: "PATIENT_TO_WEBEX",
      caseId: "case-1"
    });

    expect(result.requestedLimit).toBe(10);
    expect(result.totalFetched).toBe(3);
    expect(result.totalMatched).toBe(1);
    expect(result.jobs).toEqual([
      {
        jobId: "job-1",
        name: "PATIENT_TO_WEBEX",
        caseId: "case-1",
        failedReason: "No Webex room configured",
        attemptsMade: 3,
        failedAt: "2024-03-09T16:00:00.000Z"
      }
    ]);
  });

  it("orders matched failed jobs by most recent failure first", async () => {
    const older = {
      ...buildFailedJob({ id: "job-old", caseId: "case-1" }),
      finishedOn: 1700000000000
    };
    const newer = {
      ...buildFailedJob({ id: "job-new", caseId: "case-1" }),
      finishedOn: 1710000000000
    };

    const adapter: RelayQueueAdapter = {
      getJobById: async () => null,
      getFailedJobs: async () => [older, newer],
      cleanFailed: async () => []
    };

    const result = await listFailedRelayJobs(adapter, {
      limit: 10,
      name: "PATIENT_TO_WEBEX"
    });

    expect(result.jobs.map((item) => item.jobId)).toEqual(["job-new", "job-old"]);
  });
});
