export type Locale = "zh-CN" | "en";

export type GameId = "genshin" | "hsr" | "zzz" | "wuwa" | "endfield" | "nte";

export type RevenueMonth = {
  year: number;
  month: number;
  value: number;
};

export type Game = {
  id: GameId;
  sourceSlug: string;
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
  yearly: number[];
  monthly: number[];
  versions: Array<{ label: string; value: number }>;
  revenueHistory: RevenueMonth[];
};

export const revenueSource = {
  name: "GachaDash / GachaRevenue",
  url: "https://www.gachadash.com/revenue",
  provider: "Sensor Tower",
  updatedAt: "2026-07-07",
  basis: "mobile_iap_ios_android_usd",
  chinaAndroidMultiplier: 1.75,
} as const;

function sourcedGame(
  game: Omit<Game, "currentMonth" | "currentMonthRange" | "ytd" | "change" | "confidence" | "yearly" | "monthly" | "versions" | "revenueHistory">,
  revenueHistory: RevenueMonth[],
): Game {
  const latest = revenueHistory.at(-1);
  const previous = revenueHistory.at(-2);
  const ytd = revenueHistory.filter((item) => item.year === 2026).reduce((sum, item) => sum + item.value, 0);
  const annual = new Map<number, number>();
  for (const item of revenueHistory) annual.set(item.year, (annual.get(item.year) ?? 0) + item.value);
  return {
    ...game,
    currentMonth: latest?.value ?? null,
    currentMonthRange: null,
    ytd: revenueHistory.length ? ytd : null,
    change: latest && previous ? ((latest.value - previous.value) / previous.value) * 100 : null,
    confidence: revenueHistory.length ? "SOURCE" : "N/A",
    yearly: [...annual.entries()].sort(([a], [b]) => a - b).map(([, value]) => value),
    monthly: revenueHistory.filter((item) => item.year === 2026).map((item) => item.value),
    versions: [],
    revenueHistory,
  };
}

export function updateGameRevenue(game: Game, revenueHistory: RevenueMonth[]): Game {
  return sourcedGame(
    {
      id: game.id,
      sourceSlug: game.sourceSlug,
      shortName: game.shortName,
      name: game.name,
      publisher: game.publisher,
      color: game.color,
      pale: game.pale,
    },
    revenueHistory,
  );
}

