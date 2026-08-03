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
  endDate: string;
  characters: Record<Locale, string>;
  scope: Record<Locale, string>;
  revenue: number | null;
  revenueRange: [number | null, number | null];
  confidence: "A" | "B+" | "B" | "N/A";
  observedHours: number;
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
    id: "gi-55",
    gameId: "genshin",
    version: "5.5",
    date: "2025-03-26",
    endDate: "2025-05-06",
    characters: { "zh-CN": "瓦雷莎 · 伊安珊", en: "Varesa · Iansan" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 4.74,
    revenueRange: [4.15, 5.38],
    confidence: "A",
    observedHours: 1008,
    ranks: { CN: [2, 51], JP: [2, 39], US: [7, 72], KR: [4, 59] },
    appHours: scaledApps(0.71),
  },
  {
    id: "gi-56",
    gameId: "genshin",
    version: "5.6",
    date: "2025-05-07",
    endDate: "2025-06-17",
    characters: { "zh-CN": "爱可菲 · 伊法", en: "Escoffier · Ifa" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 5.63,
    revenueRange: [4.9, 6.45],
    confidence: "A",
    observedHours: 1008,
    ranks: { CN: [1, 43], JP: [1, 32], US: [5, 58], KR: [3, 47] },
    appHours: scaledApps(0.89),
  },
  {
    id: "gi-57",
    gameId: "genshin",
    version: "5.7",
    date: "2025-06-18",
    endDate: "2025-07-29",
    characters: { "zh-CN": "丝柯克 · 塔利雅", en: "Skirk · Dahlia" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 6.12,
    revenueRange: [5.36, 6.98],
    confidence: "A",
    observedHours: 1008,
    ranks: { CN: [1, 38], JP: [1, 26], US: [3, 44], KR: [2, 35] },
    appHours: scaledApps(1),
  },
  {
    id: "hsr-31",
    gameId: "hsr",
    version: "3.1",
    date: "2025-02-26",
    endDate: "2025-04-08",
    characters: { "zh-CN": "缇宝 · 万敌", en: "Tribbie · Mydei" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 5.84,
    revenueRange: [5.08, 6.71],
    confidence: "A",
    observedHours: 1008,
    ranks: { CN: [1, 36], JP: [1, 24], US: [4, 49], KR: [2, 39] },
    appHours: scaledApps(0.93),
  },
  {
    id: "hsr-32",
    gameId: "hsr",
    version: "3.2",
    date: "2025-04-09",
    endDate: "2025-05-20",
    characters: { "zh-CN": "遐蝶 · 那刻夏", en: "Castorice · Anaxa" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 6.72,
    revenueRange: [5.91, 7.66],
    confidence: "A",
    observedHours: 1008,
    ranks: { CN: [1, 31], JP: [1, 19], US: [2, 35], KR: [1, 27] },
    appHours: scaledApps(1.12),
  },
  {
    id: "hsr-33",
    gameId: "hsr",
    version: "3.3",
    date: "2025-05-21",
    endDate: "2025-07-01",
    characters: { "zh-CN": "风堇 · 赛飞儿", en: "Hyacine · Cipher" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 5.36,
    revenueRange: [4.67, 6.13],
    confidence: "A",
    observedHours: 1008,
    ranks: { CN: [2, 45], JP: [1, 29], US: [6, 61], KR: [3, 46] },
    appHours: scaledApps(0.84),
  },
  {
    id: "zzz-17",
    gameId: "zzz",
    version: "1.7",
    date: "2025-04-23",
    endDate: "2025-06-05",
    characters: { "zh-CN": "薇薇安 · 雨果", en: "Vivian · Hugo" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 3.48,
    revenueRange: [2.97, 4.08],
    confidence: "A",
    observedHours: 1056,
    ranks: { CN: [3, 58], JP: [3, 46], US: [11, 81], KR: [7, 66] },
    appHours: scaledApps(0.49),
  },
  {
    id: "zzz-20",
    gameId: "zzz",
    version: "2.0",
    date: "2025-06-06",
    endDate: "2025-07-15",
    characters: { "zh-CN": "仪玄 · 橘福福", en: "Yixuan · Ju Fufu" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 4.36,
    revenueRange: [3.73, 5.12],
    confidence: "A",
    observedHours: 960,
    ranks: { CN: [2, 47], JP: [2, 34], US: [7, 62], KR: [4, 51] },
    appHours: scaledApps(0.68),
  },
  {
    id: "ww-23",
    gameId: "wuwa",
    version: "2.3",
    date: "2025-04-29",
    endDate: "2025-06-11",
    characters: { "zh-CN": "赞妮 · 夏空", en: "Zani · Ciaccona" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 4.58,
    revenueRange: [3.71, 5.56],
    confidence: "B+",
    observedHours: 1056,
    ranks: { CN: [3, 49], JP: [2, 38], US: [8, 70], KR: [5, 58] },
    appHours: scaledApps(0.7),
  },
  {
    id: "ww-24",
    gameId: "wuwa",
    version: "2.4",
    date: "2025-06-12",
    endDate: "2025-07-23",
    characters: { "zh-CN": "卡提希娅 · 露帕", en: "Cartethyia · Lupa" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 5.12,
    revenueRange: [4.16, 6.25],
    confidence: "B+",
    observedHours: 1008,
    ranks: { CN: [2, 42], JP: [1, 31], US: [5, 56], KR: [3, 48] },
    appHours: scaledApps(0.82),
  },
  {
    id: "ef-10",
    gameId: "endfield",
    version: "1.0",
    date: "2026-02-06",
    endDate: "2026-03-19",
    characters: { "zh-CN": "开服卡池", en: "Launch banners" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 2.88,
    revenueRange: [2.11, 3.72],
    confidence: "B",
    observedHours: 1008,
    ranks: { CN: [3, 54], JP: [5, 71], US: [11, 96], KR: [8, 82] },
    appHours: scaledApps(0.42),
  },
  {
    id: "ef-11",
    gameId: "endfield",
    version: "1.1",
    date: "2026-03-20",
    endDate: "2026-04-30",
    characters: { "zh-CN": "限定卡池", en: "Limited banners" },
    scope: { "zh-CN": "版本窗口", en: "Version window" },
    revenue: 2.12,
    revenueRange: [1.52, 2.82],
    confidence: "B",
    observedHours: 1008,
    ranks: { CN: [5, 73], JP: [8, 91], US: [19, 128], KR: [12, 104] },
    appHours: scaledApps(0.29),
  },
  {
    id: "ananta-pre",
    gameId: "ananta",
    version: "—",
    date: "—",
    endDate: "—",
    characters: { "zh-CN": "预注册阶段", en: "Pre-registration" },
    scope: { "zh-CN": "尚无商业化窗口", en: "No commercial window" },
    revenue: null,
    revenueRange: [null, null],
    confidence: "N/A",
    observedHours: 0,
    ranks: { CN: [null, null], JP: [null, null], US: [null, null], KR: [null, null] },
    appHours: standardApps.map(([app]) => ({ app, hours: 0 })),
  },
];

export const monthLabels = {
  "zh-CN": ["1月", "2月", "3月", "4月", "5月", "6月", "7月"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
};

export const yearLabels = ["2022", "2023", "2024", "2025", "2026 YTD"];
