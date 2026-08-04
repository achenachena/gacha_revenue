import type {
  AppLineId,
  CoverageStatus,
  DataStatus,
  Game,
  GameId,
  RevenueMonth,
  VersionDetail,
} from "./data";

const apiBase = "/api/backend";

export type PublicRevenueResponse = {
  data?: Array<{ game_id: GameId; history: RevenueMonth[]; source_url: string }>;
  meta?: { fetched_at: string };
};

export type ExchangeRateData = {
  date: string;
  base: "USD";
  quote: "CNY";
  rate: number;
  provider: string;
  source_url: string;
  fallback: boolean;
};

type ExchangeRateResponse = {
  data?: Omit<ExchangeRateData, "fallback">;
  meta?: { fallback_snapshot?: boolean };
};

type VersionsResponse = {
  data?: Array<{
    id: string;
    game_id: GameId;
    version: string;
    phase_index?: number;
    phase_zh: string;
    phase_en: string;
    characters_zh: string;
    characters_en: string;
    starts_at: string;
    ends_at: string;
    estimate: number | null;
    p25: number | null;
    p75: number | null;
    confidence: VersionDetail["confidence"];
    data_status: DataStatus;
    source_url?: string;
    source_updated_at?: string;
    ios_grossing_rank_range: VersionDetail["ranks"];
    app_line_observations: Array<{
      app_id: AppLineId;
      name_zh: string;
      name_en: string;
      hours_above: number | null;
      data_status: DataStatus;
      updated_at: string | null;
    }>;
  }>;
};

export type BannerMetricsResponse = {
  data?: {
    ranks: Partial<
      Record<
        "CN" | "JP" | "US" | "KR",
        {
          peak_rank: number | null;
          lowest_rank: number | null;
          observed_hours: number;
          ranked_hours: number;
          lowest_is_beyond_feed: boolean;
          feed_limit: number;
        }
      >
    >;
    app_line_observations: Array<{
      app_id: AppLineId;
      hours_above: number;
      observed_hours: number;
      updated_at: string | null;
    }>;
    source: "apple_public_feed" | "licensed_feed";
    coverage_status: CoverageStatus;
    collection_started_at: string | null;
    phase_revenue: { estimate: number | null; coverage: number; formula: string; threshold: number } | null;
  };
};

export type BannerMetricsData = NonNullable<BannerMetricsResponse["data"]>;

async function fetchJSON<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}/${path}`, { signal });
  if (!response.ok) throw new Error(`data API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export function loadPublicRevenue(signal: AbortSignal) {
  return fetchJSON<PublicRevenueResponse>("public-revenue", signal);
}

export function loadExchangeRate(signal: AbortSignal) {
  return fetchJSON<ExchangeRateResponse>("exchange-rate", signal).then((payload): ExchangeRateData | null => {
    if (!payload.data || payload.data.base !== "USD" || payload.data.quote !== "CNY") return null;
    if (!Number.isFinite(payload.data.rate) || payload.data.rate < 4 || payload.data.rate > 12) return null;
    return { ...payload.data, fallback: Boolean(payload.meta?.fallback_snapshot) };
  });
}

export function loadVersions(signal: AbortSignal) {
  return fetchJSON<VersionsResponse>("versions", signal).then(normalizeVersions);
}

export function loadBannerMetrics(target: Pick<VersionDetail, "gameId" | "date" | "endDate">, signal: AbortSignal) {
  const query = new URLSearchParams({ game_id: target.gameId, start: target.date, end: target.endDate });
  return fetchJSON<BannerMetricsResponse>(`banner-metrics?${query}`, signal);
}

