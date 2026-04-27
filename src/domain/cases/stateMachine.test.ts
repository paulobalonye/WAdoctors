import { CaseStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { applyCaseStatusTransition, canTransitionCaseStatus } from "./stateMachine.js";

describe("case status state machine", () => {
  it("allows a valid transition", () => {
    expect(canTransitionCaseStatus(CaseStatus.NEW, CaseStatus.TRIAGING)).toBe(true);
    expect(applyCaseStatusTransition(CaseStatus.NEW, CaseStatus.TRIAGING)).toBe(CaseStatus.TRIAGING);
  });

  it("rejects an invalid transition", () => {
    expect(canTransitionCaseStatus(CaseStatus.NEW, CaseStatus.COMPLETED)).toBe(false);
    expect(() => applyCaseStatusTransition(CaseStatus.NEW, CaseStatus.COMPLETED)).toThrow(
      "Invalid case status transition"
    );
  });
});
