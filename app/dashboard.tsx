"use client";

import { useEffect, useMemo, useState } from "react";
import {
  appLines,
  games,
  monthLabels,
  versionDetails,
  yearLabels,
  type Game,
  type GameId,
  type Locale,
  type AppLineId,
  type DataStatus,
  type VersionDetail,
} from "./data";

type Period = "month" | "year" | "version";

const copy = {
  "zh-CN": {
    nav: ["总览", "趋势", "对比", "版本与角色", "估算公式"],
    navIds: ["overview", "trend", "compare", "versions", "methodology"],
    brand: "二游流水观察",
    brandSub: "GACHA REVENUE ESTIMATES",
    dataBadge: "仅显示已核验数据",
    disclaimer: "错误演示数字已全部移除。未接入授权 Sensor Tower、AppMagic 与逐小时排名 feed 的字段统一显示“待接入”，不会用比例或插值补数。",
    overviewTitle: "授权数据接入状态",
    overviewUnit: "只展示具有来源、观察窗口和更新时间的数值",
    monthTotal: "已核验流水",
    ytdTotal: "已核验卡池观测",
    observed: "自动更新",
    update: "准确性优先",
    currentMonth: "最新流水估算",
    ytd: "年度估算",
    notLive: "等待授权数据源",
    confidence: "置信度",
    trendTitle: "单游戏流水趋势",
    trendSub: "点击上方游戏卡片切换游戏；纵轴统一从 0 开始",
    month: "按月",
    year: "按年",
    version: "按版本",
    unit: "估算流水（亿元人民币）",
    monthAxis: "月份",
    yearAxis: "年份",
    versionAxis: "版本",
    peak: "期间最高",
    average: "期间均值",
    latest: "最新一期",
    compareTitle: "游戏间流水比较",
    compareSub: "接入授权流水源后自动生成同口径比较",
    ytdEstimate: "YTD 估算",
    share: "入选游戏占比",
    selected: "已选择",
    versionTitle: "版本 / 卡池角色观测",
    versionSub: "通过下拉栏选择具体版本与卡池角色；只展示有来源的观测",
    selectGame: "选择游戏",
    selectBanner: "选择版本 / 卡池角色",
    noVerifiedBanner: "该游戏暂无已核验卡池数据",
    dateWindow: "观察窗口",
    associatedCharacters: "关联角色 / 卡池",
    estimateBasis: "归属口径",
    versionEstimate: "窗口流水估算",
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
    awaitingFeed: "待接入",
    hours: "小时",
    rankNote: "峰值 = 观察窗口内最小名次；最低 = 最大名次。名次数字越小越靠前。",
    appLineNote: "每个小时比较一次中国区畅销总榜；当游戏名次小于应用名次时，累计 1 小时。",
    characterNote: "每条记录按具体卡池开放窗口统计，不再把同一版本的多个角色混在一起。0 小时表示有完整观测且确实未超过；“待接入”表示没有可靠数据，二者严格区分。",
    correctionSource: "人工校正（待授权 feed 回填）",
    licensedSource: "授权排名 feed",
    source: "数据来源",
    updatedAt: "校正日期",
    rankingTitle: "单游戏卡池超应用时间排名",
    rankingSub: "选择游戏与应用线，按该游戏所有已核验卡池的累计超越时长排序",
    rankingGame: "排名游戏",
    rankingApp: "比较应用线",
    rankingPosition: "排名",
    versionAndBanner: "版本 / 卡池角色",
    noRankingData: "该游戏在此应用线下暂无已核验观测；不会用未知值参与排名。",
    methodologyTitle: "流水估算公式",
    storeFormulaTitle: "商店端基线",
    totalFormulaTitle: "全平台估算",
    versionFormulaTitle: "版本归属",
    hoursFormulaTitle: "应用线时长",
    storeFormula: "S[g,t] = Σ FX[c,t] × median(ST[g,c,p,t], AM[g,c,p,t])",
    totalFormula: "R[g,t] = (S[g,t] + α[g,t] × iOS_CN[g,t]) × (1 + β[g,t])",
    versionFormula: "R[g,v] = Σ R[g,d] × overlap_hours(d,v) / 24",
    hoursFormula: "H[g,v,a] = Σ 1(rank_g,τ < rank_a,τ) × Δτ",
    definitions: [
      ["S", "中国 iOS、海外 iOS / Google Play 的商店端 IAP 毛收入中位估算，按日汇率换算人民币。"],
      ["α", "中国 Android / 中国 iOS 流水倍率，按游戏与月份校准。"],
      ["β", "PC、主机、官网直充相对移动端流水的补全比例。"],
      ["R[g,v]", "版本窗口按每日重叠小时归属；跨月不重复计算。"],
    ],
    excludes: "口径：消费者毛支出、平台抽成前；不含广告、电商周边与 IP 授权。",
    sources: "数据源说明",
    sourceNote: "ST / AppMagic 是第三方估算，只适合同口径趋势和比较，不等同于发行商审计收入。",
    footer: "二游流水观察",
    footerNote: "仅显示已核验数据",
  },
  en: {
    nav: ["Overview", "Trend", "Compare", "Versions & banners", "Formula"],
    navIds: ["overview", "trend", "compare", "versions", "methodology"],
    brand: "GACHA REVENUE TRACKER",
    brandSub: "二游流水观察",
    dataBadge: "VERIFIED DATA ONLY",
    disclaimer: "All synthetic demo values have been removed. Fields without licensed Sensor Tower, AppMagic, or hourly rank-feed inputs are marked as awaiting data and are never interpolated.",
    overviewTitle: "Authorized data connection status",
    overviewUnit: "Values appear only with source, observation window, and update time",
    monthTotal: "Verified revenue",
    ytdTotal: "Verified banner observations",
    observed: "Auto refresh",
    update: "Accuracy first",
    currentMonth: "Latest revenue estimate",
    ytd: "Annual estimate",
    notLive: "Awaiting authorized data",
    confidence: "Confidence",
    trendTitle: "Single-game revenue trend",
    trendSub: "Select a game card above; the y-axis always starts at zero",
    month: "Monthly",
    year: "Annual",
    version: "By version",
    unit: "Estimated revenue (CNY 100M)",
    monthAxis: "Month",
    yearAxis: "Year",
    versionAxis: "Version",
    peak: "Period high",
    average: "Period average",
    latest: "Latest",
    compareTitle: "Cross-game comparison",
    compareSub: "Like-for-like comparisons appear after licensed revenue sources are connected",
    ytdEstimate: "YTD estimate",
    share: "Selected share",
    selected: "selected",
    versionTitle: "Version / character-banner observations",
    versionSub: "Use the dropdowns to select a specific version and banner character; only sourced observations are shown",
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
    awaitingFeed: "Awaiting feed",
    hours: "hours",
    rankNote: "Peak is the minimum rank and lowest is the maximum rank in the observation window. Smaller rank numbers are better.",
    appLineNote: "China overall-grossing ranks are compared hourly; one hour is added whenever the game rank is smaller than the app rank.",
    characterNote: "Each row uses the exact character-banner window instead of combining multiple characters in one version. Zero means complete observation and genuinely never above; awaiting feed means unknown.",
    correctionSource: "Manual correction (pending licensed-feed backfill)",
    licensedSource: "Licensed rank feed",
    source: "Data source",
    updatedAt: "Correction date",
    rankingTitle: "Per-game banner app-line ranking",
    rankingSub: "Select a game and app line to rank all verified character banners by cumulative hours above it",
    rankingGame: "Ranking game",
    rankingApp: "Comparison app line",
    rankingPosition: "Rank",
    versionAndBanner: "Version / character banner",
    noRankingData: "No verified observation for this game and app line; unknown values are excluded from ranking.",
    methodologyTitle: "Revenue estimation formulas",
    storeFormulaTitle: "Store baseline",
    totalFormulaTitle: "All-platform estimate",
    versionFormulaTitle: "Version attribution",
    hoursFormulaTitle: "App-line hours",
    storeFormula: "S[g,t] = Σ FX[c,t] × median(ST[g,c,p,t], AM[g,c,p,t])",
    totalFormula: "R[g,t] = (S[g,t] + α[g,t] × iOS_CN[g,t]) × (1 + β[g,t])",
    versionFormula: "R[g,v] = Σ R[g,d] × overlap_hours(d,v) / 24",
    hoursFormula: "H[g,v,a] = Σ 1(rank_g,τ < rank_a,τ) × Δτ",
    definitions: [
      ["S", "Median estimated gross IAP for China iOS and overseas iOS / Google Play, converted to CNY with daily FX."],
      ["α", "China Android / China iOS multiplier calibrated by title and month."],
      ["β", "PC, console, and direct top-up completion ratio relative to mobile."],
      ["R[g,v]", "Daily revenue attributed by overlapping hours; cross-month versions are not double counted."],
    ],
    excludes: "Basis: consumer gross spend before platform fees; excludes ads, merchandise, and IP licensing.",
    sources: "Source note",
    sourceNote: "ST / AppMagic are third-party estimates for like-for-like trends and comparisons, not audited publisher revenue.",
    footer: "Gacha Revenue Tracker · 二游流水观察",
    footerNote: "Verified observations only",
  },
} as const;

