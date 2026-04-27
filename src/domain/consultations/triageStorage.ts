import type { OhioUrgentCareRoute } from "../triage/ohioUrgentCareRouting.js";

export type CaseTriageStorageInput = {
  triageSource: "HEURISTIC" | "AI";
  triageSummary: string;
  triageConfidence: number;
  triageRedFlags: string[];
  baselineUrgency: number;
  urgencyScore: number;
  route: OhioUrgentCareRoute;
};

export type CaseTriageTranscript = {
  version: 1;
  triageSource: "HEURISTIC" | "AI";
  triageSummary: string;
  triageConfidence: number;
  triageRedFlags: string[];
  baselineUrgency: number;
  urgencyScore: number;
  route: OhioUrgentCareRoute;
};

const ROUTES: OhioUrgentCareRoute[] = [
  "ROUTE_TO_DOCTOR",
  "SEND_SELF_CARE",
  "ESCALATE_EMERGENCY",
  "OUT_OF_STATE"
];

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

function normalizeSource(value: unknown): "HEURISTIC" | "AI" {
  return value === "AI" ? "AI" : "HEURISTIC";
}

function normalizeSummary(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeRedFlags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const text = String(item || "").trim();
    if (!text) {
      continue;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(text);
  }

  return result.slice(0, 8);
}

function normalizeRoute(value: unknown): OhioUrgentCareRoute {
  return ROUTES.includes(value as OhioUrgentCareRoute) ? (value as OhioUrgentCareRoute) : "ROUTE_TO_DOCTOR";
}

export function parseCaseTriageStorage(value: string | null | undefined): CaseTriageTranscript | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<CaseTriageTranscript>;
    return {
      version: 1,
      triageSource: normalizeSource(parsed?.triageSource),
      triageSummary: normalizeSummary(parsed?.triageSummary),
      triageConfidence: clampConfidence(Number(parsed?.triageConfidence)),
      triageRedFlags: normalizeRedFlags(parsed?.triageRedFlags),
      baselineUrgency: clampUrgency(Number(parsed?.baselineUrgency)),
      urgencyScore: clampUrgency(Number(parsed?.urgencyScore)),
      route: normalizeRoute(parsed?.route)
    };
  } catch {
    return null;
  }
}

export function buildCaseTriageStorage(input: CaseTriageStorageInput): {
  aiSummary: string;
  aiTranscript: string;
} {
  const transcript: CaseTriageTranscript = {
    version: 1,
    triageSource: normalizeSource(input.triageSource),
    triageSummary: normalizeSummary(input.triageSummary),
    triageConfidence: clampConfidence(Number(input.triageConfidence)),
    triageRedFlags: normalizeRedFlags(input.triageRedFlags),
    baselineUrgency: clampUrgency(Number(input.baselineUrgency)),
    urgencyScore: clampUrgency(Number(input.urgencyScore)),
    route: normalizeRoute(input.route)
  };

  const confidencePercent = Math.round(transcript.triageConfidence * 100);
  const flagsText = transcript.triageRedFlags.length
    ? ` | red flags: ${transcript.triageRedFlags.join(", ")}`
    : "";
  const narrativeText = transcript.triageSummary ? ` | ${transcript.triageSummary}` : "";

  const aiSummary = `${transcript.triageSource} triage | urgency ${transcript.urgencyScore}/5 (baseline ${transcript.baselineUrgency}/5) | route ${transcript.route} | confidence ${confidencePercent}%${flagsText}${narrativeText}`.slice(
    0,
    1200
  );

  return {
    aiSummary,
    aiTranscript: JSON.stringify(transcript)
  };
}
