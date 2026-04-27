import type { CaseTriageView } from "./caseTriageView.js";

type TriageCaseLike = {
  triage: CaseTriageView | null;
};

export type TriageInsightsSummary = {
  windowHours: number;
  limit: number;
  generatedAt: string;
  totalCases: number;
  withTriage: number;
  withoutTriage: number;
  sourceCounts: {
    AI: number;
    HEURISTIC: number;
  };
  confidenceBands: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    UNKNOWN: number;
  };
  routeCounts: Array<{
    route: string;
    count: number;
  }>;
  topRedFlags: Array<{
    flag: string;
    count: number;
  }>;
};

function confidenceBand(value: number | null): keyof TriageInsightsSummary["confidenceBands"] {
  if (!Number.isFinite(value)) {
    return "UNKNOWN";
  }

  if ((value as number) >= 0.8) {
    return "HIGH";
  }

  if ((value as number) >= 0.6) {
    return "MEDIUM";
  }

  return "LOW";
}

export function buildTriageInsightsSummary(params: {
  windowHours: number;
  limit: number;
  cases: TriageCaseLike[];
  now?: Date;
}): TriageInsightsSummary {
  const sourceCounts: TriageInsightsSummary["sourceCounts"] = {
    AI: 0,
    HEURISTIC: 0
  };

  const confidenceBands: TriageInsightsSummary["confidenceBands"] = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0
  };

  const routeCounts = new Map<string, number>();
  const redFlagCounts = new Map<string, number>();

  let withTriage = 0;
  for (const item of params.cases) {
    const triage = item.triage;
    if (!triage) {
      continue;
    }

    withTriage += 1;
    sourceCounts[triage.source] += 1;
    confidenceBands[confidenceBand(triage.confidence)] += 1;

    if (triage.route) {
      routeCounts.set(triage.route, (routeCounts.get(triage.route) ?? 0) + 1);
    }

    for (const flag of triage.redFlags) {
      const normalized = String(flag || "").trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      redFlagCounts.set(normalized, (redFlagCounts.get(normalized) ?? 0) + 1);
    }
  }

  const topRedFlags = Array.from(redFlagCounts.entries())
    .map(([flag, count]) => ({ flag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.flag.localeCompare(b.flag);
    })
    .slice(0, 10);

  const routeRows = Array.from(routeCounts.entries())
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.route.localeCompare(b.route);
    });

  return {
    windowHours: params.windowHours,
    limit: params.limit,
    generatedAt: (params.now ?? new Date()).toISOString(),
    totalCases: params.cases.length,
    withTriage,
    withoutTriage: params.cases.length - withTriage,
    sourceCounts,
    confidenceBands,
    routeCounts: routeRows,
    topRedFlags
  };
}
