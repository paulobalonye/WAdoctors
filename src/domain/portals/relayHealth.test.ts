import { describe, expect, it } from "vitest";
import { buildRelayQueueHealthSummary } from "./relayHealth.js";

describe("buildRelayQueueHealthSummary", () => {
  it("returns queue-disabled state when dispatch mode is inline", () => {
    const summary = buildRelayQueueHealthSummary({
      dispatchMode: "inline",
      redisConfigured: true,
      queueReachable: false,
      reason: "Relay queue disabled because dispatch mode is inline",
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

    expect(summary).toMatchObject({
      dispatchMode: "inline",
      redisConfigured: true,
      queueEnabled: false,
      queueReachable: false,
      reason: "Relay queue disabled because dispatch mode is inline",
      alertState: "ok",
      alerts: []
    });
    expect(summary.counts.totalPending).toBe(0);
    expect(summary.failedRecent).toEqual([]);
  });

  it("calculates pending totals and normalizes failed job records", () => {
    const summary = buildRelayQueueHealthSummary({
      dispatchMode: "queue",
      redisConfigured: true,
      queueReachable: true,
      counts: {
        waiting: 2,
        active: 1,
        delayed: 3,
        paused: 0,
        failed: 4,
        completed: 9
      },
      failedJobs: [
        {
          id: "job-1",
          name: "PATIENT_TO_WEBEX",
          failedReason: "No Webex room configured",
          attemptsMade: 5,
          finishedOn: 1710000000000,
          timestamp: 1709000000000
        },
        {
          id: null,
          name: "DOCTOR_TO_WHATSAPP",
          failedReason: "WhatsApp token missing",
          attemptsMade: 1,
          finishedOn: null,
          timestamp: 1708000000000
        }
      ],
      thresholds: {
        pendingWarning: 100,
        pendingCritical: 200,
        failedWarning: 100,
        failedCritical: 200,
        oldestFailedMinutesWarning: 100000,
        oldestFailedMinutesCritical: 200000
      },
      now: new Date("2024-03-10T00:00:00.000Z")
    });

    expect(summary.counts).toMatchObject({
      waiting: 2,
      active: 1,
      delayed: 3,
      paused: 0,
      failed: 4,
      completed: 9,
      totalPending: 6
    });

    expect(summary.failedRecent).toEqual([
      {
        jobId: "job-1",
        name: "PATIENT_TO_WEBEX",
        failedReason: "No Webex room configured",
        attemptsMade: 5,
        failedAt: "2024-03-09T16:00:00.000Z"
      },
      {
        jobId: "unknown",
        name: "DOCTOR_TO_WHATSAPP",
        failedReason: "WhatsApp token missing",
        attemptsMade: 1,
        failedAt: "2024-02-15T12:26:40.000Z"
      }
    ]);
    expect(summary.alertState).toBe("ok");
    expect(summary.alerts).toEqual([]);
  });

  it("emits warning alerts when queue backlog and stale failures cross warning thresholds", () => {
    const now = new Date("2026-04-28T12:00:00.000Z");
    const summary = buildRelayQueueHealthSummary({
      dispatchMode: "queue",
      redisConfigured: true,
      queueReachable: true,
      counts: {
        waiting: 12,
        active: 5,
        delayed: 4,
        paused: 0,
        failed: 6,
        completed: 20
      },
      failedJobs: [
        {
          id: "job-2",
          name: "PATIENT_TO_WEBEX",
          failedReason: "Provider timeout",
          attemptsMade: 3,
          finishedOn: Date.parse("2026-04-28T11:30:00.000Z")
        }
      ],
      now
    });

    expect(summary.alertState).toBe("warning");
    expect(summary.alerts).toEqual([
      expect.objectContaining({
        code: "PENDING_BACKLOG",
        severity: "warning"
      }),
      expect.objectContaining({
        code: "FAILED_BACKLOG",
        severity: "warning"
      }),
      expect.objectContaining({
        code: "STALE_FAILED_JOB",
        severity: "warning"
      })
    ]);
    expect(summary.oldestFailedAgeMinutes).toBe(30);
  });

  it("emits critical alerts when queue is unreachable", () => {
    const summary = buildRelayQueueHealthSummary({
      dispatchMode: "queue",
      redisConfigured: true,
      queueReachable: false,
      reason: "Redis connection timeout",
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

    expect(summary.alertState).toBe("critical");
    expect(summary.alerts).toEqual([
      expect.objectContaining({
        code: "QUEUE_UNREACHABLE",
        severity: "critical"
      })
    ]);
  });
});
