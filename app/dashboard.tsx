"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  appLines,
  games,
  revenueSource,
  updateGameRevenue,
  versionDetails,
  type Game,
  type GameId,
  type Locale,
  type AppLineId,
  type DataStatus,
  type RevenueMonth,
  type VersionDetail,
} from "./data";

type Period = "month" | "year" | "version";

const subscribeToHydration = () => () => {};

const copy = {
  "zh-CN": {
    nav: ["总览", "趋势", "对比", "版本与角色", "估算公式"],
    navIds: ["overview", "trend", "compare", "versions", "methodology"],
    brand: "二游流水观察",
    brandSub: "GACHA REVENUE ESTIMATES",
    dataBadge: "月流水来自公开源 · 榜单按小时自动观测",
    disclaimer: "月流水采用 Sensor Tower 经 GachaRevenue / GachaDash 发布的移动端估算原值；仅含 iOS + Android，中国安卓按中国 iOS 的 1.75 倍估算，不含 PC / 主机。本站每次访问自动检查来源更新。",
    overviewTitle: "2026 年 6 月移动端流水估算",
    overviewUnit: "单位：百万美元 · iOS + Android · 中国安卓估算 · 不含 PC / 主机",
    monthTotal: "6 月来源值合计",
    ytdTotal: "2026 YTD 合计",
    observed: "数据覆盖",
    update: "SOURCE DATA",
    currentMonth: "6 月来源值",
    currentRange: "区间",
    ytd: "2026 YTD",
    notLive: "暂无可估算收入",
    confidence: "数据状态",
    sourced: "已接入",
    trendTitle: "单游戏流水趋势",
    trendSub: "点击上方游戏卡片切换游戏；纵轴统一从 0 开始",
    month: "按月",
    year: "按年",
    version: "按版本",
    unit: "移动端流水估算（百万美元）",
    monthAxis: "月份",
    yearAxis: "年份",
    versionAxis: "版本",
    peak: "期间最高",
    average: "期间均值",
    latest: "最新一期",
    compareTitle: "游戏间流水比较",
    compareSub: "统一采用同一公开移动端口径比较；不再混入自定义 PC / 主机系数",
    ytdEstimate: "YTD 估算",
    share: "入选游戏占比",
    selected: "已选择",
    versionTitle: "版本 / 卡池角色观测",
    versionSub: "下拉选择每个版本的独立上半 / 下半卡池；卡池日历与榜单观测分别标注来源",
    selectGame: "选择游戏",
    selectBanner: "选择版本 / 卡池角色",
    noVerifiedBanner: "该游戏暂无已核验卡池数据",
    dateWindow: "观察窗口",
    associatedCharacters: "关联角色 / 卡池",
    estimateBasis: "归属口径",
    versionEstimate: "卡池窗口流水估算",
    estimateRange: "P25–P75 区间",
    rankTitle: "各国 iOS 畅销总榜",
    region: "国家 / 地区",
    peakRank: "峰值名次",
    lowRank: "最低名次",
    rankMeaning: "观察窗定义",
    peakMeaning: "最小名次",
    lowMeaning: "最大名次",
    cnLines: "中国区 iOS 应用线超越时长",
    appLine: "应用线",
    result: "是否超过",
    hoursAbove: "累计时长",
    coverage: "占观察窗口",
    exceeded: "超过",
    noHours: "未超过",
    awaitingFeed: "暂无覆盖",
    hours: "小时",
    rankNote: "峰值 = 观察窗口内最小名次；最低 = 最大名次。Apple 公共 feed 只含 Top 200，超出范围时不会伪造精确名次。",
    appLineNote: "每个小时比较一次中国区畅销总榜；当游戏名次小于应用名次时，累计 1 小时。",
    characterNote: "每条记录按独立上半 / 下半开放窗口统计。0 小时只在已有观测时表示确实未超过；暂无覆盖表示采集启用前的历史小时仍需授权 API 回填，二者严格区分。",
    correctionSource: "已核验历史记录",
    licensedSource: "授权排名 feed",
    appleSource: "Apple 畅销榜 RSS 自动观测",
    calendarSource: "卡池日历来源",
    source: "数据来源",
    updatedAt: "校正日期",
    rankingTitle: "单游戏卡池超应用时间排名",
    rankingSub: "选择游戏与应用线，按已有完整或持续自动观测的卡池累计时长排序",
    rankingGame: "排名游戏",
    rankingApp: "比较应用线",
    rankingPosition: "排名",
    versionAndBanner: "版本 / 卡池角色",
    noRankingData: "该游戏在此应用线下暂无已核验观测；不会用未知值参与排名。",
    methodologyTitle: "流水估算公式",
    storeFormulaTitle: "月流水公开口径",
    totalFormulaTitle: "中国安卓补全",
    versionFormulaTitle: "上下半卡池归属",
    hoursFormulaTitle: "应用线时长",
    storeFormula: "M[g,m] = ST(iOS非中国) + ST(Android非中国) + CN[g,m]",
    totalFormula: "CN[g,m] = ST(iOS中国) × (1 + 1.75)",
    versionFormula: "R[g,p] = Σm M[g,m] × W[g,p,m] / W[g,m]",
    hoursFormula: "H[g,v,a] = Σ 1(rank_g,τ < rank_a,τ) × Δτ",
    definitions: [
      ["M", "直接使用来源发布的美元移动端估算，不二次换汇，也不添加 PC、主机或官网直充。"],
      ["1.75", "GachaRevenue 默认的中国 Android / 中国 iOS 倍率；它是公开源假设，不是审计事实。"],
      ["W", "小时权重为各国 iOS 畅销名次的加权 rank^-0.85；月内观测覆盖不足 80% 时不输出卡池流水。"],
      ["R[g,p]", "按上半 / 下半精确开放时间切分；跨月分别在各月内分配，避免平均摊平卡池爆发。"],
    ],
    excludes: "口径：第三方移动端 IAP 市场估算；不含 PC、主机、广告、电商周边与 IP 授权。",
    sources: "数据源说明",
    sourceNote: "竞争游戏不存在可公开核验的真实流水；本站保证来源、口径与计算可追溯，但不会把第三方估算说成厂商审计收入。",
    footer: "二游流水观察",
    footerNote: "Sensor Tower 公开汇总估算 · Apple 榜单自动观测",
  },
  en: {
    nav: ["Overview", "Trend", "Compare", "Versions & banners", "Formula"],
    navIds: ["overview", "trend", "compare", "versions", "methodology"],
    brand: "GACHA REVENUE TRACKER",
    brandSub: "二游流水观察",
    dataBadge: "PUBLIC MONTHLY SOURCE · HOURLY APPLE RANKS",
    disclaimer: "Monthly revenue uses the Sensor Tower estimates published by GachaRevenue / GachaDash: iOS + Android only, China Android estimated at 1.75× China iOS, excluding PC and console. The source is checked automatically.",
    overviewTitle: "June 2026 mobile revenue estimates",
    overviewUnit: "USD millions · iOS + Android · estimated China Android · excludes PC / console",
    monthTotal: "June source total",
    ytdTotal: "2026 YTD total",
    observed: "Model coverage",
    update: "SOURCE DATA",
    currentMonth: "June source value",
    currentRange: "P25–P75",
    ytd: "2026 YTD",
    notLive: "No revenue estimate",
    confidence: "Data status",
    sourced: "connected",
    trendTitle: "Single-game revenue trend",
    trendSub: "Select a game card above; the y-axis always starts at zero",
    month: "Monthly",
    year: "Annual",
    version: "By version",
    unit: "Estimated mobile revenue (USD millions)",
    monthAxis: "Month",
    yearAxis: "Year",
    versionAxis: "Version",
    peak: "Period high",
    average: "Period average",
    latest: "Latest",
    compareTitle: "Cross-game comparison",
    compareSub: "Like-for-like comparison using one public mobile-only basis, without invented PC or console multipliers",
    ytdEstimate: "YTD estimate",
    share: "Selected share",
    selected: "selected",
    versionTitle: "Version / character-banner observations",
    versionSub: "Select the exact first/second phase for each version; calendar and rank sources are tracked separately",
    selectGame: "Select game",
    selectBanner: "Select version / character banner",
    noVerifiedBanner: "No verified banner data for this game",
    dateWindow: "Observation window",
    associatedCharacters: "Associated characters / banners",
    estimateBasis: "Attribution basis",
    versionEstimate: "Window estimate",
    estimateRange: "P25–P75 range",
    rankTitle: "iOS overall grossing ranks",
    region: "Market",
    peakRank: "Peak rank",
    lowRank: "Lowest rank",
    rankMeaning: "Window definition",
    peakMeaning: "Minimum rank",
    lowMeaning: "Maximum rank",
    cnLines: "Hours above China iOS app lines",
    appLine: "App line",
    result: "Result",
    hoursAbove: "Cumulative time",
    coverage: "Window share",
    exceeded: "Above",
    noHours: "Never above",
    awaitingFeed: "No coverage",
    hours: "hours",
    rankNote: "Peak is the minimum rank and lowest is the maximum rank. Apple's public feed is Top 200 only; exact ranks outside it are never invented.",
    appLineNote: "China overall-grossing ranks are compared hourly; one hour is added whenever the game rank is smaller than the app rank.",
    characterNote: "Each row uses the exact phase window. Zero only means genuinely never above when observations exist; no coverage means pre-collector history still needs licensed API backfill.",
    correctionSource: "Verified historical record",
    licensedSource: "Licensed rank feed",
    appleSource: "Automated Apple grossing RSS",
    calendarSource: "Banner calendar source",
    source: "Data source",
    updatedAt: "Correction date",
    rankingTitle: "Per-game banner app-line ranking",
    rankingSub: "Select a game and app line to rank banners with complete or ongoing automatic observations",
    rankingGame: "Ranking game",
    rankingApp: "Comparison app line",
    rankingPosition: "Rank",
    versionAndBanner: "Version / character banner",
    noRankingData: "No verified observation for this game and app line; unknown values are excluded from ranking.",
    methodologyTitle: "Revenue estimation formulas",
    storeFormulaTitle: "Published monthly basis",
    totalFormulaTitle: "China Android completion",
    versionFormulaTitle: "Phase attribution",
    hoursFormulaTitle: "App-line hours",
    storeFormula: "M[g,m] = ST(iOS ex-CN) + ST(Android ex-CN) + CN[g,m]",
    totalFormula: "CN[g,m] = ST(iOS CN) × (1 + 1.75)",
    versionFormula: "R[g,p] = Σm M[g,m] × W[g,p,m] / W[g,m]",
    hoursFormula: "H[g,v,a] = Σ 1(rank_g,τ < rank_a,τ) × Δτ",
    definitions: [
      ["M", "Uses source-published USD mobile estimates directly; no second FX conversion or PC / console uplift."],
      ["1.75", "GachaRevenue's default China Android / China iOS assumption, not audited revenue."],
      ["W", "Hourly rank weight is a market-weighted rank^-0.85; no phase estimate is emitted below 80% monthly coverage."],
      ["R[g,p]", "Uses exact phase timestamps and allocates each overlapping month separately instead of averaging banner spikes."],
    ],
    excludes: "Basis: third-party mobile IAP estimates; excludes PC, console, ads, merchandise, and IP licensing.",
    sources: "Source note",
    sourceNote: "No public source can guarantee competitors' true revenue. This site guarantees traceable provenance and reproducible calculations, not audited publisher results.",
    footer: "Gacha Revenue Tracker · 二游流水观察",
    footerNote: "Sensor Tower public aggregation · automated Apple rank observations",
  },
} as const;

