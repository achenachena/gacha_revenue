import {
  gameVisuals,
  type AppLineId,
  type CoverageStatus,
  type DataStatus,
  type Game,
  type GameId,
  type MetricEvidence,
  type RevenueMonth,
  type RevenueYear,
  type VersionDetail,
} from "./data";

const apiBase = "/api/backend";

type PublicRevenueGame = {
  id: GameId;
  source_slug: string;
  launch_date: string;
  name_zh: string;
  name_en: string;
  publisher: string;
  history: RevenueMonth[];
  source_url: string;
  source_fetched_at: string;
  source_status: string;
  latest: RevenueMonth | null;
  ytd: number | null;
  change_percent: number | null;
  yearly: RevenueYear[];
};

export type PublicRevenueResponse = {
  data?: PublicRevenueGame[];
  meta?: {
    latest_period?: { year: number; month: number } | null;
    fetched_at?: string;
    fallback_snapshot?: boolean;
    provider?: string;
    totals?: { latest: number; ytd: number; covered_games: number; games: number };
  };
};

export type PublicRevenueData = {
  games: Game[];
  latestPeriod: { year: number; month: number } | null;
  fetchedAt: string;
  fallback: boolean;
  provider: string;
  totals: { latest: number; ytd: number; coveredGames: number; games: number };
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

export type MethodologyData = {
  version: string;
  basis: string;
  excludes: Record<"zh-CN" | "en", string>;
  formulas: Array<{
    id: string;
    title: Record<"zh-CN" | "en", string>;
    expression: string;
  }>;
  definitions: Array<{
    symbol: string;
    text: Record<"zh-CN" | "en", string>;
  }>;
  sources: Array<{ id: string; label: string; url: string }>;
};

type MethodologyResponse = {
  data?: {
    version: string;
    basis: string;
    excludes_zh: string;
    excludes_en: string;
    formulas: Array<{ id: string; title_zh: string; title_en: string; expression: string }>;
    definitions: Array<{ symbol: string; text_zh: string; text_en: string }>;
    sources: Array<{ id: string; label: string; url: string }>;
  };
};

type ExchangeRateResponse = {
  data?: Omit<ExchangeRateData, "fallback">;
  meta?: { fallback_snapshot?: boolean };
};

type APIEvidence = {
  primary_url: string;
  cross_check_url: string;
  note_zh: string;
  note_en: string;
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
    revenue_coverage?: number;
    revenue_formula?: string;
    window_hours?: number;
    observed_hours?: number;
    coverage_status?: CoverageStatus;
    collection_started_at?: string | null;
    data_status: DataStatus;
    source_url?: string;
    source_updated_at?: string;
    ios_grossing_rank_range: VersionDetail["ranks"];
    rank_evidence?: APIEvidence | null;
    app_line_observations: Array<{
      app_id: AppLineId;
      name_zh: string;
      name_en: string;
      hours_above: number | null;
      data_status: DataStatus;
      updated_at: string | null;
      evidence?: APIEvidence | null;
    }>;
  }>;
};

export type BannerMetricsResponse = {
  data?: {
    ranks: Partial<Record<"CN" | "JP" | "US" | "KR", {
      peak_rank: number | null;
      lowest_rank: number | null;
      observed_hours: number;
      ranked_hours: number;
      lowest_is_beyond_feed: boolean;
      feed_limit: number;
    }>>;
    app_line_observations: Array<{
      app_id: AppLineId;
      hours_above: number;
      observed_hours: number;
      updated_at: string | null;
    }>;
    source: "apple_public_feed" | "licensed_feed";
    coverage_status: CoverageStatus;
    collection_started_at: string | null;
    phase_revenue: {
      estimate: number | null;
      coverage: number;
      covered_hours: number;
      window_hours: number;
      formula: string;
      threshold: number;
    } | null;
  };
};

export type BannerMetricsData = NonNullable<BannerMetricsResponse["data"]>;

async function fetchJSON<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}/${path}`, { signal });
  if (!response.ok) throw new Error(`data API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export function loadPublicRevenue(signal: AbortSignal) {
  return fetchJSON<PublicRevenueResponse>("public-revenue", signal).then(normalizePublicRevenue);
}

export function normalizePublicRevenue(payload: PublicRevenueResponse): PublicRevenueData {
  const latestPeriod = payload.meta?.latest_period ?? null;
  const games = (payload.data ?? []).flatMap((item): Game[] => {
    const visual = gameVisuals[item.id];
    if (!visual) return [];
    const history = [...(item.history ?? [])].sort((a, b) => a.year - b.year || a.month - b.month);
    return [{
      id: item.id,
      sourceSlug: item.source_slug,
      launchDate: item.launch_date,
      shortName: visual.shortName,
      name: { "zh-CN": item.name_zh, en: item.name_en },
      publisher: item.publisher,
      color: visual.color,
      pale: visual.pale,
      currentMonth: item.latest?.value ?? null,
      currentMonthRange: null,
      ytd: item.ytd,
      change: item.change_percent,
      confidence: history.length ? "SOURCE" : "N/A",
      yearly: item.yearly ?? [],
      monthly: latestPeriod ? history.filter((month) => month.year === latestPeriod.year && month.month <= latestPeriod.month).map((month) => month.value) : [],
      revenueHistory: history,
      sourceUrl: item.source_url,
      sourceFetchedAt: item.source_fetched_at,
      sourceStatus: item.source_status,
    }];
  });
  return {
    games,
    latestPeriod,
    fetchedAt: payload.meta?.fetched_at ?? "",
    fallback: Boolean(payload.meta?.fallback_snapshot),
    provider: payload.meta?.provider ?? "",
    totals: {
      latest: payload.meta?.totals?.latest ?? 0,
      ytd: payload.meta?.totals?.ytd ?? 0,
      coveredGames: payload.meta?.totals?.covered_games ?? 0,
      games: payload.meta?.totals?.games ?? games.length,
    },
  };
}

