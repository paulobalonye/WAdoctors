import { CaseStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { buildWhatsAppWorkflowPreviewWithAI } from "../consultations/whatsappWorkflow.js";
import { buildCaseTriageStorage } from "../consultations/triageStorage.js";
import { createOpenAITriageProvider } from "../../integrations/openaiTriageProvider.js";
import { assignDoctorIfNeeded } from "../cases/assignmentService.js";
import {
  addCaseMessage,
  createNewCase,
  ensurePatientByPhone,
  getActiveCaseForPatient,
  transitionCaseStatus
} from "../cases/caseRepository.js";
import { ensureCaseWorkspace } from "../cases/workspaceService.js";
import { dispatchPatientToWebex } from "../messages/relayDispatcher.js";
import { extractWhatsAppMessages } from "../../webhooks/payloads.js";

const triageAIProvider = createOpenAITriageProvider({
  apiKey: env.OPENAI_API_KEY,
  model: env.OPENAI_TRIAGE_MODEL,
  baseUrl: env.OPENAI_BASE_URL,
  timeoutMs: env.OPENAI_TRIAGE_TIMEOUT_MS
});

export type WhatsAppProcessResult = {
  processedCount: number;
  caseIds: string[];
  relays: Array<{
    caseId: string;
    relayed: boolean;
    reason?: string;
  }>;
};

async function applyWorkflowTransitionsForNewCase(params: {
  caseId: string;
  transitions: Array<{ to: CaseStatus; reason: string }>;
}) {
  for (const transition of params.transitions) {
    await transitionCaseStatus({
      caseId: params.caseId,
      to: transition.to,
      actorId: "SYSTEM_TRIAGE",
      actorType: "SYSTEM",
      reason: transition.reason
    });
  }
}

export async function processWhatsAppWebhookPayload(payload: unknown): Promise<WhatsAppProcessResult> {
  const messages = extractWhatsAppMessages(payload);
  const caseIds: string[] = [];
  const relays: WhatsAppProcessResult["relays"] = [];

  for (const message of messages) {
    const patient = await ensurePatientByPhone(message.from);
    let triageCase = await getActiveCaseForPatient(patient.id);
    let relayBlockedReason: string | undefined;

    if (!triageCase) {
      const workflow = await buildWhatsAppWorkflowPreviewWithAI({
        messageText: message.text,
        patientState: env.LAUNCH_STATE,
        aiEnabled: env.AI_TRIAGE_ENABLED === "true",
        provider: triageAIProvider
      });
      const triageStorage = buildCaseTriageStorage({
        triageSource: workflow.triageSource,
        triageSummary: workflow.triageSummary,
        triageConfidence: workflow.triageConfidence,
        triageRedFlags: workflow.triageRedFlags,
        baselineUrgency: workflow.baselineUrgency,
        urgencyScore: workflow.urgencyScore,
        route: workflow.route
      });

      triageCase = await createNewCase({
        patientId: patient.id,
        chiefComplaint: message.text.slice(0, 255),
        urgencyScore: workflow.urgencyScore,
        aiSummary: triageStorage.aiSummary,
        aiTranscript: triageStorage.aiTranscript
      });

      await addCaseMessage({
        caseId: triageCase.id,
        senderType: "SYSTEM",
        senderId: "SYSTEM_TRIAGE",
        platform: "WHATSAPP",
        phiScope: "POSSIBLE",
        content: `Triage note: ${triageStorage.aiSummary}`.slice(0, 2000)
      });

      const transitions = workflow.transitions.slice(1).map((item) => ({
        to: item.to,
        reason: item.reason
      }));
      await applyWorkflowTransitionsForNewCase({
        caseId: triageCase.id,
        transitions
      });

      const refreshed = await prisma.triageCase.findUnique({
        where: { id: triageCase.id }
      });
      if (refreshed) {
        triageCase = refreshed;
      }
    }

    if (triageCase.status === CaseStatus.ASSIGNED && !triageCase.assignedDoctorId) {
      const assignment = await assignDoctorIfNeeded(triageCase.id);
      triageCase = assignment.caseRecord;

      if (!assignment.assigned) {
        relayBlockedReason = assignment.reason ?? "Doctor assignment unavailable";
      }
    }

    if (
      (triageCase.status === CaseStatus.ASSIGNED || triageCase.status === CaseStatus.IN_PROGRESS) &&
      triageCase.assignedDoctorId &&
      !triageCase.webexSpaceId
    ) {
      const workspace = await ensureCaseWorkspace(triageCase.id);
      if (!workspace.ensured) {
        relayBlockedReason = workspace.reason ?? "Webex workspace setup failed";
      } else {
        const refreshed = await prisma.triageCase.findUnique({
          where: { id: triageCase.id }
        });
        if (refreshed) {
          triageCase = refreshed;
        }
      }
    }

    await addCaseMessage({
      caseId: triageCase.id,
      senderType: "PATIENT",
      senderId: patient.id,
      platform: "WHATSAPP",
      phiScope: "POSSIBLE",
      content: message.text
    });

    caseIds.push(triageCase.id);

    const shouldRelay =
      triageCase.status === CaseStatus.ASSIGNED ||
      triageCase.status === CaseStatus.IN_PROGRESS;

    if (relayBlockedReason) {
      relays.push({
        caseId: triageCase.id,
        relayed: false,
        reason: relayBlockedReason
      });
      continue;
    }

    if (shouldRelay) {
      const relayResult = await dispatchPatientToWebex({
        caseId: triageCase.id,
        patientPhone: patient.whatsappPhone,
        text: message.text
      });

      relays.push({
        caseId: triageCase.id,
        relayed: relayResult.dispatched,
        reason: relayResult.dispatched ? undefined : relayResult.reason
      });
    }
  }

  return {
    processedCount: messages.length,
    caseIds,
    relays
  };
}
