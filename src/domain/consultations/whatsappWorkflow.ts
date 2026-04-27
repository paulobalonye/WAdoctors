import { CaseStatus } from "@prisma/client";
import { applyCaseStatusTransition } from "../cases/stateMachine.js";
import {
  buildTriageAssessment,
  type TriageAIProvider,
  type TriageFallbackReason
} from "../triage/aiTriage.js";
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
  baselineUrgency: number;
  route: OhioUrgentCareRoute;
  triageSource: "HEURISTIC" | "AI";
  triageSummary: string;
  triageConfidence: number;
  triageRedFlags: string[];
  triageFallbackReason?: TriageFallbackReason;
  triageSafetyOverride: boolean;
  triageSafetySignal?: string;
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

function buildWorkflowFromAssessment(params: {
  urgencyScore: number;
  baselineUrgency: number;
  route: OhioUrgentCareRoute;
  triageSource: "HEURISTIC" | "AI";
  triageSummary: string;
  triageConfidence: number;
  triageRedFlags: string[];
  triageFallbackReason?: TriageFallbackReason;
  triageSafetyOverride: boolean;
  triageSafetySignal?: string;
}): WhatsAppWorkflowPreview {
  const transitions: WorkflowTransition[] = [];
  let currentStatus: CaseStatus = CaseStatus.NEW;
  currentStatus = pushTransition(transitions, currentStatus, CaseStatus.TRIAGING, "Begin triage");

  switch (params.route) {
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
    urgencyScore: params.urgencyScore,
    baselineUrgency: params.baselineUrgency,
    route: params.route,
    triageSource: params.triageSource,
    triageSummary: params.triageSummary,
    triageConfidence: params.triageConfidence,
    triageRedFlags: params.triageRedFlags,
    ...(params.triageFallbackReason ? { triageFallbackReason: params.triageFallbackReason } : {}),
    triageSafetyOverride: params.triageSafetyOverride,
    ...(params.triageSafetySignal ? { triageSafetySignal: params.triageSafetySignal } : {}),
    finalStatus: currentStatus,
    transitions
  };
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

  return buildWorkflowFromAssessment({
    urgencyScore,
    baselineUrgency: urgencyScore,
    route,
    triageSource: "HEURISTIC",
    triageSummary: "Keyword-based triage baseline",
    triageConfidence: 0.55,
    triageRedFlags: [],
    triageSafetyOverride: false
  });
}

export async function buildWhatsAppWorkflowPreviewWithAI(params: {
  messageText: string;
  patientState: string;
  aiEnabled: boolean;
  provider?: TriageAIProvider;
  minAIConfidence?: number;
}): Promise<WhatsAppWorkflowPreview> {
  const assessment = await buildTriageAssessment({
    messageText: params.messageText,
    patientState: params.patientState,
    aiEnabled: params.aiEnabled,
    provider: params.provider,
    minAIConfidence: params.minAIConfidence
  });

  return buildWorkflowFromAssessment({
    urgencyScore: assessment.urgencyScore,
    baselineUrgency: assessment.baselineUrgency,
    route: assessment.route,
    triageSource: assessment.source,
    triageSummary: assessment.summary,
    triageConfidence: assessment.confidence,
    triageRedFlags: assessment.redFlags,
    triageFallbackReason: assessment.fallbackReason,
    triageSafetyOverride: assessment.safetyOverride,
    triageSafetySignal: assessment.safetySignal
  });
}
