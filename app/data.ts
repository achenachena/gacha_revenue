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
  currentMonthRange: [number, number] | null;
  ytd: number | null;
  change: number | null;
  confidence: "A" | "B+" | "B" | "N/A";
  yearly: number[];
  monthly: number[];
  versions: Array<{ label: string; value: number }>;
};

const unavailableMetrics = {
  currentMonth: null,
  currentMonthRange: null,
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
    currentMonth: 2.36,
    currentMonthRange: [1.89, 2.95],
    ytd: 18.9,
    change: -8.4,
    confidence: "B+",
    yearly: [97.1, 63.8, 48.2, 41.7, 18.9],
    monthly: [3.15, 2.74, 3.02, 2.58, 2.83, 2.61, 2.36],
    versions: [
      { label: "5.4", value: 5.28 },
      { label: "5.5", value: 4.74 },
      { label: "5.6", value: 5.63 },
      { label: "5.7", value: 6.12 },
    ],
  },
  {
    id: "hsr",
    shortName: "HSR",
    name: { "zh-CN": "崩坏：星穹铁道", en: "Honkai: Star Rail" },
    publisher: "HoYoverse",
    color: "#2478D4",
    pale: "#E6F2FF",
    currentMonth: 2.98,
    currentMonthRange: [2.38, 3.73],
    ytd: 21.4,
    change: 12.8,
    confidence: "B+",
    yearly: [0, 39.6, 47.8, 43.1, 21.4],
    monthly: [3.42, 2.95, 3.84, 2.71, 3.19, 2.31, 2.98],
    versions: [
      { label: "3.1", value: 5.84 },
      { label: "3.2", value: 6.72 },
      { label: "3.3", value: 5.36 },
      { label: "3.4", value: 6.08 },
    ],
  },
  {
    id: "zzz",
    shortName: "ZZZ",
    name: { "zh-CN": "绝区零", en: "Zenless Zone Zero" },
    publisher: "HoYoverse",
    color: "#E6A10C",
    pale: "#FFF5D7",
    currentMonth: 1.42,
    currentMonthRange: [1.14, 1.78],
    ytd: 10.8,
    change: 24.6,
    confidence: "B+",
    yearly: [0, 0, 11.7, 24.6, 10.8],
    monthly: [1.58, 1.26, 1.88, 1.32, 1.74, 1.6, 1.42],
    versions: [
      { label: "1.5", value: 3.76 },
      { label: "1.6", value: 3.12 },
      { label: "1.7", value: 3.48 },
      { label: "2.0", value: 4.36 },
    ],
  },
  {
    id: "wuwa",
    shortName: "WW",
    name: { "zh-CN": "鸣潮", en: "Wuthering Waves" },
    publisher: "Kuro Games",
    color: "#00A68E",
    pale: "#DFF8F2",
    currentMonth: 1.89,
    currentMonthRange: [1.42, 2.46],
    ytd: 13.7,
    change: 16.2,
    confidence: "B",
    yearly: [0, 0, 10.2, 23.8, 13.7],
    monthly: [1.44, 1.31, 2.05, 1.67, 2.42, 2.92, 1.89],
    versions: [
      { label: "2.1", value: 3.42 },
      { label: "2.2", value: 3.06 },
      { label: "2.3", value: 4.58 },
      { label: "2.4", value: 5.12 },
    ],
  },
  {
    id: "endfield",
    shortName: "EF",
    name: { "zh-CN": "明日方舟：终末地", en: "Arknights: Endfield" },
    publisher: "GRYPHLINE",
    color: "#E85C3A",
    pale: "#FFEAE4",
    currentMonth: 1.64,
    currentMonthRange: [1.23, 2.13],
    ytd: 7.2,
    change: -5.8,
    confidence: "B",
    yearly: [0, 0, 0, 0, 7.2],
    monthly: [0, 0.95, 1.4, 1.22, 1.02, 0.97, 1.64],
    versions: [
      { label: "1.0", value: 2.88 },
      { label: "1.1", value: 2.12 },
      { label: "1.2", value: 1.86 },
      { label: "1.3", value: 2.34 },
    ],
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
  "zh-CN": ["1月", "2月", "3月", "4月", "5月", "6月", "7月"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
};

export const yearLabels: string[] = ["2022", "2023", "2024", "2025", "2026 YTD"];
