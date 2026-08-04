"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  type VersionDetail,
} from "./data";
import { historicalRevenueSource } from "./revenue-history";
import {
  applyBannerMetrics,
  loadExchangeRate,
  loadBannerMetricSet,
  loadBannerMetrics,
  loadPublicRevenue,
  loadVersions,
  mergeRevenue,
  type BannerMetricsData,
  type ExchangeRateData,
} from "./api-client";
import {
  buildMonthlyRevenueSeries,
  buildVersionRangeOptions,
  buildVersionRevenueSeries,
  buildYearlyRevenueSeries,
  defaultVersionRange,
  highestYTDGameId,
  latestRevenuePeriod,
  sortVersions,
  versionPhaseKey,
  type VersionRange,
} from "./revenue-model";

type Period = "month" | "year" | "version";

const subscribeToHydration = () => () => {};

const defaultExchangeRate: ExchangeRateData = {
  date: "2026-08-03",
  base: "USD",
  quote: "CNY",
  rate: 6.7526,
  provider: "European Central Bank via Frankfurter",
  source_url: "https://api.frankfurter.dev/v2/rate/USD/CNY?providers=ECB",
  fallback: true,
};

const copy = {
  "zh-CN": {
    nav: ["总览", "趋势", "对比", "版本与角色", "估算公式"],
    navIds: ["overview", "trend", "compare", "versions", "methodology"],
    brand: "二游流水观察",
    brandSub: "GACHA REVENUE ESTIMATES",
    dataBadge: "月流水来自公开源 · 榜单按小时自动观测",
    disclaimer: "月流水采用 Sensor Tower 经 GachaRevenue / GachaDash 发布的移动端估算原值；仅含 iOS + Android，中国安卓按中国 iOS 的 1.75 倍估算，不含 PC / 主机。中文按 ECB 每日参考汇率换算成人民币。",
    overviewUnit: "单位：亿元人民币 · iOS + Android · 中国安卓估算 · 不含 PC / 主机",
    observed: "数据覆盖",
    update: "SOURCE DATA",
    notLive: "暂无可估算收入",
    confidence: "数据状态",
    sourced: "已接入",
    trendTitle: "单游戏流水趋势",
    trendSub: "点击上方游戏卡片切换游戏；纵轴统一从 0 开始",
    month: "按月",
    year: "按年",
    version: "按版本",
    versionRange: "小版本显示范围",
    rangeStart: "起始小版本",
    rangeEnd: "结束小版本",
    fullRange: "选择开服至今",
    rangeSummary: "已选 {selected} 个小版本，其中 {estimable} 个有月流水覆盖",
    noMonthlyCoverage: "暂无月流水覆盖",
    calendarCoverageNote: "版本目录已覆盖开服至今；没有可靠卡池日期或流水的历史期次会明确留空。",
    monthCoverageNote: "开服至今共 {available} 个月；当前可靠来源覆盖 {covered} 个月，缺失月份保留为空。横向滚动可查看完整历史。",
    yearCoverageNote: "开服至今共 {available} 个年度节点；标注“部分”的年份只有部分月份来源值。",
    firstPeriod: "查看开服",
    latestPeriod: "查看最新",
    calendarPending: "卡池日期待补充",
    catalogCount: "开服至今共 {count} 个小版本条目",
    versionModelNote: "版本值按卡池窗口与已发布月流水的重叠小时比例归属；尚无月流水覆盖的卡池不进入图表。",
    unit: "移动端流水估算（亿元人民币）",
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
	historicalRequired: "采集启用前，需授权历史小时榜回填",
	pendingCollection: "卡池尚未开始，开始后按小时自动更新",
	collectionGap: "观察窗口内暂无可用快照",
	observedCoverage: "已按小时自动观测",
    hours: "小时",
    rankNote: "峰值 = 观察窗口内最小名次；最低 = 最大可见名次。Apple 公共 feed 当前返回 Top 100，掉出范围时不会伪造精确名次。",
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
      ["M", "直接使用来源发布的美元移动端估算，不添加 PC、主机或官网直充。"],
      ["1.75", "GachaRevenue 默认的中国 Android / 中国 iOS 倍率；它是公开源假设，不是审计事实。"],
      ["W", "小时权重为各国 iOS 畅销名次的加权 rank^-0.85；月内观测覆盖不足 80% 时不输出卡池流水。"],
      ["R[g,p]", "按上半 / 下半精确开放时间切分；跨月分别在各月内分配，避免平均摊平卡池爆发。"],
      ["FX", "人民币仅用于展示：美元估算 × ECB 当日 USD/CNY 参考汇率；底层来源值仍以美元保存。"],
    ],
    excludes: "口径：第三方移动端 IAP 市场估算；不含 PC、主机、广告、电商周边与 IP 授权。",
    sources: "数据源说明",
    historicalSource: "GACHAREVENUE 历史数据",
    sourceChangelog: "来源更新记录",
    sourceNote: "竞争游戏不存在可公开核验的真实流水；本站保证来源、口径与计算可追溯，但不会把第三方估算说成厂商审计收入。",
    fxNote: "人民币按 ECB 每日 USD/CNY 参考汇率换算",
    sourceDelay: "公开源尚未发布；来源通常在月末后 2–4 周更新。",
    footer: "二游流水观察",
    footerNote: "Sensor Tower 公开汇总估算 · Apple 榜单自动观测",
  },
  en: {
    nav: ["Overview", "Trend", "Compare", "Versions & banners", "Formula"],
    navIds: ["overview", "trend", "compare", "versions", "methodology"],
    brand: "GACHA REVENUE TRACKER",
    brandSub: "二游流水观察",
    dataBadge: "PUBLIC MONTHLY SOURCE · HOURLY APPLE RANKS",
    disclaimer: "Monthly revenue uses the Sensor Tower estimates published by GachaRevenue / GachaDash: iOS + Android only, China Android estimated at 1.75× China iOS, excluding PC and console. English values remain in USD.",
    overviewUnit: "USD millions · iOS + Android · estimated China Android · excludes PC / console",
    observed: "Model coverage",
    update: "SOURCE DATA",
    notLive: "No revenue estimate",
    confidence: "Data status",
    sourced: "connected",
    trendTitle: "Single-game revenue trend",
    trendSub: "Select a game card above; the y-axis always starts at zero",
    month: "Monthly",
    year: "Annual",
    version: "By version",
    versionRange: "Phase range",
    rangeStart: "Start phase",
    rangeEnd: "End phase",
    fullRange: "Select launch to now",
    rangeSummary: "{selected} phases selected; {estimable} have monthly revenue coverage",
    noMonthlyCoverage: "no monthly coverage",
    calendarCoverageNote: "The phase catalog now spans launch to present; historical dates and revenue without a reliable source remain explicitly blank.",
    monthCoverageNote: "{available} months from launch to present; the reliable source currently covers {covered}. Missing months remain blank. Scroll horizontally for the full history.",
    yearCoverageNote: "{available} annual nodes from launch to present; years marked partial contain only some sourced months.",
    firstPeriod: "Go to launch",
    latestPeriod: "Go to latest",
    calendarPending: "banner dates pending",
    catalogCount: "{count} phase entries from launch to present",
    versionModelNote: "Phase values allocate published monthly revenue by exact banner-window overlap; phases without monthly coverage are excluded.",
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
	historicalRequired: "Before collection started; licensed hourly history is required",
	pendingCollection: "Banner has not started; hourly updates begin automatically",
	collectionGap: "No usable snapshot in this window",
	observedCoverage: "Automatically observed hourly",
    hours: "hours",
    rankNote: "Peak is the minimum rank and lowest is the worst visible rank. Apple's public feed currently returns the Top 100; exact ranks outside it are never invented.",
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
      ["W", "Uses market-weighted rank^-0.85 when hourly coverage is complete; otherwise uses the phase's exact overlap share of each published month."],
      ["R[g,p]", "Uses exact phase timestamps and allocates each overlapping month separately instead of averaging banner spikes."],
      ["FX", "Chinese display only: USD estimate × the ECB daily USD/CNY reference rate; source values remain stored in USD."],
    ],
    excludes: "Basis: third-party mobile IAP estimates; excludes PC, console, ads, merchandise, and IP licensing.",
    sources: "Source note",
    historicalSource: "GACHAREVENUE history",
    sourceChangelog: "Source changelog",
    sourceNote: "No public source can guarantee competitors' true revenue. This site guarantees traceable provenance and reproducible calculations, not audited publisher results.",
    fxNote: "Chinese display uses the ECB daily USD/CNY reference rate",
    sourceDelay: "source data is not published yet. The source usually updates 2–4 weeks after month-end.",
    footer: "Gacha Revenue Tracker · 二游流水观察",
    footerNote: "Sensor Tower public aggregation · automated Apple rank observations",
  },
} as const;

