export type Locale = "zh-CN" | "en";

export type GameId = "genshin" | "hsr" | "zzz" | "wuwa" | "endfield" | "ananta";

export type Game = {
  id: GameId;
  shortName: string;
  name: Record<Locale, string>;
  publisher: string;
  color: string;
  pale: string;
  currentMonth: number | null;
  ytd: number | null;
  change: number | null;
  confidence: "A" | "B+" | "B" | "N/A";
  yearly: number[];
  monthly: number[];
  versions: Array<{ label: string; value: number }>;
};

const unavailableMetrics = {
  currentMonth: null,
  ytd: null,
  change: null,
  confidence: "N/A" as const,
  yearly: [],
  monthly: [],
  versions: [],
};

export const games: Game[] = [
  {
    id: "genshin",
    shortName: "GI",
    name: { "zh-CN": "原神", en: "Genshin Impact" },
    publisher: "HoYoverse",
    color: "#6558D8",
    pale: "#EEECFF",
    ...unavailableMetrics,
  },
  {
    id: "hsr",
    shortName: "HSR",
    name: { "zh-CN": "崩坏：星穹铁道", en: "Honkai: Star Rail" },
    publisher: "HoYoverse",
    color: "#2478D4",
    pale: "#E6F2FF",
    ...unavailableMetrics,
  },
  {
    id: "zzz",
    shortName: "ZZZ",
    name: { "zh-CN": "绝区零", en: "Zenless Zone Zero" },
    publisher: "HoYoverse",
    color: "#E6A10C",
    pale: "#FFF5D7",
    ...unavailableMetrics,
  },
  {
    id: "wuwa",
    shortName: "WW",
    name: { "zh-CN": "鸣潮", en: "Wuthering Waves" },
    publisher: "Kuro Games",
    color: "#00A68E",
    pale: "#DFF8F2",
    ...unavailableMetrics,
  },
  {
    id: "endfield",
    shortName: "EF",
    name: { "zh-CN": "明日方舟：终末地", en: "Arknights: Endfield" },
    publisher: "GRYPHLINE",
    color: "#E85C3A",
    pale: "#FFEAE4",
    ...unavailableMetrics,
  },
  {
    id: "ananta",
    shortName: "AN",
    name: { "zh-CN": "异环", en: "ANANTA" },
    publisher: "NetEase Games",
    color: "#E14983",
    pale: "#FFE8F1",
    ...unavailableMetrics,
  },
];

export type AppLineId =
  | "douyin"
  | "tencent_video"
  | "qq_music"
  | "capcut_cn"
  | "netease_music"
  | "baidu_netdisk"
  | "quark";

export type DataStatus = "verified_manual" | "licensed_feed" | "awaiting_feed";

export type AppLineObservation = {
  appId: AppLineId;
  app: Record<Locale, string>;
  hours: number | null;
  source: DataStatus;
  updatedAt: string | null;
};

export type VersionDetail = {
  id: string;
  gameId: GameId;
  version: string;
  phase: Record<Locale, string>;
  date: string;
  endDate: string;
  characters: Record<Locale, string>;
  scope: Record<Locale, string>;
  revenue: number | null;
  revenueRange: [number | null, number | null];
  confidence: "A" | "B+" | "B" | "N/A";
  observedHours: number;
  dataStatus: DataStatus;
  ranks: Record<"CN" | "JP" | "US" | "KR", [number | null, number | null]>;
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

function observations(
  known: Partial<Record<AppLineId, number>>,
  status: DataStatus = "verified_manual",
  updatedAt = "2026-08-03",
): AppLineObservation[] {
  return appLines.map((app) => ({
    appId: app.id,
    app: app.name,
    hours: Object.prototype.hasOwnProperty.call(known, app.id) ? (known[app.id] ?? null) : null,
    source: Object.prototype.hasOwnProperty.call(known, app.id) ? status : "awaiting_feed",
    updatedAt: Object.prototype.hasOwnProperty.call(known, app.id) ? updatedAt : null,
  }));
}

const emptyRanks: VersionDetail["ranks"] = {
  CN: [null, null],
  JP: [null, null],
  US: [null, null],
  KR: [null, null],
};

// Only observations explicitly corrected by the product owner are included in
// this local fallback. Licensed feeds replace this fallback in production.
export const versionDetails: VersionDetail[] = [
  {
    id: "ww-24-cartethyia",
    gameId: "wuwa",
    version: "2.4",
    phase: { "zh-CN": "卡提希娅卡池", en: "Cartethyia banner" },
    date: "2025-06-12",
    endDate: "2025-07-03",
    characters: { "zh-CN": "卡提希娅", en: "Cartethyia" },
    scope: { "zh-CN": "角色卡池窗口", en: "Character banner window" },
    revenue: null,
    revenueRange: [null, null],
    confidence: "N/A",
    observedHours: 504,
    dataStatus: "verified_manual",
    ranks: { ...emptyRanks },
    appHours: observations({ tencent_video: 18 }),
  },
  {
    id: "ww-31-aemeath",
    gameId: "wuwa",
    version: "3.1",
    phase: { "zh-CN": "爱弥斯卡池", en: "Aemeath banner" },
    date: "2026-02-05",
    endDate: "2026-02-26",
    characters: { "zh-CN": "爱弥斯", en: "Aemeath" },
    scope: { "zh-CN": "角色卡池窗口", en: "Character banner window" },
    revenue: null,
    revenueRange: [null, null],
    confidence: "N/A",
    observedHours: 504,
    dataStatus: "verified_manual",
    ranks: { ...emptyRanks },
    appHours: observations({ tencent_video: 15 }),
  },
  {
    id: "hsr-32-anaxa",
    gameId: "hsr",
    version: "3.2",
    phase: { "zh-CN": "下半卡池", en: "Phase 2 banner" },
    date: "2025-04-30",
    endDate: "2025-05-20",
    characters: { "zh-CN": "那刻夏", en: "Anaxa" },
    scope: { "zh-CN": "角色卡池窗口", en: "Character banner window" },
    revenue: null,
    revenueRange: [null, null],
    confidence: "N/A",
    observedHours: 504,
    dataStatus: "verified_manual",
    ranks: { ...emptyRanks },
    appHours: observations({ douyin: 0 }),
  },
];

export const monthLabels = {
  "zh-CN": [] as string[],
  en: [] as string[],
};

export const yearLabels: string[] = [];