function formatMoney(value: number | null, locale: Locale) {
  if (value === null) return "—";
  return locale === "zh-CN" ? `$${value.toFixed(1)}M` : `$${value.toFixed(1)}M`;
}

function GameMark({ game, small = false }: { game: Game; small?: boolean }) {
  return (
    <span className={`game-mark ${small ? "game-mark-small" : ""}`} style={{ background: game.color }} aria-hidden="true">
      {game.shortName}
    </span>
  );
}

function MiniTrend({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mini-trend" aria-hidden="true">
      {values.slice(-7).map((value, index) => (
        <span key={index} style={{ height: `${Math.max((value / max) * 100, 5)}%`, background: color }} />
      ))}
    </div>
  );
}

function niceAxisMax(maxValue: number) {
  if (maxValue <= 0) return 1;
  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude * 4;
}

function LineChart({
  values,
  labels,
  color,
  locale,
  xAxisTitle,
}: {
  values: number[];
  labels: string[];
  color: string;
  locale: Locale;
  xAxisTitle: string;
}) {
  const chartWidth = 900;
  const chartHeight = 330;
  const margin = { top: 42, right: 28, bottom: 58, left: 76 };
  const plotWidth = chartWidth - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const yMax = niceAxisMax(Math.max(...values, 0));
  const ticks = Array.from({ length: 5 }, (_, index) => (yMax / 4) * index);
  const points = values.map((value, index) => ({
    x: margin.left + (index / Math.max(values.length - 1, 1)) * plotWidth,
    y: margin.top + (1 - value / yMax) * plotHeight,
    value,
    label: labels[index],
  }));
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="line-chart" role="img" aria-label={`${copy[locale].trendTitle}，${copy[locale].unit}`}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        <text className="axis-title axis-title-y" x={margin.left} y="17">{copy[locale].unit}</text>
        {ticks.map((tick) => {
          const y = margin.top + (1 - tick / yMax) * plotHeight;
          return (
            <g key={tick}>
              <line className="chart-grid-line" x1={margin.left} x2={chartWidth - margin.right} y1={y} y2={y} />
              <text className="axis-tick" x={margin.left - 14} y={y + 4} textAnchor="end">{tick.toFixed(tick % 1 === 0 ? 0 : 1)}</text>
            </g>
          );
        })}
        <line className="chart-axis" x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} />
        <line className="chart-axis" x1={margin.left} x2={chartWidth - margin.right} y1={margin.top + plotHeight} y2={margin.top + plotHeight} />
        {points.length > 1 && (
          <polyline className="chart-line" points={linePoints} fill="none" stroke={color} />
        )}
        {points.map((point) => (
          <g key={`${point.label}-${point.value}`}>
            <line className="chart-x-tick" x1={point.x} x2={point.x} y1={margin.top + plotHeight} y2={margin.top + plotHeight + 5} />
            <text className="axis-tick" x={point.x} y={margin.top + plotHeight + 23} textAnchor="middle">{point.label}</text>
            <circle className="chart-dot" cx={point.x} cy={point.y} r="5" fill="#fff" stroke={color}>
              <title>{`${point.label}: $${point.value.toFixed(2)}M`}</title>
            </circle>
            <text className="chart-value-label" x={point.x} y={Math.max(point.y - 12, 31)} textAnchor="middle">{point.value.toFixed(2)}</text>
          </g>
        ))}
        <text className="axis-title axis-title-x" x={margin.left + plotWidth / 2} y={chartHeight - 5} textAnchor="middle">{xAxisTitle}</text>
      </svg>
    </div>
  );
}