export function loadExchangeRate(signal: AbortSignal) {
  return fetchJSON<ExchangeRateResponse>("exchange-rate", signal).then((payload): ExchangeRateData | null => {
    if (!payload.data || payload.data.base !== "USD" || payload.data.quote !== "CNY") return null;
    if (!Number.isFinite(payload.data.rate) || payload.data.rate < 4 || payload.data.rate > 12) return null;
    return { ...payload.data, fallback: Boolean(payload.meta?.fallback_snapshot) };
  });
}

export function loadMethodology(signal: AbortSignal) {
  return fetchJSON<MethodologyResponse>("methodology", signal).then((payload): MethodologyData | null => {
    if (!payload.data) return null;
    return {
      version: payload.data.version,
      basis: payload.data.basis,
      excludes: { "zh-CN": payload.data.excludes_zh, en: payload.data.excludes_en },
      formulas: payload.data.formulas.map((formula) => ({
        id: formula.id,
        title: { "zh-CN": formula.title_zh, en: formula.title_en },
        expression: formula.expression,
      })),
      definitions: payload.data.definitions.map((definition) => ({
        symbol: definition.symbol,
        text: { "zh-CN": definition.text_zh, en: definition.text_en },
      })),
      sources: payload.data.sources,
    };
  });
}

export function loadVersions(signal: AbortSignal) {
  return fetchJSON<VersionsResponse>("versions", signal).then(normalizeVersions);
}

export function loadBannerMetrics(target: Pick<VersionDetail, "gameId" | "date" | "endDate">, signal: AbortSignal) {
  const query = new URLSearchParams({ game_id: target.gameId, start: target.date, end: target.endDate });
  return fetchJSON<BannerMetricsResponse>(`banner-metrics?${query}`, signal);
}

export async function loadBannerMetricSet(targets: VersionDetail[], signal: AbortSignal, concurrency = 2): Promise<Map<string, BannerMetricsData>> {
  const results = new Map<string, BannerMetricsData>();
  let cursor = 0;
  let failures = 0;
  const worker = async () => {
    while (!signal.aborted) {
      const target = targets[cursor++];
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
    return { ...line, hours: Number(row.hours_above), source: metrics.source, updatedAt: row.updated_at?.slice(0, 10) ?? null };
  });
  const phaseEstimate = metrics.phase_revenue?.estimate ?? version.revenue;
  return {
    ...version,
    ranks,
    appHours,
    observedHours: Math.max(observedHours, version.observedHours),
    coverageStatus: observedHours ? metrics.coverage_status : version.coverageStatus,
    collectionStartedAt: observedHours ? metrics.collection_started_at : version.collectionStartedAt,
    revenue: phaseEstimate,
    revenueCoverage: metrics.phase_revenue?.coverage ?? version.revenueCoverage,
    revenueFormula: metrics.phase_revenue?.formula ?? version.revenueFormula,
    confidence: phaseEstimate === null ? "N/A" : "MODEL",
    dataStatus: observedHours ? metrics.source : version.dataStatus,
  };
}

function evidence(value?: APIEvidence | null): MetricEvidence | null {
  if (!value?.primary_url || !value.cross_check_url) return null;
  return {
    primaryUrl: value.primary_url,
    crossCheckUrl: value.cross_check_url,
    note: { "zh-CN": value.note_zh, en: value.note_en },
  };
}

function normalizeVersions(payload: VersionsResponse): VersionDetail[] {
  return (payload.data ?? []).map((item) => ({
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
    revenueCoverage: item.revenue_coverage ?? 0,
    revenueFormula: item.revenue_formula ?? "",
    confidence: item.confidence,
    windowHours: item.window_hours ?? 0,
    observedHours: item.observed_hours ?? 0,
    coverageStatus: item.coverage_status ?? "unknown",
    collectionStartedAt: item.collection_started_at ?? null,
    dataStatus: item.data_status,
    sourceUrl: item.source_url ?? "",
    sourceUpdatedAt: item.source_updated_at?.slice(0, 10) ?? item.starts_at.slice(0, 10),
    ranks: {
      CN: item.ios_grossing_rank_range?.CN ?? [null, null],
      JP: item.ios_grossing_rank_range?.JP ?? [null, null],
      US: item.ios_grossing_rank_range?.US ?? [null, null],
      KR: item.ios_grossing_rank_range?.KR ?? [null, null],
    },
    rankEvidence: evidence(item.rank_evidence),
    appHours: item.app_line_observations.map((line) => ({
      appId: line.app_id,
      app: { "zh-CN": line.name_zh, en: line.name_en },
      hours: line.hours_above,
      source: line.data_status,
      updatedAt: line.updated_at?.slice(0, 10) ?? null,
      evidence: evidence(line.evidence),
    })),
  }));
}
