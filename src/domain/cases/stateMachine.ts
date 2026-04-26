import { CaseStatus } from "@prisma/client";

const allowedTransitions: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.NEW]: [CaseStatus.TRIAGING, CaseStatus.ESCALATED],
  [CaseStatus.TRIAGING]: [CaseStatus.ASSIGNED, CaseStatus.ESCALATED, CaseStatus.COMPLETED],
  [CaseStatus.ASSIGNED]: [CaseStatus.IN_PROGRESS, CaseStatus.ESCALATED],
  [CaseStatus.IN_PROGRESS]: [CaseStatus.COMPLETED, CaseStatus.ESCALATED],
  [CaseStatus.COMPLETED]: [],
  [CaseStatus.ESCALATED]: [CaseStatus.IN_PROGRESS, CaseStatus.COMPLETED]
};

export function canTransitionCaseStatus(from: CaseStatus, to: CaseStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertCaseStatusTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransitionCaseStatus(from, to)) {
    throw new Error(`Invalid case status transition: ${from} -> ${to}`);
  }
}

export function applyCaseStatusTransition(from: CaseStatus, to: CaseStatus): CaseStatus {
  assertCaseStatusTransition(from, to);
  return to;
}
