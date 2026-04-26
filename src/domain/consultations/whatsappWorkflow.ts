import { CaseStatus } from "@prisma/client";
import { applyCaseStatusTransition } from "../cases/stateMachine.js";
import {
  inferUrgencyFromText,
  routeOhioUrgentCareCase,
  type OhioUrgentCareRoute
} from "../triage/ohioUrgentCareRouting.js";

export type WorkflowTransition = {
  from: CaseStatus;
  to: CaseStatus;
  reason: string;
};

export type WhatsAppWorkflowPreview = {
  urgencyScore: number;
  route: OhioUrgentCareRoute;
  finalStatus: CaseStatus;
  transitions: WorkflowTransition[];
};

function pushTransition(
  transitions: WorkflowTransition[],
  current: CaseStatus,
  target: CaseStatus,
  reason: string
): CaseStatus {
  const next = applyCaseStatusTransition(current, target);
  transitions.push({ from: current, to: next, reason });
  return next;
}

export function buildWhatsAppWorkflowPreview(params: {
  messageText: string;
  patientState: string;
}): WhatsAppWorkflowPreview {
  const urgencyScore = inferUrgencyFromText(params.messageText);
  const route = routeOhioUrgentCareCase({
    urgencyScore,
    patientState: params.patientState
  });

  const transitions: WorkflowTransition[] = [];
  let currentStatus: CaseStatus = CaseStatus.NEW;
  currentStatus = pushTransition(transitions, currentStatus, CaseStatus.TRIAGING, "Begin triage");

  switch (route) {
    case "ESCALATE_EMERGENCY":
      currentStatus = pushTransition(
        transitions,
        currentStatus,
        CaseStatus.ESCALATED,
        "Emergency red-flag identified"
      );
      break;

    case "ROUTE_TO_DOCTOR":
      currentStatus = pushTransition(
        transitions,
        currentStatus,
        CaseStatus.ASSIGNED,
        "Urgent care threshold met"
      );
      break;

    case "SEND_SELF_CARE":
      currentStatus = pushTransition(
        transitions,
        currentStatus,
        CaseStatus.COMPLETED,
        "Handled with self-care guidance"
      );
      break;

    case "OUT_OF_STATE":
      currentStatus = pushTransition(
        transitions,
        currentStatus,
        CaseStatus.ESCALATED,
        "Patient location outside Ohio launch scope"
      );
      break;
  }

  return {
    urgencyScore,
    route,
    finalStatus: currentStatus,
    transitions
  };
}