export const games: Game[] = [
  sourcedGame(
    {
      id: "genshin",
      sourceSlug: "genshin-impact",
      shortName: "GI",
      name: { "zh-CN": "原神", en: "Genshin Impact" },
      publisher: "HoYoverse",
      color: "#6558D8",
      pale: "#EEECFF",
    },
    [
      { year: 2025, month: 7, value: 42.335 }, { year: 2025, month: 8, value: 27.765 },
      { year: 2025, month: 9, value: 43.875 }, { year: 2025, month: 10, value: 56.725 },
      { year: 2025, month: 11, value: 20.97 }, { year: 2025, month: 12, value: 40.825 },
      { year: 2026, month: 1, value: 66.04 }, { year: 2026, month: 2, value: 55.245 },
      { year: 2026, month: 3, value: 40.11 }, { year: 2026, month: 4, value: 40.105 },
      { year: 2026, month: 5, value: 41.655 }, { year: 2026, month: 6, value: 33.34 },
    ],
  ),
  sourcedGame(
    {
      id: "hsr",
      sourceSlug: "honkai-star-rail",
      shortName: "HSR",
      name: { "zh-CN": "崩坏：星穹铁道", en: "Honkai: Star Rail" },
      publisher: "HoYoverse",
      color: "#2478D4",
      pale: "#E6F2FF",
    },
    [
      { year: 2025, month: 7, value: 92.45 }, { year: 2025, month: 8, value: 29.925 },
      { year: 2025, month: 9, value: 39.535 }, { year: 2025, month: 10, value: 23.45 },
      { year: 2025, month: 11, value: 81.38 }, { year: 2025, month: 12, value: 27.895 },
      { year: 2026, month: 1, value: 8.0375 }, { year: 2026, month: 2, value: 21.135 },
      { year: 2026, month: 3, value: 31.73 }, { year: 2026, month: 4, value: 58.1 },
      { year: 2026, month: 5, value: 38.765 }, { year: 2026, month: 6, value: 28.455 },
    ],
  ),
  sourcedGame(
    {
      id: "zzz",
      sourceSlug: "zenless-zone-zero",
      shortName: "ZZZ",
      name: { "zh-CN": "绝区零", en: "Zenless Zone Zero" },
      publisher: "HoYoverse",
      color: "#E6A10C",
      pale: "#FFF5D7",
    },
    [
      { year: 2025, month: 7, value: 22.96 }, { year: 2025, month: 8, value: 15.925 },
      { year: 2025, month: 9, value: 10.89 }, { year: 2025, month: 10, value: 12.915 },
      { year: 2025, month: 11, value: 10.89 }, { year: 2025, month: 12, value: 27.55 },
      { year: 2026, month: 1, value: 23.245 }, { year: 2026, month: 2, value: 13.35 },
      { year: 2026, month: 3, value: 16.44 }, { year: 2026, month: 4, value: 7.167 },
      { year: 2026, month: 5, value: 9.37 }, { year: 2026, month: 6, value: 9.655 },
    ],
  ),
  sourcedGame(
    {
      id: "wuwa",
      sourceSlug: "wuthering-waves",
      shortName: "WW",
      name: { "zh-CN": "鸣潮", en: "Wuthering Waves" },
      publisher: "Kuro Games",
      color: "#00A68E",
      pale: "#DFF8F2",
    },
    [
      { year: 2025, month: 7, value: 16.875 }, { year: 2025, month: 8, value: 14.875 },
      { year: 2025, month: 9, value: 21.9 }, { year: 2025, month: 10, value: 16.6 },
      { year: 2025, month: 11, value: 18.875 }, { year: 2025, month: 12, value: 23.175 },
      { year: 2026, month: 1, value: 19.15 }, { year: 2026, month: 2, value: 46 },
      { year: 2026, month: 3, value: 11.4 }, { year: 2026, month: 4, value: 14.7 },
      { year: 2026, month: 5, value: 31.75 }, { year: 2026, month: 6, value: 34 },
    ],
  ),
  sourcedGame(
    {
      id: "endfield",
      sourceSlug: "arknights-endfield",
      shortName: "EF",
      name: { "zh-CN": "明日方舟：终末地", en: "Arknights: Endfield" },
      publisher: "GRYPHLINE",
      color: "#E85C3A",
      pale: "#FFEAE4",
    },
    [
      { year: 2026, month: 1, value: 28.55 }, { year: 2026, month: 2, value: 26.08 },
      { year: 2026, month: 3, value: 22.05 }, { year: 2026, month: 4, value: 17.28 },
      { year: 2026, month: 5, value: 4.766 }, { year: 2026, month: 6, value: 9.52 },
    ],
  ),
  sourcedGame(
    {
      id: "nte",
      sourceSlug: "neverness-to-everness",
      shortName: "NTE",
      name: { "zh-CN": "异环", en: "Neverness to Everness" },
      publisher: "Hotta Studio / Perfect World",
      color: "#E14983",
      pale: "#FFE8F1",
    },
    [
      { year: 2026, month: 4, value: 6.74 }, { year: 2026, month: 5, value: 23.575 },
      { year: 2026, month: 6, value: 13.95 },
    ],
  ),
];

export type AppLineId =
  | "douyin"
  | "tencent_video"
  | "qq_music"
  | "capcut_cn"
  | "netease_music"
  | "baidu_netdisk"
  | "quark";