const marketNames: Record<"CN" | "JP" | "US" | "KR", Record<Locale, string>> = {
  CN: { "zh-CN": "中国", en: "China" },
  JP: { "zh-CN": "日本", en: "Japan" },
  US: { "zh-CN": "美国", en: "United States" },
  KR: { "zh-CN": "韩国", en: "South Korea" },
};

type VersionsResponse = {
  data?: Array<{
    id: string;
    game_id: GameId;
    version: string;
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

type PublicRevenueResponse = {
  data?: Array<{ game_id: GameId; history: RevenueMonth[]; source_url: string }>;
  meta?: { fetched_at: string };
};

type BannerMetricsResponse = {
  data?: {
    ranks: Partial<Record<"CN" | "JP" | "US" | "KR", {
      peak_rank: number | null;
      lowest_rank: number | null;
      observed_hours: number;
      ranked_hours: number;
      lowest_is_beyond_200: boolean;
    }>>;
    app_line_observations: Array<{
      app_id: AppLineId;
      hours_above: number;
      observed_hours: number;
      updated_at: string | null;
    }>;
    source: "apple_public_feed";
    phase_revenue: { estimate: number | null; coverage: number; formula: string; threshold: number } | null;
  };
};

type BannerMetricsResult = BannerMetricsResponse | null;

function normalizeVersions(payload: VersionsResponse): VersionDetail[] {
  return (payload.data ?? []).map((item) => {
    const startsAt = new Date(item.starts_at);
    const endsAt = new Date(item.ends_at);
    return {
      id: item.id,
      gameId: item.game_id,
      version: item.version,
      phaseIndex: 1,
      phase: { "zh-CN": item.phase_zh, en: item.phase_en },
      date: item.starts_at.slice(0, 10),
      endDate: item.ends_at.slice(0, 10),
      characters: { "zh-CN": item.characters_zh, en: item.characters_en },
      scope: { "zh-CN": "角色卡池窗口", en: "Character banner window" },
      revenue: item.estimate,
      revenueRange: [item.p25, item.p75],
      confidence: item.confidence,
      windowHours: Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 3_600_000)),
      observedHours: item.data_status === "awaiting_feed" ? 0 : Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 3_600_000)),
      dataStatus: item.data_status,
      sourceUrl: "",
      sourceUpdatedAt: item.starts_at.slice(0, 10),
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

export default function Dashboard({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [gameData, setGameData] = useState<Game[]>(games);
  const [selectedGame, setSelectedGame] = useState<GameId>("hsr");
  const [period, setPeriod] = useState<Period>("month");
  const [compareIds, setCompareIds] = useState<GameId[]>(["genshin", "hsr", "zzz", "wuwa"]);
  const [versionGame, setVersionGame] = useState<GameId>("hsr");
  const [selectedVersionId, setSelectedVersionId] = useState("hsr-44-p1");
  const [rankingGame, setRankingGame] = useState<GameId>("wuwa");
  const [rankingApp, setRankingApp] = useState<AppLineId>("tencent_video");
  const [versionsData, setVersionsData] = useState<VersionDetail[]>(versionDetails);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public-revenue", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`public revenue API returned ${response.status}`);
        return response.json() as Promise<PublicRevenueResponse>;
      })
      .then((payload) => {
        if (!payload.data?.length) return;
        setGameData((current) => current.map((game) => {
          const update = payload.data?.find((item) => item.game_id === game.id);
          return update?.history.length ? updateGameRevenue(game, update.history) : game;
        }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to refresh public revenue source", error);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) return;
    const controller = new AbortController();
    fetch(`${apiBase.replace(/\/$/, "")}/versions`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`versions API returned ${response.status}`);
        return response.json() as Promise<VersionsResponse>;
      })
      .then((payload) => {
        const normalized = normalizeVersions(payload);
        if (normalized.length) {
          setVersionsData(normalized);
          setSelectedVersionId((current) => normalized.some((item) => item.id === current) ? current : (normalized.find((item) => item.gameId === "wuwa")?.id ?? normalized[0].id));
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load authorized version data", error);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const metricTarget = versionDetails.find((item) => item.id === selectedVersionId);
    if (!metricTarget) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ game_id: metricTarget.gameId, start: metricTarget.date, end: metricTarget.endDate });
    fetch(`/api/banner-metrics?${query}`, { signal: controller.signal })
      .then((response) => {
        if (response.status === 503) return null;
        if (!response.ok) throw new Error(`banner metrics API returned ${response.status}`);
        return response.json() as Promise<BannerMetricsResult>;
      })
      .then((payload) => {
        const metrics = payload?.data;
        if (!metrics) return;
        const observedHours = Math.max(
          0,
          ...Object.values(metrics.ranks).map((item) => Number(item?.observed_hours ?? 0)),
          ...metrics.app_line_observations.map((item) => Number(item.observed_hours ?? 0)),
        );
        if (!observedHours) return;
        setVersionsData((current) => current.map((version) => {
          if (version.id !== metricTarget.id) return version;
          const ranks = { ...version.ranks };
          for (const market of ["CN", "JP", "US", "KR"] as const) {
            const row = metrics.ranks[market];
            if (row?.observed_hours) ranks[market] = [row.peak_rank, row.lowest_rank];
          }
          const appHours = version.appHours.map((line) => {
            const row = metrics.app_line_observations.find((item) => item.app_id === line.appId);
            if (!row?.observed_hours) return line;
            return { ...line, hours: Number(row.hours_above), source: "apple_public_feed" as const, updatedAt: row.updated_at?.slice(0, 10) ?? null };
          });
          const phaseEstimate = metrics.phase_revenue?.estimate ?? null;
          return {
            ...version,
            ranks,
            appHours,
            observedHours,
            revenue: phaseEstimate,
            confidence: phaseEstimate === null ? "N/A" : "B",
            dataStatus: "apple_public_feed",
          };
        }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load automatic Apple rank observations", error);
      });
    return () => controller.abort();
  }, [selectedVersionId]);

  const activeGame = gameData.find((game) => game.id === selectedGame) ?? gameData[0];
  const selectedVersion = versionsData.find((version) => version.id === selectedVersionId);
  const visibleVersions = versionsData.filter((item) => item.gameId === versionGame).sort((a, b) => b.date.localeCompare(a.date));
  const comparisonGames = gameData.filter((game) => compareIds.includes(game.id) && game.ytd !== null);
  const compareTotal = comparisonGames.reduce((sum, game) => sum + (game.ytd ?? 0), 0);
  const monthlyTotal = gameData.reduce((sum, game) => sum + (game.currentMonth ?? 0), 0);
  const ytdTotal = gameData.reduce((sum, game) => sum + (game.ytd ?? 0), 0);
  const modelledGameCount = gameData.filter((game) => game.currentMonth !== null).length;

  const trend = useMemo(() => {
    if (period === "year") {
      const years = [...new Set(activeGame.revenueHistory.map((item) => item.year))];
      return { values: activeGame.yearly, labels: years.map((year) => year === 2026 ? "2026 YTD" : `${year}`), xAxis: t.yearAxis };
    }
    if (period === "version") {
      return {
        values: activeGame.versions.map((item) => item.value),
        labels: activeGame.versions.map((item) => item.label),
        xAxis: t.versionAxis,
      };
    }
    const months = activeGame.revenueHistory.filter((item) => item.year === 2026).map((item) => item.month);
    return { values: activeGame.monthly, labels: months.map((month) => locale === "zh-CN" ? `${month}月` : new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 1)))), xAxis: t.monthAxis };
  }, [activeGame, locale, period, t.monthAxis, t.versionAxis, t.yearAxis]);

  const stats = useMemo(() => {
    const populated = trend.values.filter((value) => value > 0);
    if (!populated.length) return { peak: null, average: null, latest: null };
    return {
      peak: Math.max(...populated),
      average: populated.reduce((sum, value) => sum + value, 0) / populated.length,
      latest: populated[populated.length - 1],
    };
  }, [trend]);

  const maxAppHours = Math.max(...(selectedVersion?.appHours.map((item) => item.hours ?? 0) ?? []), 1);
  const bannerRanking = useMemo(
    () =>
      versionsData
        .map((version) => ({
          version,
          observation: version.appHours.find((item) => item.appId === rankingApp),
        }))
        .filter(
          (item): item is typeof item & { observation: NonNullable<typeof item.observation> } =>
            item.version.gameId === rankingGame && item.observation?.hours !== null && item.observation?.hours !== undefined,
        )
        .sort((a, b) => (b.observation.hours ?? 0) - (a.observation.hours ?? 0)),
    [rankingApp, rankingGame, versionsData],
  );

  const toggleCompare = (id: GameId) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.length <= 2 ? current : current.filter((gameId) => gameId !== id);
      return [...current, id];
    });
  };

  const changeVersionGame = (gameId: GameId) => {
    setVersionGame(gameId);
    const first = versionsData.filter((item) => item.gameId === gameId).sort((a, b) => b.date.localeCompare(a.date))[0];
    setSelectedVersionId(first?.id ?? "");
  };

  return (
    <main data-hydrated={hydrated ? "true" : "false"}>
      <header className="site-header">
        <a className="brand" href={`/${locale}`} aria-label={t.footer}>
          <span className="brand-symbol"><i /><i /><i /></span>
          <span><strong>{t.brand}</strong><small>{t.brandSub}</small></span>
        </a>
        <nav aria-label="Primary navigation">
          {t.nav.map((label, index) => <a key={label} href={`#${t.navIds[index]}`}>{label}</a>)}
        </nav>
        <div className="header-actions">
          <span className="snapshot-badge">{t.dataBadge}</span>
          <a className={locale === "zh-CN" ? "active" : ""} href="/zh-CN">中</a><span>/</span>
          <a className={locale === "en" ? "active" : ""} href="/en">EN</a>
        </div>
      </header>

      <div className="demo-banner"><span>i</span>{t.disclaimer}</div>

      <section className="overview-strip" id="overview">
        <div className="overview-heading">
          <p className="section-kicker">OVERVIEW · {t.update}</p>
          <h1>{t.overviewTitle}</h1>
          <p>{t.overviewUnit}</p>
        </div>
        <div className="overview-kpis">
          <div><span>{t.monthTotal}</span><strong>{formatMoney(monthlyTotal, locale)}</strong></div>
          <div><span>{t.ytdTotal}</span><strong>{formatMoney(ytdTotal, locale)}</strong></div>
          <div><span>{t.observed}</span><strong>{modelledGameCount} / {gameData.length}</strong></div>
        </div>
      </section>

      <section className="game-grid" aria-label={t.currentMonth}>
        {gameData.map((game) => {
          const active = game.id === selectedGame;
          return (
            <button
              key={game.id}
              className={`game-card ${active ? "active" : ""}`}
              onClick={() => setSelectedGame(game.id)}
              aria-pressed={active}
              style={{ "--game-color": game.color, "--game-pale": game.pale } as React.CSSProperties}
            >
              <div className="game-card-top">
                <GameMark game={game} />
                <span className={`confidence confidence-${game.confidence.replace("+", "plus")}`}>{t.confidence} {game.confidence === "SOURCE" ? t.sourced : game.confidence}</span>
              </div>
              <div className="game-name"><strong>{game.name[locale]}</strong><span>{game.publisher}</span></div>
              {game.currentMonth === null ? (
                <div className="not-live"><b>—</b><span>{t.notLive}</span></div>
              ) : (
                <>
                  <div className="card-money">
                    <strong>{formatMoney(game.currentMonth, locale)}</strong>
                    <span>{t.currentMonth}</span>
                  </div>
                  <div className="card-foot">
                    <span>{t.ytd} <b>{formatMoney(game.ytd, locale)}</b></span>
                    <span className={game.change && game.change > 0 ? "positive" : "negative"}>{game.change === null ? "—" : `${game.change > 0 ? "+" : ""}${game.change.toFixed(1)}%`}</span>
                  </div>
                  <MiniTrend values={game.monthly} color={game.color} />
                </>
              )}
            </button>
          );
        })}
      </section>

      <section className="panel trend-panel" id="trend">
        <div className="panel-heading">
          <div><p className="section-kicker">01 · TREND</p><h2>{t.trendTitle}</h2><p>{t.trendSub}</p></div>
          <div className="period-switch" role="group" aria-label={t.trendSub}>
            {(["month", "year", "version"] as Period[]).map((item) => (
              <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)} aria-pressed={period === item}>{t[item]}</button>
            ))}
          </div>
        </div>
        <div className="trend-layout">
          <div className="trend-main">
            <div className="chart-title-row"><div><GameMark game={activeGame} small /><strong>{activeGame.name[locale]}</strong></div><span>{t.unit}</span></div>
            {trend.values.length && trend.values.some((value) => value > 0) ? (
              <LineChart values={trend.values} labels={trend.labels} color={activeGame.color} locale={locale} xAxisTitle={trend.xAxis} />
            ) : <div className="empty-chart">{t.notLive}</div>}
          </div>
          <aside className="trend-stats">
            <div><span>{t.peak}</span><strong>{formatMoney(stats.peak, locale)}</strong></div>
            <div><span>{t.average}</span><strong>{formatMoney(stats.average, locale)}</strong></div>
            <div><span>{t.latest}</span><strong>{formatMoney(stats.latest, locale)}</strong></div>
            <p><i style={{ background: activeGame.color }} />{activeGame.name[locale]} · {period === "month" ? "2026" : period === "year" ? "2022—2026" : t.versionAxis}</p>
          </aside>
        </div>
      </section>

      <section className="panel comparison-panel" id="compare">
        <div className="panel-heading">
          <div><p className="section-kicker">02 · COMPARE</p><h2>{t.compareTitle}</h2><p>{t.compareSub}</p></div>
          <span className="selected-count">{compareIds.length} {t.selected}</span>
        </div>
        <div className="game-toggles">
          {gameData.map((game) => (
            <button key={game.id} className={compareIds.includes(game.id) ? "active" : ""} onClick={() => toggleCompare(game.id)} aria-pressed={compareIds.includes(game.id)} style={{ "--game-color": game.color } as React.CSSProperties}>
              <span style={{ background: game.color }} />{game.name[locale]}
            </button>
          ))}
        </div>
        <div className="compare-bars">
          {[...comparisonGames].sort((a, b) => (b.ytd ?? 0) - (a.ytd ?? 0)).map((game, index) => (
            <div className="compare-row" key={game.id}>
              <span className="compare-rank">0{index + 1}</span>
              <div className="compare-game"><GameMark game={game} small /><strong>{game.name[locale]}</strong></div>
              <div className="compare-bar-track"><span style={{ width: `${((game.ytd ?? 0) / Math.max(...comparisonGames.map((item) => item.ytd ?? 0), 1)) * 100}%`, background: game.color }} /></div>
              <div className="compare-value"><strong>{formatMoney(game.ytd, locale)}</strong><small>{t.ytdEstimate}</small></div>
              <div className="compare-share"><strong>{compareTotal ? (((game.ytd ?? 0) / compareTotal) * 100).toFixed(1) : 0}%</strong><small>{t.share}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel versions-panel" id="versions">
        <div className="panel-heading">
          <div><p className="section-kicker">03 · VERSION / BANNER</p><h2>{t.versionTitle}</h2><p>{t.versionSub}</p></div>
          <div className="verified-only-badge">✓ {t.dataBadge}</div>
        </div>

        <div className="version-selectors">
          <label>
            <span>{t.selectGame}</span>
            <select value={versionGame} onChange={(event) => changeVersionGame(event.target.value as GameId)} aria-label={t.selectGame}>
              {gameData.map((game) => <option key={game.id} value={game.id}>{game.name[locale]}</option>)}
            </select>
          </label>
          <label>
            <span>{t.selectBanner}</span>
            <select value={selectedVersionId} disabled={!visibleVersions.length} onChange={(event) => setSelectedVersionId(event.target.value)} aria-label={t.selectBanner}>
              {!visibleVersions.length && <option value="">{t.noVerifiedBanner}</option>}
              {visibleVersions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.version} · {item.phase[locale]} · UP {item.characters[locale]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedVersion ? (
          <>
            <div className="version-summary">
              <div className="version-identity">
                <span>{t.associatedCharacters}</span>
                <strong>UP · {selectedVersion.characters[locale]}</strong>
                <small>{gameData.find((game) => game.id === selectedVersion.gameId)?.name[locale]} · {selectedVersion.version} · {selectedVersion.phase[locale]}</small>
              </div>
              <div><span>{t.dateWindow}</span><strong>{selectedVersion.date}<i>→</i>{selectedVersion.endDate}</strong><small>{selectedVersion.observedHours} / {selectedVersion.windowHours} {t.hours}</small></div>
              <div><span>{t.estimateBasis}</span><strong>{selectedVersion.scope[locale]}</strong><small><a href={selectedVersion.sourceUrl} target="_blank" rel="noreferrer">{t.calendarSource} ↗</a> · {selectedVersion.sourceUpdatedAt}</small></div>
              <div className="version-money"><span>{t.versionEstimate}</span><strong>{formatMoney(selectedVersion.revenue, locale)}</strong><small>{selectedVersion.dataStatus === "verified_manual" ? t.correctionSource : t.appleSource} · {selectedVersion.observedHours}/{selectedVersion.windowHours}h</small></div>
            </div>

            <div className="intelligence-grid">
              <section className="rank-section">
                <h3>{t.rankTitle}</h3>
                <div className="table-scroll">
                  <table className="rank-table">
                    <thead><tr><th>{t.region}</th><th>{t.peakRank}</th><th>{t.lowRank}</th><th>{t.rankMeaning}</th></tr></thead>
                    <tbody>
                      {(Object.entries(selectedVersion.ranks) as Array<["CN" | "JP" | "US" | "KR", [number | null, number | null]]>).map(([country, rank]) => (
                        <tr key={country}><td><b>{country}</b>{marketNames[country][locale]}</td><td><strong>{rank[0] === null ? "—" : `#${rank[0]}`}</strong><small>{rank[0] === null ? t.awaitingFeed : t.peakMeaning}</small></td><td><strong>{rank[1] === null ? "—" : `#${rank[1]}`}</strong><small>{rank[1] === null ? t.awaitingFeed : t.lowMeaning}</small></td><td>{selectedVersion.date}<br />{selectedVersion.endDate}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="table-note">{t.rankNote}</p>
              </section>

              <section className="app-line-section">
                <h3>{t.cnLines}</h3>
                <div className="table-scroll">
                  <table className="app-line-table">
                    <thead><tr><th>{t.appLine}</th><th>{t.result}</th><th>{t.hoursAbove}</th><th>{t.source}</th></tr></thead>
                    <tbody>
                      {selectedVersion.appHours.map((item) => {
                        const known = item.hours !== null;
                        return (
                          <tr key={item.appId}>
                            <td><strong>{item.app[locale]}</strong></td>
                            <td><span className={`line-result ${known && (item.hours ?? 0) > 0 ? "yes" : "no"}`}>{!known ? t.awaitingFeed : (item.hours ?? 0) > 0 ? t.exceeded : t.noHours}</span></td>
                            <td><div className="hours-cell"><i><b style={{ width: known ? `${((item.hours ?? 0) / maxAppHours) * 100}%` : "0%" }} /></i><strong>{known ? `${item.hours} ${t.hours}` : "—"}</strong></div></td>
                            <td><span className="source-cell">{item.source === "licensed_feed" ? t.licensedSource : item.source === "apple_public_feed" ? t.appleSource : item.source === "verified_manual" ? t.correctionSource : t.awaitingFeed}{item.updatedAt && <small>{item.updatedAt}</small>}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="table-note">{t.appLineNote}</p>
              </section>
            </div>
            <p className="character-note">{t.characterNote}</p>
          </>
        ) : <div className="verified-empty">{t.noVerifiedBanner}</div>}

        <section className="banner-ranking-section">
          <div className="ranking-heading">
            <div><p className="section-kicker">RANKING · VERIFIED HOURS</p><h3>{t.rankingTitle}</h3><p>{t.rankingSub}</p></div>
            <div className="ranking-controls">
              <label><span>{t.rankingGame}</span><select value={rankingGame} onChange={(event) => setRankingGame(event.target.value as GameId)} aria-label={t.rankingGame}>{gameData.map((game) => <option key={game.id} value={game.id}>{game.name[locale]}</option>)}</select></label>
              <label><span>{t.rankingApp}</span><select value={rankingApp} onChange={(event) => setRankingApp(event.target.value as AppLineId)} aria-label={t.rankingApp}>{appLines.map((app) => <option key={app.id} value={app.id}>{app.name[locale]}</option>)}</select></label>
            </div>
          </div>
          {bannerRanking.length ? (
            <div className="table-scroll">
              <table className="banner-ranking-table">
                <thead><tr><th>{t.rankingPosition}</th><th>{t.versionAndBanner}</th><th>{t.dateWindow}</th><th>{t.hoursAbove}</th><th>{t.source}</th></tr></thead>
                <tbody>{bannerRanking.map(({ version, observation }, index) => (
                  <tr key={version.id}><td><strong>{`#${index + 1}`}</strong></td><td><b>{`${version.version} · ${version.phase[locale]} · UP ${version.characters[locale]}`}</b></td><td>{version.date}<i>→</i>{version.endDate}</td><td><strong>{`${observation.hours} ${t.hours}`}</strong></td><td><span className="source-cell">{observation.source === "licensed_feed" ? t.licensedSource : observation.source === "apple_public_feed" ? t.appleSource : t.correctionSource}{observation.updatedAt && <small>{observation.updatedAt}</small>}</span></td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="verified-empty">{t.noRankingData}</div>}
        </section>
      </section>

      <section className="methodology" id="methodology">
        <div className="method-heading"><p className="section-kicker">04 · FORMULA</p><h2>{t.methodologyTitle}</h2><p>{t.excludes}</p></div>
        <div className="formula-grid">
          {[
            [t.storeFormulaTitle, t.storeFormula],
            [t.totalFormulaTitle, t.totalFormula],
            [t.versionFormulaTitle, t.versionFormula],
            [t.hoursFormulaTitle, t.hoursFormula],
          ].map(([title, formula], index) => (
            <div className="formula-row" key={title}><span>0{index + 1}</span><div><strong>{title}</strong><code>{formula}</code></div></div>
          ))}
        </div>
        <div className="formula-definitions">
          {t.definitions.map(([symbol, definition]) => <div key={symbol}><code>{symbol}</code><p>{definition}</p></div>)}
          <div className="source-links"><strong>{t.sources}</strong><a href={revenueSource.url} target="_blank" rel="noreferrer">GachaDash / GachaRevenue ↗</a><a href="https://sensortower.com/product/mobile-app/app-performance-insights" target="_blank" rel="noreferrer">Sensor Tower ↗</a><a href="https://itunes.apple.com/cn/rss/topgrossingapplications/limit=200/json" target="_blank" rel="noreferrer">Apple Top Grossing RSS ↗</a></div>
          <p className="source-note">{t.sourceNote}</p>
        </div>
      </section>

      <footer><strong>{t.footer}</strong><span>{t.footerNote}</span><a href="#overview">↑ TOP</a></footer>
    </main>
  );
}
