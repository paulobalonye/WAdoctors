import { parseCaseTriageStorage } from "../consultations/triageStorage.js";

export type CaseTriageView = {
  source: "HEURISTIC" | "AI";
  route: "ROUTE_TO_DOCTOR" | "SEND_SELF_CARE" | "ESCALATE_EMERGENCY" | "OUT_OF_STATE" | "";
  confidence: number | null;
  redFlags: string[];
  baselineUrgency: number | null;
  urgencyScore: number | null;
  summary: string;
};

export function buildCaseTriageView(params: {
  aiTranscript?: string | null;
  aiSummary?: string | null;
}): CaseTriageView | null {
  const parsed = parseCaseTriageStorage(params.aiTranscript);
  const summaryText = String(params.aiSummary || "").trim();

  if (!parsed && !summaryText) {
    return null;
  }

  return {
    source: parsed?.triageSource ?? "HEURISTIC",
    route: parsed?.route ?? "",
    confidence: parsed ? parsed.triageConfidence : null,
    redFlags: parsed?.triageRedFlags ?? [],
    baselineUrgency: parsed ? parsed.baselineUrgency : null,
    urgencyScore: parsed ? parsed.urgencyScore : null,
    summary: parsed?.triageSummary || summaryText
  };
}
