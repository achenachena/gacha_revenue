export type Locale = "zh-CN" | "en";

export type GameId = "genshin" | "hsr" | "zzz" | "wuwa" | "endfield" | "nte";

export type MarketCoverage = "complete" | "partial" | "mixed";
export type RevenueScope = "combined_mobile_estimate" | "global_mobile_excluding_china" | "mixed";
export type RevenueMonth = {
  year: number;
  month: number;
  value: number;
  marketCoverage: MarketCoverage;
  scope: RevenueScope;
  sourceId?: string;
  sourceUrl?: string;
};
export type RevenueYear = {
  year: number;
  value: number;
  months: number;
  complete: boolean;
  marketCoverage: MarketCoverage;
  scopes: RevenueScope[];
};

export type Game = {
  id: GameId;
  sourceSlug: string;
  launchDate: string;
  shortName: string;
  name: Record<Locale, string>;
  publisher: string;
  color: string;
  pale: string;
  currentMonth: number | null;
  currentMonthRange: null;
  ytd: number | null;
  change: number | null;
  confidence: "SOURCE" | "N/A";
  yearly: RevenueYear[];
  monthly: number[];
  revenueHistory: RevenueMonth[];
  sourceUrl: string;
  sourceFetchedAt: string;
  sourceStatus: string;
};

export const gameVisuals: Record<GameId, { shortName: string; color: string; pale: string }> = {
  genshin: { shortName: "GI", color: "#6558D8", pale: "#EEECFF" },
  hsr: { shortName: "HSR", color: "#2478D4", pale: "#E6F2FF" },
  zzz: { shortName: "ZZZ", color: "#E6A10C", pale: "#FFF5D7" },
  wuwa: { shortName: "WW", color: "#00A68E", pale: "#DFF8F2" },
  endfield: { shortName: "EF", color: "#E85C3A", pale: "#FFEAE4" },
  nte: { shortName: "NTE", color: "#E14983", pale: "#FFE8F1" },
};

export type AppLineId =
  | "douyin"
  | "tencent_video"
  | "qq_music"
  | "capcut_cn"
  | "netease_music"
  | "baidu_netdisk"
  | "quark";

export type DataStatus = "verified_manual" | "licensed_feed" | "apple_public_feed" | "public_calendar" | "awaiting_feed";
export type CoverageStatus = "unknown" | "observed" | "verified_historical_summary" | "historical_provider_required" | "pending_collection" | "collection_gap";

export type MetricEvidence = {
  primaryUrl: string;
  crossCheckUrl?: string;
  note: Record<Locale, string>;
};

export type AppLineObservation = {
  appId: AppLineId;
  app: Record<Locale, string>;
  hours: number | null;
  source: DataStatus;
  updatedAt: string | null;
  evidence: MetricEvidence | null;
};

export type VersionDetail = {
  id: string;
  gameId: GameId;
  version: string;
  phaseIndex: number;
  phase: Record<Locale, string>;
  date: string;
  endDate: string;
  characters: Record<Locale, string>;
  scope: Record<Locale, string>;
  revenue: number | null;
  revenueRange: [number | null, number | null];
  revenueCoverage: number;
  revenueFormula: string;
  revenueMarketCoverage: MarketCoverage;
  revenueScope: RevenueScope;
  confidence: "A" | "B+" | "B" | "MODEL" | "N/A";
  windowHours: number;
  observedHours: number;
  coverageStatus: CoverageStatus;
  collectionStartedAt: string | null;
  dataStatus: DataStatus;
  sourceUrl: string;
  sourceUpdatedAt: string;
  ranks: Record<"CN" | "JP" | "US" | "KR", [number | null, number | null]>;
  rankBoundaries: Record<"CN" | "JP" | "US" | "KR", { lowestBeyondFeed: boolean; feedLimit: number }>;
  rankEvidence: MetricEvidence | null;
  appHours: AppLineObservation[];
};

export const appLines: Array<{ id: AppLineId; name: Record<Locale, string> }> = [
  { id: "douyin", name: { "zh-CN": "抖音", en: "Douyin" } },
  { id: "tencent_video", name: { "zh-CN": "腾讯视频", en: "Tencent Video" } },
  { id: "qq_music", name: { "zh-CN": "QQ音乐", en: "QQ Music" } },
  { id: "capcut_cn", name: { "zh-CN": "剪映", en: "CapCut CN" } },
  { id: "netease_music", name: { "zh-CN": "网易云音乐", en: "NetEase Cloud Music" } },
  { id: "baidu_netdisk", name: { "zh-CN": "百度网盘", en: "Baidu Netdisk" } },
  { id: "quark", name: { "zh-CN": "夸克网盘", en: "Quark" } },
];