export async function loadBannerMetricSet(
  targets: VersionDetail[],
  signal: AbortSignal,
  concurrency = 2,
): Promise<Map<string, BannerMetricsData>> {
  const results = new Map<string, BannerMetricsData>();
  let cursor = 0;
  let failures = 0;
  const worker = async () => {
    while (!signal.aborted) {
      const index = cursor++;
      const target = targets[index];
      if (!target) return;
      try {
        const payload = await loadBannerMetrics(target, signal);
        if (payload.data) results.set(target.id, payload.data);
      } catch (error) {
        if (signal.aborted) return;
        failures++;
        if (!(error instanceof Error)) console.error("Unexpected banner metric error", error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  if (failures) console.error(`Unable to refresh ${failures} of ${targets.length} banner metric windows`);
  return results;
}

export function applyBannerMetrics(version: VersionDetail, metrics: BannerMetricsData): VersionDetail {
  const observedHours = Math.max(
    0,
    ...Object.values(metrics.ranks).map((item) => Number(item?.observed_hours ?? 0)),
    ...metrics.app_line_observations.map((item) => Number(item.observed_hours ?? 0)),
  );
  const ranks = { ...version.ranks };
  for (const market of ["CN", "JP", "US", "KR"] as const) {
    const row = metrics.ranks[market];
    if (row?.observed_hours) ranks[market] = [row.peak_rank, row.lowest_rank];
  }
  const appHours = version.appHours.map((line) => {
    const row = metrics.app_line_observations.find((item) => item.app_id === line.appId);
    if (!row?.observed_hours) return line;
    return {
      ...line,
      hours: Number(row.hours_above),
      source: metrics.source,
      updatedAt: row.updated_at?.slice(0, 10) ?? null,
    };
  });
  const phaseEstimate = metrics.phase_revenue?.estimate ?? null;
  return {
    ...version,
    ranks,
    appHours,
    observedHours,
    coverageStatus: metrics.coverage_status,
    collectionStartedAt: metrics.collection_started_at,
    revenue: phaseEstimate,
    confidence: phaseEstimate === null ? "N/A" : "B",
    dataStatus: observedHours ? metrics.source : version.dataStatus,
  };
}

function normalizeVersions(payload: VersionsResponse): VersionDetail[] {
  return (payload.data ?? []).map((item) => {
    const startsAt = new Date(item.starts_at);
    const endsAt = new Date(item.ends_at);
    return {
      id: item.id,
      gameId: item.game_id,
      version: item.version,
      phaseIndex: item.phase_index ?? 1,
      phase: { "zh-CN": item.phase_zh, en: item.phase_en },
      date: item.starts_at.slice(0, 10),
      endDate: item.ends_at.slice(0, 10),
      characters: { "zh-CN": item.characters_zh, en: item.characters_en },
      scope: { "zh-CN": "独立卡池窗口", en: "Exact banner window" },
      revenue: item.estimate,
      revenueRange: [item.p25, item.p75],
      confidence: item.confidence,
      windowHours: Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 3_600_000)),
      observedHours: 0,
      coverageStatus: "unknown",
      collectionStartedAt: null,
      dataStatus: item.data_status,
      sourceUrl: item.source_url ?? "",
      sourceUpdatedAt: item.source_updated_at?.slice(0, 10) ?? item.starts_at.slice(0, 10),
      ranks: item.ios_grossing_rank_range,
      appHours: item.app_line_observations.map((line) => ({
        appId: line.app_id,
        app: { "zh-CN": line.name_zh, en: line.name_en },
        hours: line.hours_above,
        source: line.data_status,
        updatedAt: line.updated_at?.slice(0, 10) ?? null,
      })),
    };
  });
}

export function mergeRevenue(
  current: Game[],
  payload: PublicRevenueResponse,
  update: (game: Game, history: RevenueMonth[], period?: Pick<RevenueMonth, "year" | "month">) => Game,
) {
  const period = payload.data
    ?.flatMap((item) => item.history)
    .reduce<Pick<RevenueMonth, "year" | "month"> | undefined>((latest, item) => {
      if (!latest || item.year > latest.year || (item.year === latest.year && item.month > latest.month)) {
        return { year: item.year, month: item.month };
      }
      return latest;
    }, undefined);
  return current.map((game) => {
    const replacement = payload.data?.find((item) => item.game_id === game.id);
    return replacement?.history.length ? update(game, replacement.history, period) : update(game, game.revenueHistory, period);
  });
}
