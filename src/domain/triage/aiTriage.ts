import { inferUrgencyFromText, routeOhioUrgentCareCase, type OhioUrgentCareRoute } from "./ohioUrgentCareRouting.js";

export type AITriageSuggestion = {
  urgencyScore?: number;
  summary?: string;
  redFlags?: string[];
  confidence?: number;
};

export type TriageAIProvider = {
  assess(input: {
    messageText: string;
    patientState: string;
    baselineUrgency: number;
  }): Promise<AITriageSuggestion>;
};

export type TriageAssessment = {
  urgencyScore: number;
  baselineUrgency: number;
  route: OhioUrgentCareRoute;
  source: "HEURISTIC" | "AI";
  summary: string;
  redFlags: string[];
  confidence: number;
};

type BuildTriageAssessmentInput = {
  messageText: string;
  patientState: string;
  aiEnabled: boolean;
  provider?: TriageAIProvider;
};

function clampUrgency(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(Math.round(value), 1), 5);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

function normalizeRedFlags(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    const trimmed = String(item || "").trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized.slice(0, 8);
}

function buildHeuristicAssessment(messageText: string, patientState: string): TriageAssessment {
  const baselineUrgency = clampUrgency(inferUrgencyFromText(messageText));
  const route = routeOhioUrgentCareCase({
    urgencyScore: baselineUrgency,
    patientState
  });

  return {
    urgencyScore: baselineUrgency,
    baselineUrgency,
    route,
    source: "HEURISTIC",
    summary: "Keyword-based triage baseline",
    redFlags: [],
    confidence: 0.55
  };
}

export async function buildTriageAssessment(input: BuildTriageAssessmentInput): Promise<TriageAssessment> {
  const heuristic = buildHeuristicAssessment(input.messageText, input.patientState);

  if (!input.aiEnabled || !input.provider) {
    return heuristic;
  }

  try {
    const suggestion = await input.provider.assess({
      messageText: input.messageText,
      patientState: input.patientState,
      baselineUrgency: heuristic.baselineUrgency
    });

    const aiUrgency = clampUrgency(Number(suggestion.urgencyScore ?? heuristic.baselineUrgency));
    const finalUrgency = Math.max(heuristic.baselineUrgency, aiUrgency);
    const route = routeOhioUrgentCareCase({
      urgencyScore: finalUrgency,
      patientState: input.patientState
    });
    const confidence = clampConfidence(Number(suggestion.confidence ?? 0));
    const summary = String(suggestion.summary || "").trim() || "AI-assisted triage analysis";

    return {
      urgencyScore: finalUrgency,
      baselineUrgency: heuristic.baselineUrgency,
      route,
      source: "AI",
      summary,
      redFlags: normalizeRedFlags(suggestion.redFlags),
      confidence
    };
  } catch {
    return heuristic;
  }
}