function formatMoney(value: number | null, locale: Locale, exchangeRate: number) {
  if (value === null) return "—";
  return locale === "zh-CN" ? `¥${((value * exchangeRate) / 100).toFixed(2)}亿` : `$${value.toFixed(1)}M`;
}

function displayValue(value: number, locale: Locale, exchangeRate: number) {
  return locale === "zh-CN" ? (value * exchangeRate) / 100 : value;
}

function formatChartMoney(value: number, locale: Locale) {
  return locale === "zh-CN" ? `¥${value.toFixed(2)}亿` : `$${value.toFixed(2)}M`;
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
  unit,
}: {
  values: Array<number | null>;
  labels: string[];
  color: string;
  locale: Locale;
  xAxisTitle: string;
  unit: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chartWidth = Math.max(900, values.length * (values.length > 36 ? 76 : 105));
  const chartHeight = 330;
  const margin = { top: 42, right: 28, bottom: 58, left: 76 };
  const plotWidth = chartWidth - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const populatedValues = values.filter((value): value is number => value !== null);
  const yMax = niceAxisMax(Math.max(...populatedValues, 0));
  const ticks = Array.from({ length: 5 }, (_, index) => (yMax / 4) * index);
  const points = values.map((value, index) => ({
    x: margin.left + (index / Math.max(values.length - 1, 1)) * plotWidth,
    y: value === null ? null : margin.top + (1 - value / yMax) * plotHeight,
    value,
    label: labels[index],
  }));
  const segments: typeof points[] = [];
  let segment: typeof points = [];
  for (const point of points) {
    if (point.value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else {
      segment.push(point);
    }
  }
  if (segment.length) segments.push(segment);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollLeft = container.scrollWidth;
  }, [labels]);

  const scrollTo = (position: "start" | "end") => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ left: position === "start" ? 0 : container.scrollWidth, behavior: "smooth" });
  };

  return (
    <div className="chart-shell">
      {values.length > 12 && (
        <div className="chart-scroll-actions">
          <button type="button" onClick={() => scrollTo("start")}>← {copy[locale].firstPeriod}</button>
          <span>{labels[0]} — {labels.at(-1)}</span>
          <button type="button" onClick={() => scrollTo("end")}>{copy[locale].latestPeriod} →</button>
        </div>
      )}
      <div ref={scrollRef} className="line-chart" role="img" aria-label={`${copy[locale].trendTitle}，${unit}`}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: chartWidth }}>
        <text className="axis-title axis-title-y" x={margin.left} y="17">{unit}</text>
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
        {segments.filter((items) => items.length > 1).map((items, index) => (
          <polyline
            key={`${items[0].label}-${index}`}
            className="chart-line"
            points={items.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={color}
          />
        ))}
        {points.map((point) => (
          <g key={`${point.label}-${point.value}`}>
            <line className="chart-x-tick" x1={point.x} x2={point.x} y1={margin.top + plotHeight} y2={margin.top + plotHeight + 5} />
            <text className="axis-tick" x={point.x} y={margin.top + plotHeight + 23} textAnchor="middle">{point.label}</text>
            {point.value === null || point.y === null ? (
              <circle className="chart-missing-dot" cx={point.x} cy={margin.top + plotHeight} r="2.5">
                <title>{`${point.label}: ${copy[locale].noMonthlyCoverage}`}</title>
              </circle>
            ) : (
              <g data-testid="trend-point">
                <circle className="chart-dot" cx={point.x} cy={point.y} r="5" fill="#fff" stroke={color}>
                  <title>{`${point.label}: ${formatChartMoney(point.value, locale)}`}</title>
                </circle>
                <text className="chart-value-label" x={point.x} y={Math.max(point.y - 12, 31)} textAnchor="middle">{point.value.toFixed(2)}</text>
              </g>
            )}
          </g>
        ))}
        <text className="axis-title axis-title-x" x={margin.left + plotWidth / 2} y={chartHeight - 5} textAnchor="middle">{xAxisTitle}</text>
        </svg>
      </div>
    </div>
  );
}