export type DataStatus = "verified_manual" | "licensed_feed" | "apple_public_feed" | "public_calendar" | "awaiting_feed";
export type CoverageStatus = "unknown" | "observed" | "historical_provider_required" | "pending_collection" | "collection_gap";

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
  phaseIndex: number;
  phase: Record<Locale, string>;
  date: string;
  endDate: string;
  characters: Record<Locale, string>;
  scope: Record<Locale, string>;
  revenue: number | null;
  revenueRange: [number | null, number | null];
  confidence: "A" | "B+" | "B" | "N/A";
  windowHours: number;
  observedHours: number;
  coverageStatus: CoverageStatus;
  collectionStartedAt: string | null;
  dataStatus: DataStatus;
  sourceUrl: string;
  sourceUpdatedAt: string;
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
  known: Partial<Record<AppLineId, number>> = {},
  status: DataStatus = "verified_manual",
  updatedAt = "2026-08-03",
): AppLineObservation[] {
  return appLines.map((app) => {
    const present = Object.prototype.hasOwnProperty.call(known, app.id);
    return { appId: app.id, app: app.name, hours: present ? (known[app.id] ?? null) : null, source: present ? status : "awaiting_feed", updatedAt: present ? updatedAt : null };
  });
}

const emptyRanks: VersionDetail["ranks"] = { CN: [null, null], JP: [null, null], US: [null, null], KR: [null, null] };

type BannerSeed = {
  id: string;
  gameId: GameId;
  version: string;
  phaseIndex: number;
  date: string;
  endDate: string;
  zh: string;
  en: string;
  sourceUrl: string;
  sourceUpdatedAt: string;
  knownHours?: Partial<Record<AppLineId, number>>;
};

function banner(seed: BannerSeed): VersionDetail {
  const start = new Date(`${seed.date}T00:00:00Z`).getTime();
  const end = new Date(`${seed.endDate}T00:00:00Z`).getTime();
  const known = Object.keys(seed.knownHours ?? {}).length > 0;
  return {
    id: seed.id,
    gameId: seed.gameId,
    version: seed.version,
    phaseIndex: seed.phaseIndex,
    phase: { "zh-CN": seed.phaseIndex === 1 ? "上半" : seed.phaseIndex === 2 ? "下半" : `第 ${seed.phaseIndex} 期`, en: `Phase ${seed.phaseIndex}` },
    date: seed.date,
    endDate: seed.endDate,
    characters: { "zh-CN": seed.zh, en: seed.en },
    scope: { "zh-CN": "独立卡池窗口", en: "Exact banner window" },
    revenue: null,
    revenueRange: [null, null],
    confidence: "N/A",
    windowHours: Math.max(0, Math.round((end - start) / 3_600_000)),
    observedHours: known ? Math.max(0, Math.round((end - start) / 3_600_000)) : 0,
    coverageStatus: known ? "observed" : "unknown",
    collectionStartedAt: null,
    dataStatus: known ? "verified_manual" : "public_calendar",
    sourceUrl: seed.sourceUrl,
    sourceUpdatedAt: seed.sourceUpdatedAt,
    ranks: { ...emptyRanks },
    appHours: observations(seed.knownHours),
  };
}

const GENSHIN_SOURCE = "https://www.pcgamer.com/games/rpg/genshin-impact-banner-next-current/";
const HSR_SOURCE = "https://www.pcgamer.com/games/rpg/honkai-star-rail-banner-next-current/";
const ZZZ_SOURCE = "https://www.lootbar.com/blog/en/zenless-zone-zero-banner-schedule-history.html";
const WUWA_SOURCE = "https://www.pcgamer.com/games/rpg/wuthering-waves-banner-next-current/";
const ENDFIELD_SOURCE = "https://endfieldhub.org/tools/banner-history";
const NTE_SOURCE = "https://www.pcgamer.com/games/action/neverness-to-everness-banners-next-current-gacha-explained/";

