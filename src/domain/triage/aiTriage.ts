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

export type TriageFallbackReason =
  | "AI_DISABLED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_PROVIDER_ERROR"
  | "AI_LOW_CONFIDENCE";

export type TriageAssessment = {
  urgencyScore: number;
  baselineUrgency: number;
  route: OhioUrgentCareRoute;
  source: "HEURISTIC" | "AI";
  summary: string;
  redFlags: string[];
  confidence: number;
  fallbackReason?: TriageFallbackReason;
  safetyOverride: boolean;
  safetySignal?: string;
};

type BuildTriageAssessmentInput = {
  messageText: string;
  patientState: string;
  aiEnabled: boolean;
  provider?: TriageAIProvider;
};

const MIN_AI_CONFIDENCE = 0.45;
const EMERGENCY_OVERRIDE_SIGNALS = [
  "unconscious",
  "passed out",
  "not breathing",
  "stopped breathing",
  "bleeding heavily",
  "heavy bleeding",
  "overdose",
  "suicidal",
  "suicide attempt",
  "anaphylaxis"
] as const;

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

function detectEmergencyOverrideSignal(messageText: string): string | undefined {
  const normalized = String(messageText || "").toLowerCase();
  if (!normalized.trim()) {
    return undefined;
  }

  for (const signal of EMERGENCY_OVERRIDE_SIGNALS) {
    if (normalized.includes(signal)) {
      return signal;
    }
  }

  return undefined;
}

function buildHeuristicAssessment(messageText: string, patientState: string): TriageAssessment {
  const baselineUrgency = clampUrgency(inferUrgencyFromText(messageText));
  const safetySignal = detectEmergencyOverrideSignal(messageText);
  const urgencyScore = safetySignal ? 5 : baselineUrgency;
  const route = routeOhioUrgentCareCase({
    urgencyScore,
    patientState
  });

  return {
    urgencyScore,
    baselineUrgency,
    route,
    source: "HEURISTIC",
    summary: safetySignal ? `Emergency keyword override: ${safetySignal}` : "Keyword-based triage baseline",
    redFlags: safetySignal ? [safetySignal] : [],
    confidence: safetySignal ? 0.7 : 0.55,
    safetyOverride: Boolean(safetySignal),
    ...(safetySignal ? { safetySignal } : {})
  };
}

function withFallback(
  assessment: TriageAssessment,
  fallbackReason: TriageFallbackReason,
  summary?: string
): TriageAssessment {
  return {
    ...assessment,
    source: "HEURISTIC",
    summary: summary ?? assessment.summary,
    fallbackReason
  };
}

export async function buildTriageAssessment(input: BuildTriageAssessmentInput): Promise<TriageAssessment> {
  const heuristic = buildHeuristicAssessment(input.messageText, input.patientState);

  if (!input.aiEnabled) {
    return withFallback(heuristic, "AI_DISABLED");
  }

  if (!input.provider) {
    return withFallback(heuristic, "AI_PROVIDER_UNAVAILABLE", "AI fallback to heuristic: provider unavailable");
  }

  try {
    const suggestion = await input.provider.assess({
      messageText: input.messageText,
      patientState: input.patientState,
      baselineUrgency: heuristic.baselineUrgency
    });

    const confidence = clampConfidence(Number(suggestion.confidence ?? 0));
    if (confidence < MIN_AI_CONFIDENCE) {
      return withFallback(
        heuristic,
        "AI_LOW_CONFIDENCE",
        `AI fallback to heuristic: low confidence (${Math.round(confidence * 100)}%)`
      );
    }

    const aiUrgency = clampUrgency(Number(suggestion.urgencyScore ?? heuristic.urgencyScore));
    const finalUrgency = Math.max(heuristic.urgencyScore, aiUrgency);
    const route = routeOhioUrgentCareCase({
      urgencyScore: finalUrgency,
      patientState: input.patientState
    });
    const summary = String(suggestion.summary || "").trim() || "AI-assisted triage analysis";
    const redFlags = normalizeRedFlags([
      ...(Array.isArray(suggestion.redFlags) ? suggestion.redFlags : []),
      ...(heuristic.safetySignal ? [heuristic.safetySignal] : [])
    ]);

    return {
      urgencyScore: finalUrgency,
      baselineUrgency: heuristic.baselineUrgency,
      route,
      source: "AI",
      summary,
      redFlags,
      confidence,
      safetyOverride: heuristic.safetyOverride,
      ...(heuristic.safetySignal ? { safetySignal: heuristic.safetySignal } : {})
    };
  } catch {
    return withFallback(heuristic, "AI_PROVIDER_ERROR", "AI fallback to heuristic: provider error");
  }
}