function formatMoney(value: number | null, locale: Locale) {
  if (value === null) return "—";
  if (locale === "zh-CN") return `¥${value.toFixed(2)} 亿`;
  const millions = value * 100;
  return millions >= 1000 ? `CN¥${(millions / 1000).toFixed(2)}B` : `CN¥${millions.toFixed(0)}M`;
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
              <title>{`${point.label}: ${point.value.toFixed(2)} ${locale === "zh-CN" ? "亿元" : "CNY 100M"}`}</title>
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

function normalizeVersions(payload: VersionsResponse): VersionDetail[] {
  return (payload.data ?? []).map((item) => {
    const startsAt = new Date(item.starts_at);
    const endsAt = new Date(item.ends_at);
    return {
      id: item.id,
      gameId: item.game_id,
      version: item.version,
      phase: { "zh-CN": item.phase_zh, en: item.phase_en },
      date: item.starts_at.slice(0, 10),
      endDate: item.ends_at.slice(0, 10),
      characters: { "zh-CN": item.characters_zh, en: item.characters_en },
      scope: { "zh-CN": "角色卡池窗口", en: "Character banner window" },
      revenue: item.estimate,
      revenueRange: [item.p25, item.p75],
      confidence: item.confidence,
      observedHours: Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 3_600_000)),
      dataStatus: item.data_status,
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
  const [selectedGame, setSelectedGame] = useState<GameId>("wuwa");
  const [period, setPeriod] = useState<Period>("month");
  const [compareIds, setCompareIds] = useState<GameId[]>(["genshin", "hsr", "zzz", "wuwa"]);
  const [versionGame, setVersionGame] = useState<GameId>("wuwa");
  const [selectedVersionId, setSelectedVersionId] = useState("ww-24-cartethyia");
  const [rankingGame, setRankingGame] = useState<GameId>("wuwa");
  const [rankingApp, setRankingApp] = useState<AppLineId>("tencent_video");
  const [versionsData, setVersionsData] = useState<VersionDetail[]>(versionDetails);

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

  const activeGame = games.find((game) => game.id === selectedGame) ?? games[0];
  const selectedVersion = versionsData.find((version) => version.id === selectedVersionId);
  const visibleVersions = versionsData.filter((item) => item.gameId === versionGame);
  const comparisonGames = games.filter((game) => compareIds.includes(game.id) && game.ytd !== null);
  const compareTotal = comparisonGames.reduce((sum, game) => sum + (game.ytd ?? 0), 0);
  const verifiedBannerCount = versionsData.filter((version) => version.appHours.some((item) => item.hours !== null)).length;

  const trend = useMemo(() => {
    if (period === "year") return { values: activeGame.yearly, labels: yearLabels, xAxis: t.yearAxis };
    if (period === "version") {
      return {
        values: activeGame.versions.map((item) => item.value),
        labels: activeGame.versions.map((item) => item.label),
        xAxis: t.versionAxis,
      };
    }
    return { values: activeGame.monthly, labels: monthLabels[locale], xAxis: t.monthAxis };
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
    const first = versionsData.find((item) => item.gameId === gameId);
    setSelectedVersionId(first?.id ?? "");
  };

  return (
    <main>
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
          <div><span>{t.monthTotal}</span><strong>—</strong></div>
          <div><span>{t.ytdTotal}</span><strong>{verifiedBannerCount}</strong></div>
          <div><span>{t.observed}</span><strong>{t.awaitingFeed}</strong></div>
        </div>
      </section>

      <section className="game-grid" aria-label={t.currentMonth}>
        {games.map((game) => {
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
                <span className={`confidence confidence-${game.confidence.replace("+", "plus")}`}>{t.confidence} {game.confidence}</span>
              </div>
              <div className="game-name"><strong>{game.name[locale]}</strong><span>{game.publisher}</span></div>
              {game.currentMonth === null ? (
                <div className="not-live"><b>—</b><span>{t.notLive}</span></div>
              ) : (
                <>
                  <div className="card-money"><strong>{formatMoney(game.currentMonth, locale)}</strong><span>{t.currentMonth}</span></div>
                  <div className="card-foot">
                    <span>{t.ytd} <b>{formatMoney(game.ytd, locale)}</b></span>
                    <span className={game.change && game.change > 0 ? "positive" : "negative"}>{game.change && game.change > 0 ? "+" : ""}{game.change}%</span>
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
          {games.map((game) => (
            <button key={game.id} className={compareIds.includes(game.id) ? "active" : ""} onClick={() => toggleCompare(game.id)} aria-pressed={compareIds.includes(game.id)} style={{ "--game-color": game.color } as React.CSSProperties}>
              <span style={{ background: game.color }} />{game.name[locale]}
            </button>
          ))}
        </div>
        <div className="compare-bars">
          {comparisonGames.sort((a, b) => (b.ytd ?? 0) - (a.ytd ?? 0)).map((game, index) => (
            <div className="compare-row" key={game.id}>
              <span className="compare-rank">0{index + 1}</span>
              <div className="compare-game"><GameMark game={game} small /><strong>{game.name[locale]}</strong></div>
              <div className="compare-bar-track"><span style={{ width: `${((game.ytd ?? 0) / 24) * 100}%`, background: game.color }} /></div>
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
              {games.map((game) => <option key={game.id} value={game.id}>{game.name[locale]}</option>)}
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
                <small>{games.find((game) => game.id === selectedVersion.gameId)?.name[locale]} · {selectedVersion.version} · {selectedVersion.phase[locale]}</small>
              </div>
              <div><span>{t.dateWindow}</span><strong>{selectedVersion.date}<i>→</i>{selectedVersion.endDate}</strong><small>{selectedVersion.observedHours} {t.hours}</small></div>
              <div><span>{t.estimateBasis}</span><strong>{selectedVersion.scope[locale]}</strong><small>{t.confidence} {selectedVersion.confidence}</small></div>
              <div className="version-money"><span>{t.versionEstimate}</span><strong>{formatMoney(selectedVersion.revenue, locale)}</strong><small>{t.awaitingFeed} Sensor Tower / AppMagic</small></div>
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
                            <td><span className="source-cell">{item.source === "licensed_feed" ? t.licensedSource : item.source === "verified_manual" ? t.correctionSource : t.awaitingFeed}{item.updatedAt && <small>{item.updatedAt}</small>}</span></td>
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
              <label><span>{t.rankingGame}</span><select value={rankingGame} onChange={(event) => setRankingGame(event.target.value as GameId)} aria-label={t.rankingGame}>{games.map((game) => <option key={game.id} value={game.id}>{game.name[locale]}</option>)}</select></label>
              <label><span>{t.rankingApp}</span><select value={rankingApp} onChange={(event) => setRankingApp(event.target.value as AppLineId)} aria-label={t.rankingApp}>{appLines.map((app) => <option key={app.id} value={app.id}>{app.name[locale]}</option>)}</select></label>
            </div>
          </div>
          {bannerRanking.length ? (
            <div className="table-scroll">
              <table className="banner-ranking-table">
                <thead><tr><th>{t.rankingPosition}</th><th>{t.versionAndBanner}</th><th>{t.dateWindow}</th><th>{t.hoursAbove}</th><th>{t.source}</th></tr></thead>
                <tbody>{bannerRanking.map(({ version, observation }, index) => (
                  <tr key={version.id}><td><strong>{`#${index + 1}`}</strong></td><td><b>{`${version.version} · UP ${version.characters[locale]}`}</b><small>{version.phase[locale]}</small></td><td>{version.date}<i>→</i>{version.endDate}</td><td><strong>{`${observation.hours} ${t.hours}`}</strong></td><td><span className="source-cell">{observation.source === "licensed_feed" ? t.licensedSource : t.correctionSource}{observation.updatedAt && <small>{observation.updatedAt}</small>}</span></td></tr>
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
          <div className="source-links"><strong>{t.sources}</strong><a href="https://sensortower.com/product/mobile-app/app-performance-insights" target="_blank" rel="noreferrer">Sensor Tower ↗</a><a href="https://appmagic.rocks/files/view/upload/Reports/EN_MobileMarkeLandscape2026.pdf" target="_blank" rel="noreferrer">AppMagic ↗</a></div>
          <p className="source-note">{t.sourceNote}</p>
        </div>
      </section>

      <footer><strong>{t.footer}</strong><span>{t.footerNote}</span><a href="#overview">↑ TOP</a></footer>
    </main>
  );
}