export const versionDetails: VersionDetail[] = [
  // Genshin Impact: every 2026 phase currently present in the cited history.
  banner({ id: "gi-63-p1", gameId: "genshin", version: "6.3", phaseIndex: 1, date: "2026-01-14", endDate: "2026-02-03", zh: "Columbina、Ineffa", en: "Columbina, Ineffa", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-63-p2", gameId: "genshin", version: "6.3", phaseIndex: 2, date: "2026-02-03", endDate: "2026-02-25", zh: "Zibai、Neuvillette", en: "Zibai, Neuvillette", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-64-p1", gameId: "genshin", version: "6.4", phaseIndex: 1, date: "2026-02-25", endDate: "2026-03-17", zh: "Varka、Flins", en: "Varka, Flins", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-64-p2", gameId: "genshin", version: "6.4", phaseIndex: 2, date: "2026-03-17", endDate: "2026-04-08", zh: "Skirk、Escoffier", en: "Skirk, Escoffier", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-65-p1", gameId: "genshin", version: "6.5", phaseIndex: 1, date: "2026-04-08", endDate: "2026-04-28", zh: "Linnea、Chasca", en: "Linnea, Chasca", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-65-p2", gameId: "genshin", version: "6.5", phaseIndex: 2, date: "2026-04-28", endDate: "2026-05-20", zh: "Nefer、Lauma", en: "Nefer, Lauma", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-66-p1", gameId: "genshin", version: "6.6", phaseIndex: 1, date: "2026-05-20", endDate: "2026-06-09", zh: "Nicole、Durin", en: "Nicole, Durin", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-66-p2", gameId: "genshin", version: "6.6", phaseIndex: 2, date: "2026-06-09", endDate: "2026-07-01", zh: "Lohen、Mavuika", en: "Lohen, Mavuika", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-67-p1", gameId: "genshin", version: "6.7", phaseIndex: 1, date: "2026-07-01", endDate: "2026-07-21", zh: "Sandrone、Citlali", en: "Sandrone, Citlali", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),
  banner({ id: "gi-67-p2", gameId: "genshin", version: "6.7", phaseIndex: 2, date: "2026-07-21", endDate: "2026-08-12", zh: "Columbina、Raiden Shogun", en: "Columbina, Raiden Shogun", sourceUrl: GENSHIN_SOURCE, sourceUpdatedAt: "2026-07-23" }),

  // Honkai: Star Rail. Full-patch banners are repeated in each phase they overlap.
  banner({ id: "hsr-38-p2", gameId: "hsr", version: "3.8", phaseIndex: 2, date: "2026-01-07", endDate: "2026-01-28", zh: "Fugue、Lingsha", en: "Fugue, Lingsha", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-38-p3", gameId: "hsr", version: "3.8", phaseIndex: 3, date: "2026-01-28", endDate: "2026-02-13", zh: "Aglaea、Sunday", en: "Aglaea, Sunday", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-40-p1", gameId: "hsr", version: "4.0", phaseIndex: 1, date: "2026-02-13", endDate: "2026-03-03", zh: "Yao Guang、Evernight、Hysilens、Black Swan", en: "Yao Guang, Evernight, Hysilens, Black Swan", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-40-p2", gameId: "hsr", version: "4.0", phaseIndex: 2, date: "2026-03-03", endDate: "2026-03-25", zh: "Yao Guang、Sparxie、Cerydra、Rappa、Sparkle", en: "Yao Guang, Sparxie, Cerydra, Rappa, Sparkle", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-41-p1", gameId: "hsr", version: "4.1", phaseIndex: 1, date: "2026-03-25", endDate: "2026-04-08", zh: "Ashveil、Hyacine", en: "Ashveil, Hyacine", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-41-p2", gameId: "hsr", version: "4.1", phaseIndex: 2, date: "2026-04-08", endDate: "2026-04-22", zh: "Ashveil、Boothill", en: "Ashveil, Boothill", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-42-p1", gameId: "hsr", version: "4.2", phaseIndex: 1, date: "2026-04-22", endDate: "2026-05-13", zh: "Silver Wolf LV.999、The Dahlia、Castorice、Firefly", en: "Silver Wolf LV.999, The Dahlia, Castorice, Firefly", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-42-p2", gameId: "hsr", version: "4.2", phaseIndex: 2, date: "2026-05-13", endDate: "2026-06-02", zh: "Evanescia、Tribbie、Sunday", en: "Evanescia, Tribbie, Sunday", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-43-p1", gameId: "hsr", version: "4.3", phaseIndex: 1, date: "2026-06-01", endDate: "2026-06-24", zh: "Mortenax Blade、Yao Guang", en: "Mortenax Blade, Yao Guang", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-43-p2", gameId: "hsr", version: "4.3", phaseIndex: 2, date: "2026-06-24", endDate: "2026-07-15", zh: "Phainon、Cyrene", en: "Phainon, Cyrene", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-44-p1", gameId: "hsr", version: "4.4", phaseIndex: 1, date: "2026-07-15", endDate: "2026-08-05", zh: "Himeko Nova、Sparxie、Evernight、Dan Heng Permansor Terrae", en: "Himeko Nova, Sparxie, Evernight, Dan Heng Permansor Terrae", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-44-p2", gameId: "hsr", version: "4.4", phaseIndex: 2, date: "2026-08-05", endDate: "2026-08-26", zh: "Himeko Nova、Cerydra、Anaxa、Aventurine", en: "Himeko Nova, Cerydra, Anaxa, Aventurine", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-07-24" }),
  banner({ id: "hsr-32-anaxa", gameId: "hsr", version: "3.2", phaseIndex: 2, date: "2025-04-30", endDate: "2025-05-21", zh: "那刻夏", en: "Anaxa", sourceUrl: HSR_SOURCE, sourceUpdatedAt: "2026-08-03", knownHours: { douyin: 0 } }),

  // Zenless Zone Zero.
  banner({ id: "zzz-25-p1", gameId: "zzz", version: "2.5", phaseIndex: 1, date: "2025-12-30", endDate: "2026-01-21", zh: "Ye Shunguang、Zhao", en: "Ye Shunguang, Zhao", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-25-p2", gameId: "zzz", version: "2.5", phaseIndex: 2, date: "2026-01-21", endDate: "2026-02-06", zh: "Alice、Soldier 0 - Anby、Astra Yao", en: "Alice, Soldier 0 - Anby, Astra Yao", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-26-p1", gameId: "zzz", version: "2.6", phaseIndex: 1, date: "2026-02-06", endDate: "2026-03-04", zh: "Sunna、Yixuan", en: "Sunna, Yixuan", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-26-p2", gameId: "zzz", version: "2.6", phaseIndex: 2, date: "2026-03-04", endDate: "2026-03-24", zh: "Aria、Yuzuha", en: "Aria, Yuzuha", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-27-p1", gameId: "zzz", version: "2.7", phaseIndex: 1, date: "2026-03-24", endDate: "2026-04-15", zh: "Nangong Yu、Yidhari", en: "Nangong Yu, Yidhari", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-27-p2", gameId: "zzz", version: "2.7", phaseIndex: 2, date: "2026-04-15", endDate: "2026-05-06", zh: "Cissia、Seed", en: "Cissia, Seed", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-28-p1", gameId: "zzz", version: "2.8", phaseIndex: 1, date: "2026-05-06", endDate: "2026-05-27", zh: "Promeia、Lucia", en: "Promeia, Lucia", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-28-p2", gameId: "zzz", version: "2.8", phaseIndex: 2, date: "2026-05-27", endDate: "2026-06-17", zh: "Starlight Billy、Orphie & Magus", en: "Starlight Billy, Orphie & Magus", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-30-p1", gameId: "zzz", version: "3.0", phaseIndex: 1, date: "2026-06-17", endDate: "2026-07-08", zh: "Velina、Ye Shunguang", en: "Velina, Ye Shunguang", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-30-p2", gameId: "zzz", version: "3.0", phaseIndex: 2, date: "2026-07-08", endDate: "2026-07-29", zh: "Norma、Sunna", en: "Norma, Sunna", sourceUrl: ZZZ_SOURCE, sourceUpdatedAt: "2026-07-02" }),
  banner({ id: "zzz-31-p1", gameId: "zzz", version: "3.1", phaseIndex: 1, date: "2026-07-29", endDate: "2026-08-19", zh: "Remielle", en: "Remielle", sourceUrl: "https://www.prydwen.gg/zenless/banners", sourceUpdatedAt: "2026-07-29" }),
  banner({ id: "zzz-31-p2", gameId: "zzz", version: "3.1", phaseIndex: 2, date: "2026-08-19", endDate: "2026-09-09", zh: "Sigrid", en: "Sigrid", sourceUrl: "https://www.prydwen.gg/zenless/banners", sourceUpdatedAt: "2026-07-29" }),

  // Wuthering Waves.
  banner({ id: "ww-24-cartethyia", gameId: "wuwa", version: "2.4", phaseIndex: 1, date: "2025-06-12", endDate: "2025-07-03", zh: "卡提希娅", en: "Cartethyia", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-08-03", knownHours: { tencent_video: 18 } }),
  banner({ id: "ww-24-lupa", gameId: "wuwa", version: "2.4", phaseIndex: 2, date: "2025-07-03", endDate: "2025-07-24", zh: "露帕", en: "Lupa", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-30-p2", gameId: "wuwa", version: "3.0", phaseIndex: 2, date: "2026-01-15", endDate: "2026-02-05", zh: "Mornye、Augusta、Iuno", en: "Mornye, Augusta, Iuno", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-31-aemeath", gameId: "wuwa", version: "3.1", phaseIndex: 1, date: "2026-02-05", endDate: "2026-02-26", zh: "爱弥斯、Chisa、露帕", en: "Aemeath, Chisa, Lupa", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-08-03", knownHours: { tencent_video: 15 } }),
  banner({ id: "ww-31-p2", gameId: "wuwa", version: "3.1", phaseIndex: 2, date: "2026-02-26", endDate: "2026-03-19", zh: "Luuk Herssen、Galbrena", en: "Luuk Herssen, Galbrena", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-32-p1", gameId: "wuwa", version: "3.2", phaseIndex: 1, date: "2026-03-19", endDate: "2026-04-09", zh: "Sigrika、仇远", en: "Sigrika, Qiuyuan", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-32-p2", gameId: "wuwa", version: "3.2", phaseIndex: 2, date: "2026-04-09", endDate: "2026-04-30", zh: "Lynae、赞妮、菲比", en: "Lynae, Zani, Phoebe", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-33-p1", gameId: "wuwa", version: "3.3", phaseIndex: 1, date: "2026-04-30", endDate: "2026-05-21", zh: "Hiyuki、Mornye、Iuno", en: "Hiyuki, Mornye, Iuno", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-33-p2", gameId: "wuwa", version: "3.3", phaseIndex: 2, date: "2026-05-21", endDate: "2026-06-08", zh: "Denia、Chisa、Phrolova", en: "Denia, Chisa, Phrolova", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-34-p1", gameId: "wuwa", version: "3.4", phaseIndex: 1, date: "2026-06-08", endDate: "2026-06-18", zh: "Lucy、Rebecca、Lucilla", en: "Lucy, Rebecca, Lucilla", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-34-p2", gameId: "wuwa", version: "3.4", phaseIndex: 2, date: "2026-06-18", endDate: "2026-07-10", zh: "Lucy、Rebecca、Lucilla、卡提希娅", en: "Lucy, Rebecca, Lucilla, Cartethyia", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-35-p1", gameId: "wuwa", version: "3.5", phaseIndex: 1, date: "2026-07-10", endDate: "2026-07-31", zh: "秧秧·玄翎、Lynae、Luuk Herssen", en: "Yangyang: Xuanling, Lynae, Luuk Herssen", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "ww-35-p2", gameId: "wuwa", version: "3.5", phaseIndex: 2, date: "2026-07-31", endDate: "2026-08-21", zh: "穗穗、爱弥斯", en: "Suisui, Aemeath", sourceUrl: WUWA_SOURCE, sourceUpdatedAt: "2026-07-10" }),

  // Endfield follows its real three-banner launch cadence instead of forcing two halves.
  banner({ id: "ef-10-p1", gameId: "endfield", version: "1.0", phaseIndex: 1, date: "2026-01-22", endDate: "2026-02-07", zh: "Laevatain", en: "Laevatain", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-10-p2", gameId: "endfield", version: "1.0", phaseIndex: 2, date: "2026-02-07", endDate: "2026-02-24", zh: "Gilberta", en: "Gilberta", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-10-p3", gameId: "endfield", version: "1.0", phaseIndex: 3, date: "2026-02-24", endDate: "2026-03-12", zh: "Yvonne", en: "Yvonne", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-11-p1", gameId: "endfield", version: "1.1", phaseIndex: 1, date: "2026-03-12", endDate: "2026-03-29", zh: "Tangtang", en: "Tangtang", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-11-p2", gameId: "endfield", version: "1.1", phaseIndex: 2, date: "2026-03-29", endDate: "2026-04-17", zh: "Rossi", en: "Rossi", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-12-p1", gameId: "endfield", version: "1.2", phaseIndex: 1, date: "2026-04-17", endDate: "2026-05-14", zh: "Zhuang Fangyi", en: "Zhuang Fangyi", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-12-p2", gameId: "endfield", version: "1.2", phaseIndex: 2, date: "2026-05-14", endDate: "2026-05-30", zh: "Fest of Brilliance", en: "Fest of Brilliance", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-13-p1", gameId: "endfield", version: "1.3", phaseIndex: 1, date: "2026-06-05", endDate: "2026-06-26", zh: "Mi Fu", en: "Mi Fu", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-13-p2", gameId: "endfield", version: "1.3", phaseIndex: 2, date: "2026-06-26", endDate: "2026-07-16", zh: "Camille", en: "Camille", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-14-p1", gameId: "endfield", version: "1.4", phaseIndex: 1, date: "2026-07-16", endDate: "2026-08-09", zh: "Arcane", en: "Arcane", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),
  banner({ id: "ef-14-p2", gameId: "endfield", version: "1.4", phaseIndex: 2, date: "2026-08-09", endDate: "2026-08-31", zh: "Liino", en: "Liino", sourceUrl: ENDFIELD_SOURCE, sourceUpdatedAt: "2026-07-11" }),

  // Neverness to Everness (异环), not NetEase's ANANTA.
  banner({ id: "nte-10-p1", gameId: "nte", version: "1.0", phaseIndex: 1, date: "2026-04-29", endDate: "2026-05-13", zh: "娜娜莉", en: "Nanally", sourceUrl: NTE_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "nte-10-p2", gameId: "nte", version: "1.0", phaseIndex: 2, date: "2026-05-13", endDate: "2026-06-03", zh: "浔", en: "Hotori", sourceUrl: NTE_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "nte-11-p1", gameId: "nte", version: "1.1", phaseIndex: 1, date: "2026-06-03", endDate: "2026-06-24", zh: "安魂曲", en: "Lacrimosa", sourceUrl: NTE_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "nte-11-p2", gameId: "nte", version: "1.1", phaseIndex: 2, date: "2026-06-24", endDate: "2026-07-08", zh: "卡厄斯", en: "Chaos", sourceUrl: NTE_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "nte-12-p1", gameId: "nte", version: "1.2", phaseIndex: 1, date: "2026-07-08", endDate: "2026-07-29", zh: "真红", en: "Shinku", sourceUrl: NTE_SOURCE, sourceUpdatedAt: "2026-07-10" }),
  banner({ id: "nte-12-p2", gameId: "nte", version: "1.2", phaseIndex: 2, date: "2026-07-29", endDate: "2026-08-19", zh: "伊洛伊", en: "Iroi", sourceUrl: NTE_SOURCE, sourceUpdatedAt: "2026-07-10" }),
];

export const monthLabels = {
  "zh-CN": ["1月", "2月", "3月", "4月", "5月", "6月"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
};

export const yearLabels: string[] = ["2025（7–12月）", "2026 YTD"];
