type OverallProviderStats = {
  provider: string;
  count: number;
  lastReceivedAt: Date | null;
};

type WindowProviderStats = {
  provider: string;
  count: number;
};

export type WebhookSummary = {
  windowHours: number;
  totalEvents: number;
  eventsLastWindow: number;
  providers: Array<{
    provider: string;
    totalEvents: number;
    eventsLastWindow: number;
    lastReceivedAt: string | null;
  }>;
};

export function buildWebhookSummary(params: {
  windowHours: number;
  totalEvents: number;
  eventsLastWindow: number;
  overallByProvider: OverallProviderStats[];
  windowByProvider: WindowProviderStats[];
}): WebhookSummary {
  const windowByProviderMap = new Map<string, number>();
  for (const row of params.windowByProvider) {
    windowByProviderMap.set(row.provider, row.count);
  }

  const providerRows = params.overallByProvider.map((row) => ({
    provider: row.provider,
    totalEvents: row.count,
    eventsLastWindow: windowByProviderMap.get(row.provider) ?? 0,
    lastReceivedAt: row.lastReceivedAt ? row.lastReceivedAt.toISOString() : null
  }));

  for (const row of params.windowByProvider) {
    if (providerRows.some((providerRow) => providerRow.provider === row.provider)) {
      continue;
    }

    providerRows.push({
      provider: row.provider,
      totalEvents: 0,
      eventsLastWindow: row.count,
      lastReceivedAt: null
    });
  }

  providerRows.sort((a, b) => {
    if (b.totalEvents !== a.totalEvents) {
      return b.totalEvents - a.totalEvents;
    }

    return a.provider.localeCompare(b.provider);
  });

  return {
    windowHours: params.windowHours,
    totalEvents: params.totalEvents,
    eventsLastWindow: params.eventsLastWindow,
    providers: providerRows
  };
}