const marketNames: Record<"CN" | "JP" | "US" | "KR", Record<Locale, string>> = {
  CN: { "zh-CN": "中国", en: "China" },
  JP: { "zh-CN": "日本", en: "Japan" },
  US: { "zh-CN": "美国", en: "United States" },
  KR: { "zh-CN": "韩国", en: "South Korea" },
};

export default function Dashboard({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [gameData, setGameData] = useState<Game[]>(games);
  const [selectedGame, setSelectedGame] = useState<GameId>(() => highestYTDGameId(games));
  const userSelectedGame = useRef(false);
  const [period, setPeriod] = useState<Period>("month");
  const [versionRange, setVersionRange] = useState<(VersionRange & { gameId: GameId }) | null>(null);
  const [compareIds, setCompareIds] = useState<GameId[]>(["genshin", "hsr", "zzz", "wuwa"]);
  const [versionGame, setVersionGame] = useState<GameId>("hsr");
  const [selectedVersionId, setSelectedVersionId] = useState("hsr-44-p1");
  const [rankingGame, setRankingGame] = useState<GameId>("wuwa");
  const [rankingApp, setRankingApp] = useState<AppLineId>("tencent_video");
  const [versionCatalog, setVersionCatalog] = useState<VersionDetail[]>(versionDetails);
  const [metricsByVersion, setMetricsByVersion] = useState<Record<string, BannerMetricsData>>({});
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateData>(defaultExchangeRate);

  useEffect(() => {
    const controller = new AbortController();
    loadPublicRevenue(controller.signal)
      .then((payload) => {
        if (!payload.data?.length) return;
        const merged = mergeRevenue(games, payload, updateGameRevenue);
        setGameData(merged);
        if (!userSelectedGame.current) setSelectedGame(highestYTDGameId(merged));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to refresh public revenue source", error);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadExchangeRate(controller.signal)
      .then((value) => {
        if (value) setExchangeRate(value);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to refresh ECB exchange rate", error);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadVersions(controller.signal)
      .then((normalized) => {
        if (normalized.length) {
          setVersionCatalog((current) => {
            const byPhase = new Map(normalized.map((item) => [versionPhaseKey(item), item]));
            const merged = current.map((item) => byPhase.get(versionPhaseKey(item)) ?? item);
            const existing = new Set(merged.map(versionPhaseKey));
            return [...merged, ...normalized.filter((item) => !existing.has(versionPhaseKey(item)))];
          });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load authorized version data", error);
      });
    return () => controller.abort();
  }, []);

  const metricTarget = versionCatalog.find(
    (item) => item.id === selectedVersionId && item.gameId === versionGame && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && /^\d{4}-\d{2}-\d{2}$/.test(item.endDate),
  );
  const metricWindow = metricTarget ? `${metricTarget.gameId}|${metricTarget.date}|${metricTarget.endDate}` : "";

  useEffect(() => {
    if (!metricWindow) return;
    const [gameId, date, endDate] = metricWindow.split("|") as [GameId, string, string];
    const controller = new AbortController();
    loadBannerMetrics({ gameId, date, endDate }, controller.signal)
      .then((payload) => {
        const metrics = payload.data;
        if (!metrics) return;
        setMetricsByVersion((current) => ({ ...current, [selectedVersionId]: metrics }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load automatic Apple rank observations", error);
      });
    return () => controller.abort();
  }, [selectedVersionId, metricWindow]);

  const rankingTargets = useMemo(
    () => versionCatalog.filter(
      (version) => version.gameId === rankingGame && /^\d{4}-\d{2}-\d{2}$/.test(version.date) && /^\d{4}-\d{2}-\d{2}$/.test(version.endDate),
    ),
    [rankingGame, versionCatalog],
  );
  useEffect(() => {
    if (!rankingTargets.length) return;
    const controller = new AbortController();
    const refresh = () =>
      loadBannerMetricSet(rankingTargets, controller.signal).then((results) => {
        if (!results.size || controller.signal.aborted) return;
        setMetricsByVersion((current) => {
          const next = { ...current };
          for (const [id, metrics] of results) next[id] = metrics;
          return next;
        });
      });
    void refresh();
    const timer = window.setInterval(refresh, 60 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [rankingTargets]);

  const versionsData = useMemo(
    () => versionCatalog.map((version) => {
      const metrics = metricsByVersion[version.id];
      return metrics ? applyBannerMetrics(version, metrics) : version;
    }),
    [metricsByVersion, versionCatalog],
  );

  const activeGame = gameData.find((game) => game.id === selectedGame) ?? gameData[0];
  const sourcePeriod = latestRevenuePeriod(gameData);
  const sourceYear = sourcePeriod?.year ?? new Date().getUTCFullYear();
  const sourceMonth = sourcePeriod?.month ?? 1;
  const sourceMonthName = locale === "zh-CN"
    ? `${sourceMonth} 月`
    : new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(sourceYear, sourceMonth - 1, 1)));
  const pendingSourceDate = new Date(Date.UTC(sourceYear, sourceMonth, 1));
  const pendingSourceYear = pendingSourceDate.getUTCFullYear();
  const pendingSourceMonth = pendingSourceDate.getUTCMonth() + 1;
  const pendingSourceName = locale === "zh-CN"
    ? `${pendingSourceYear} 年 ${pendingSourceMonth} 月`
    : `${new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(pendingSourceDate)} ${pendingSourceYear}`;
  const sourceDelayMessage = locale === "zh-CN"
    ? `${pendingSourceName}${t.sourceDelay}`
    : `${pendingSourceName} ${t.sourceDelay}`;
  const overviewTitle = locale === "zh-CN"
    ? `${sourceYear} 年累计移动端流水估算（截至 ${sourceMonth} 月）`
    : `${sourceYear} YTD mobile revenue estimates (through ${sourceMonthName})`;
  const currentMonthLabel = locale === "zh-CN" ? `${sourceMonth} 月来源值` : `${sourceMonthName} source value`;
  const monthTotalLabel = locale === "zh-CN" ? `${sourceMonth} 月来源值合计` : `${sourceMonthName} source total`;
  const ytdLabel = locale === "zh-CN" ? `${sourceYear} 年累计` : `${sourceYear} YTD`;
  const visibleVersions = useMemo(
    () => versionsData.filter((item) => item.gameId === versionGame).sort((a, b) => sortVersions(b, a)),
    [versionGame, versionsData],
  );
  const visibleVersionGroups = useMemo(() => {
    const groups = new Map<string, VersionDetail[]>();
    for (const version of visibleVersions) {
      const label = `${version.version.split(".")[0]}.x`;
      groups.set(label, [...(groups.get(label) ?? []), version]);
    }
    return [...groups.entries()];
  }, [visibleVersions]);
  const selectedVersion = visibleVersions.find((version) => version.id === selectedVersionId) ?? visibleVersions[0];
  const comparisonGames = gameData.filter((game) => compareIds.includes(game.id) && game.ytd !== null);
  const compareTotal = comparisonGames.reduce((sum, game) => sum + (game.ytd ?? 0), 0);
  const monthlyTotal = gameData.reduce((sum, game) => sum + (game.currentMonth ?? 0), 0);
  const ytdTotal = gameData.reduce((sum, game) => sum + (game.ytd ?? 0), 0);
  const modelledGameCount = gameData.filter((game) => game.currentMonth !== null).length;
  const coverageLabel = (version: VersionDetail) => {
    switch (version.coverageStatus) {
      case "historical_provider_required": return t.historicalRequired;
      case "pending_collection": return t.pendingCollection;
      case "collection_gap": return t.collectionGap;
      case "observed": return t.observedCoverage;
      default: return t.awaitingFeed;
    }
  };
  const versionSourceLabel = (version: VersionDetail) => {
    if (version.dataStatus === "licensed_feed") return t.licensedSource;
    if (version.dataStatus === "apple_public_feed") return t.appleSource;
    if (version.dataStatus === "verified_manual") return t.correctionSource;
    return coverageLabel(version);
  };

  const versionRangeOptions = useMemo(
    () => buildVersionRangeOptions(activeGame, versionsData, locale),
    [activeGame, locale, versionsData],
  );
  const defaultRange = useMemo(() => defaultVersionRange(versionRangeOptions), [versionRangeOptions]);
  const effectiveVersionRange = versionRange?.gameId === activeGame.id &&
    versionRangeOptions.some((option) => option.id === versionRange.startId) &&
    versionRangeOptions.some((option) => option.id === versionRange.endId)
    ? versionRange
    : defaultRange;
  const versionSeries = useMemo(
    () => buildVersionRevenueSeries(activeGame, versionsData, effectiveVersionRange, locale),
    [activeGame, effectiveVersionRange, locale, versionsData],
  );
  const monthlySeries = useMemo(
    () => buildMonthlyRevenueSeries(activeGame, { year: sourceYear, month: sourceMonth }),
    [activeGame, sourceMonth, sourceYear],
  );
  const yearlySeries = useMemo(
    () => buildYearlyRevenueSeries(activeGame, { year: sourceYear, month: sourceMonth }, locale),
    [activeGame, locale, sourceMonth, sourceYear],
  );

  const trend = useMemo(() => {
    if (period === "year") {
      return { values: yearlySeries.values, labels: yearlySeries.labels, xAxis: t.yearAxis };
    }
    if (period === "version") {
      return {
        values: versionSeries.values,
        labels: versionSeries.labels,
        xAxis: t.versionAxis,
      };
    }
    return { values: monthlySeries.values, labels: monthlySeries.labels, xAxis: t.monthAxis };
  }, [monthlySeries.labels, monthlySeries.values, period, t.monthAxis, t.versionAxis, t.yearAxis, versionSeries.labels, versionSeries.values, yearlySeries.labels, yearlySeries.values]);

  const stats = useMemo(() => {
    const populated = trend.values.filter((value): value is number => value !== null && value > 0);
    if (!populated.length) return { peak: null, average: null, latest: null };
    return {
      peak: Math.max(...populated),
      average: populated.reduce((sum, value) => sum + value, 0) / populated.length,
      latest: populated[populated.length - 1],
    };
  }, [trend]);
  const chartValues = useMemo(
    () => trend.values.map((value) => value === null ? null : displayValue(value, locale, exchangeRate.rate)),
    [exchangeRate.rate, locale, trend.values],
  );

  const setRangeBoundary = (boundary: "startId" | "endId", id: string) => {
    if (!versionRangeOptions.length) return;
    const current = effectiveVersionRange ?? defaultVersionRange(versionRangeOptions, versionRangeOptions.length);
    if (!current) return;
    const next = { ...current, [boundary]: id };
    const startIndex = versionRangeOptions.findIndex((option) => option.id === next.startId);
    const endIndex = versionRangeOptions.findIndex((option) => option.id === next.endId);
    if (startIndex > endIndex) {
      if (boundary === "startId") next.endId = id;
      else next.startId = id;
    }
    setVersionRange({ gameId: activeGame.id, ...next });
  };

  const showFullVersionRange = () => {
    if (!versionRangeOptions.length) return;
    setVersionRange({
      gameId: activeGame.id,
      startId: versionRangeOptions[0].id,
      endId: versionRangeOptions[versionRangeOptions.length - 1].id,
    });
  };

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
    const first = versionsData.filter((item) => item.gameId === gameId).sort((a, b) => sortVersions(b, a))[0];
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
          <h1>{overviewTitle}</h1>
          <p>{t.overviewUnit}</p>
          <p className="overview-source-note">{sourceDelayMessage} {locale === "zh-CN" && `${t.fxNote}：${exchangeRate.rate.toFixed(4)}（${exchangeRate.date}${exchangeRate.fallback ? "，缓存值" : ""}）。`}</p>
        </div>
        <div className="overview-kpis">
          <div><span>{ytdLabel} {locale === "zh-CN" ? "合计" : "total"}</span><strong>{formatMoney(ytdTotal, locale, exchangeRate.rate)}</strong></div>
          <div><span>{monthTotalLabel}</span><strong>{formatMoney(monthlyTotal, locale, exchangeRate.rate)}</strong></div>
          <div><span>{t.observed}</span><strong>{modelledGameCount} / {gameData.length}</strong></div>
        </div>
      </section>

      <section className="game-grid" aria-label={ytdLabel}>
        {gameData.map((game) => {
          const active = game.id === selectedGame;
          return (
            <button
              key={game.id}
              className={`game-card ${active ? "active" : ""}`}
              onClick={() => {
                userSelectedGame.current = true;
                setSelectedGame(game.id);
              }}
              aria-pressed={active}
              style={{ "--game-color": game.color, "--game-pale": game.pale } as React.CSSProperties}
            >
              <div className="game-card-top">
                <GameMark game={game} />
                <span className={`confidence confidence-${game.confidence.replace("+", "plus")}`}>{t.confidence} {game.confidence === "SOURCE" ? t.sourced : game.confidence}</span>
              </div>
              <div className="game-name"><strong>{game.name[locale]}</strong><span>{game.publisher}</span></div>
              {game.ytd === null ? (
                <div className="not-live"><b>—</b><span>{t.notLive}</span></div>
              ) : (
                <>
                  <div className="card-money">
                    <strong>{formatMoney(game.ytd, locale, exchangeRate.rate)}</strong>
                    <span>{ytdLabel}</span>
                  </div>
                  <div className="card-foot">
                    <span>{currentMonthLabel} <b>{formatMoney(game.currentMonth, locale, exchangeRate.rate)}</b></span>
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
        {period === "version" && (
          <div className="trend-filter-bar">
            <div className="version-range-control" role="group" aria-label={t.versionRange}>
              <div className="filter-bar-heading">
                <strong>{t.versionRange}</strong>
                <small>{t.rangeSummary.replace("{selected}", String(versionSeries.selected)).replace("{estimable}", String(versionSeries.estimable))}</small>
              </div>
              <div className="version-range-fields">
                <label>
                  <span>{t.rangeStart}</span>
                  <select
                    aria-label={t.rangeStart}
                    value={effectiveVersionRange?.startId ?? ""}
                    onChange={(event) => setRangeBoundary("startId", event.target.value)}
                  >
                    {versionRangeOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}{option.estimable ? "" : ` · ${t.noMonthlyCoverage}`}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t.rangeEnd}</span>
                  <select
                    aria-label={t.rangeEnd}
                    value={effectiveVersionRange?.endId ?? ""}
                    onChange={(event) => setRangeBoundary("endId", event.target.value)}
                  >
                    {versionRangeOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}{option.estimable ? "" : ` · ${t.noMonthlyCoverage}`}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={showFullVersionRange} disabled={!versionRangeOptions.length}>{t.fullRange}</button>
              </div>
            </div>
          </div>
        )}
        <div className="trend-layout">
          <div className="trend-main">
            <div className="chart-title-row"><div><GameMark game={activeGame} small /><strong>{activeGame.name[locale]}</strong></div><span>{t.unit}</span></div>
            <p className="version-model-note">
              {period === "version"
                ? `${t.versionModelNote} ${t.calendarCoverageNote}`
                : period === "month"
                  ? t.monthCoverageNote.replace("{available}", String(monthlySeries.available)).replace("{covered}", String(monthlySeries.covered))
                  : t.yearCoverageNote.replace("{available}", String(yearlySeries.available))}
            </p>
            {trend.values.length && trend.values.some((value) => value !== null && value > 0) ? (
              <LineChart values={chartValues} labels={trend.labels} color={activeGame.color} locale={locale} xAxisTitle={trend.xAxis} unit={t.unit} />
            ) : <div className="empty-chart">{t.notLive}</div>}
          </div>
          <aside className="trend-stats">
            <div><span>{t.peak}</span><strong>{formatMoney(stats.peak, locale, exchangeRate.rate)}</strong></div>
            <div><span>{t.average}</span><strong>{formatMoney(stats.average, locale, exchangeRate.rate)}</strong></div>
            <div><span>{t.latest}</span><strong>{formatMoney(stats.latest, locale, exchangeRate.rate)}</strong></div>
            <p><i style={{ background: activeGame.color }} />{activeGame.name[locale]} · {period === "version" ? t.versionAxis : `${activeGame.launchDate.slice(0, 7)}—${sourceYear}-${String(sourceMonth).padStart(2, "0")}`}</p>
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
              <div className="compare-value"><strong>{formatMoney(game.ytd, locale, exchangeRate.rate)}</strong><small>{t.ytdEstimate}</small></div>
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
            <span>{t.selectBanner}<small>{t.catalogCount.replace("{count}", String(visibleVersions.length))}</small></span>
            <select value={selectedVersion?.id ?? ""} disabled={!visibleVersions.length} onChange={(event) => setSelectedVersionId(event.target.value)} aria-label={t.selectBanner}>
              {!visibleVersions.length && <option value="">{t.noVerifiedBanner}</option>}
              {visibleVersionGroups.map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.version} · {item.phase[locale]} · UP {item.characters[locale]}
                    </option>
                  ))}
                </optgroup>
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
              <div><span>{t.dateWindow}</span><strong>{selectedVersion.date ? <>{selectedVersion.date}<i>→</i>{selectedVersion.endDate}</> : t.calendarPending}</strong><small>{selectedVersion.windowHours ? `${selectedVersion.observedHours} / ${selectedVersion.windowHours} ${t.hours} · ` : ""}{coverageLabel(selectedVersion)}</small></div>
              <div><span>{t.estimateBasis}</span><strong>{selectedVersion.scope[locale]}</strong><small>{selectedVersion.sourceUrl ? <a href={selectedVersion.sourceUrl} target="_blank" rel="noreferrer">{t.calendarSource} ↗</a> : t.calendarPending}{selectedVersion.sourceUpdatedAt && ` · ${selectedVersion.sourceUpdatedAt}`}</small></div>
              <div className="version-money"><span>{t.versionEstimate}</span><strong>{formatMoney(selectedVersion.revenue, locale, exchangeRate.rate)}</strong><small>{versionSourceLabel(selectedVersion)}{selectedVersion.windowHours ? ` · ${selectedVersion.observedHours}/${selectedVersion.windowHours}h` : ""}</small></div>
            </div>

            <div className="intelligence-grid">
              <section className="rank-section">
                <h3>{t.rankTitle}</h3>
                <div className="table-scroll">
                  <table className="rank-table">
                    <thead><tr><th>{t.region}</th><th>{t.peakRank}</th><th>{t.lowRank}</th><th>{t.rankMeaning}</th></tr></thead>
                    <tbody>
                      {(Object.entries(selectedVersion.ranks) as Array<["CN" | "JP" | "US" | "KR", [number | null, number | null]]>).map(([country, rank]) => (
                        <tr key={country}><td><b>{country}</b>{marketNames[country][locale]}</td><td><strong>{rank[0] === null ? "—" : `#${rank[0]}`}</strong><small>{rank[0] === null ? coverageLabel(selectedVersion) : t.peakMeaning}</small></td><td><strong>{rank[1] === null ? "—" : `#${rank[1]}`}</strong><small>{rank[1] === null ? coverageLabel(selectedVersion) : t.lowMeaning}</small></td><td>{selectedVersion.date || t.calendarPending}<br />{selectedVersion.endDate}</td></tr>
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
                            <td><span className={`line-result ${known && (item.hours ?? 0) > 0 ? "yes" : "no"}`}>{!known ? coverageLabel(selectedVersion) : (item.hours ?? 0) > 0 ? t.exceeded : t.noHours}</span></td>
                            <td><div className="hours-cell"><i><b style={{ width: known ? `${((item.hours ?? 0) / maxAppHours) * 100}%` : "0%" }} /></i><strong>{known ? `${item.hours} ${t.hours}` : "—"}</strong></div></td>
                            <td><span className="source-cell">{item.source === "licensed_feed" ? t.licensedSource : item.source === "apple_public_feed" ? t.appleSource : item.source === "verified_manual" ? t.correctionSource : coverageLabel(selectedVersion)}{item.updatedAt && <small>{item.updatedAt}</small>}</span></td>
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
          <div className="source-links"><strong>{t.sources}</strong><a href={revenueSource.url} target="_blank" rel="noreferrer">GachaDash ↗</a><a href={historicalRevenueSource.url} target="_blank" rel="noreferrer">{t.historicalSource} ↗</a><a href={historicalRevenueSource.changelogUrl} target="_blank" rel="noreferrer">{t.sourceChangelog} ↗</a><a href="https://sensortower.com/product/mobile-app/app-performance-insights" target="_blank" rel="noreferrer">Sensor Tower ↗</a><a href="https://itunes.apple.com/cn/rss/topgrossingapplications/limit=100/json" target="_blank" rel="noreferrer">Apple Top Grossing RSS ↗</a><a href={exchangeRate.source_url} target="_blank" rel="noreferrer">ECB / Frankfurter FX ↗</a></div>
          <p className="source-note">{t.sourceNote}</p>
        </div>
      </section>

      <footer><strong>{t.footer}</strong><span>{t.footerNote}</span><a href="#overview">↑ TOP</a></footer>
    </main>
  );
}
