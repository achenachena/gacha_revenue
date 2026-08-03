export type Locale = "zh-CN" | "en";

export type GameId =
  | "genshin"
  | "hsr"
  | "zzz"
  | "wuwa"
  | "endfield"
  | "ananta";

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

export const games: Game[] = [
  {
    id: "genshin",
    shortName: "GI",
    name: { "zh-CN": "原神", en: "Genshin Impact" },
    publisher: "HoYoverse",
    color: "#6558D8",
    pale: "#EEECFF",
    currentMonth: 2.36,
    ytd: 18.9,
    change: -8.4,
    confidence: "A",
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
    ytd: 21.4,
    change: 12.8,
    confidence: "A",
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
    ytd: 10.8,
    change: 24.6,
    confidence: "A",
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
    ytd: 13.7,
    change: 16.2,
    confidence: "B+",
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
    currentMonth: null,
    ytd: null,
    change: null,
    confidence: "N/A",
    yearly: [0, 0, 0, 0, 0],
    monthly: [0, 0, 0, 0, 0, 0, 0],
    versions: [],
  },
];

export type VersionDetail = {
  id: string;
  gameId: GameId;
  version: string;
  date: string;
  characters: Record<Locale, string>;
  revenue: number | null;
  confidence: "A" | "B+" | "B" | "N/A";
  ranks: Record<"CN" | "JP" | "US" | "KR", [number | null, number | null]>;
  appHours: Array<{ app: Record<Locale, string>; hours: number }>;
};

const standardApps: Array<[Record<Locale, string>, number]> = [
  [{ "zh-CN": "抖音", en: "Douyin" }, 18.4],
  [{ "zh-CN": "腾讯视频", en: "Tencent Video" }, 46.3],
  [{ "zh-CN": "QQ 音乐", en: "QQ Music" }, 72.0],
  [{ "zh-CN": "剪映", en: "CapCut CN" }, 65.5],
  [{ "zh-CN": "网易云音乐", en: "NetEase Music" }, 86.2],
  [{ "zh-CN": "百度网盘", en: "Baidu Netdisk" }, 112.0],
  [{ "zh-CN": "夸克网盘", en: "Quark" }, 119.5],
];

const scaledApps = (scale: number) =>
  standardApps.map(([app, hours]) => ({
    app,
    hours: Number((hours * scale).toFixed(1)),
  }));

export const versionDetails: VersionDetail[] = [
  {
    id: "gi-57",
    gameId: "genshin",
    version: "5.7",
    date: "2025-06-18",
    characters: { "zh-CN": "丝柯克 · 塔利雅", en: "Skirk · Dahlia" },
    revenue: 6.12,
    confidence: "A",
    ranks: { CN: [1, 38], JP: [1, 26], US: [3, 44], KR: [2, 35] },
    appHours: scaledApps(1),
  },
  {
    id: "hsr-32",
    gameId: "hsr",
    version: "3.2",
    date: "2025-04-09",
    characters: { "zh-CN": "遐蝶 · 那刻夏", en: "Castorice · Anaxa" },
    revenue: 6.72,
    confidence: "A",
    ranks: { CN: [1, 31], JP: [1, 19], US: [2, 35], KR: [1, 27] },
    appHours: scaledApps(1.12),
  },
  {
    id: "zzz-20",
    gameId: "zzz",
    version: "2.0",
    date: "2025-06-06",
    characters: { "zh-CN": "仪玄 · 橘福福", en: "Yixuan · Ju Fufu" },
    revenue: 4.36,
    confidence: "A",
    ranks: { CN: [2, 47], JP: [2, 34], US: [7, 62], KR: [4, 51] },
    appHours: scaledApps(0.68),
  },
  {
    id: "ww-24",
    gameId: "wuwa",
    version: "2.4",
    date: "2025-06-12",
    characters: { "zh-CN": "卡提希娅 · 露帕", en: "Cartethyia · Lupa" },
    revenue: 5.12,
    confidence: "B+",
    ranks: { CN: [2, 42], JP: [1, 31], US: [5, 56], KR: [3, 48] },
    appHours: scaledApps(0.82),
  },
  {
    id: "ef-10",
    gameId: "endfield",
    version: "1.0",
    date: "2026-02-06",
    characters: { "zh-CN": "开服卡池", en: "Launch banners" },
    revenue: 2.88,
    confidence: "B",
    ranks: { CN: [3, 54], JP: [5, 71], US: [11, 96], KR: [8, 82] },
    appHours: scaledApps(0.42),
  },
  {
    id: "ananta-pre",
    gameId: "ananta",
    version: "—",
    date: "—",
    characters: { "zh-CN": "预注册阶段", en: "Pre-registration" },
    revenue: null,
    confidence: "N/A",
    ranks: { CN: [null, null], JP: [null, null], US: [null, null], KR: [null, null] },
    appHours: standardApps.map(([app]) => ({ app, hours: 0 })),
  },
];

export const monthLabels = {
  "zh-CN": ["1月", "2月", "3月", "4月", "5月", "6月", "7月"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
};

export const yearLabels = ["2022", "2023", "2024", "2025", "2026 YTD"];

