"use client";

import { useMemo, useState } from "react";
import {
  games,
  monthLabels,
  versionDetails,
  yearLabels,
  type Game,
  type GameId,
  type Locale,
} from "./data";

type Period = "month" | "year" | "version";

const copy = {
  "zh-CN": {
    nav: ["总览", "趋势", "对比", "版本与角色", "估算公式"],
    navIds: ["overview", "trend", "compare", "versions", "methodology"],
    brand: "二游流水观察",
    brandSub: "GACHA REVENUE ESTIMATES",
    dataBadge: "演示估算 · 2026.07",
    disclaimer: "演示数据，不是发行商财报。生产数据需接入授权 Sensor Tower、AppMagic、iOS 排名与汇率源后重算。",
    overviewTitle: "2026 年 7 月流水估算",
    overviewUnit: "人民币亿元 · 全平台毛流水 · 平台抽成前",
    monthTotal: "本月合计",
    ytdTotal: "2026 年累计",
    observed: "商业化游戏",
    update: "更新至 2026-07-31",
    currentMonth: "7 月估算流水",
    ytd: "2026 YTD",
    notLive: "暂无商业化观测",
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
    compareSub: "选择 2–6 款游戏，比较 2026 年累计估算",
    ytdEstimate: "YTD 估算",
    share: "入选游戏占比",
    selected: "已选择",
    versionTitle: "版本 / 角色对应流水与榜单",
    versionSub: "先选择游戏和版本，再查看关联角色、流水区间、四国 iOS 名次与七条中国区应用线",
    allGames: "全部游戏",
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
    hours: "小时",
    rankNote: "峰值 = 观察窗口内最小名次；最低 = 最大名次。名次数字越小越靠前。",
    appLineNote: "每个小时比较一次中国区畅销总榜；当游戏名次小于应用名次时，累计 1 小时。",
    characterNote: "关联角色表示该版本或卡池窗口内的角色。多个卡池重叠时，仅凭畅销榜不能可靠拆分单个角色流水，因此展示窗口合计。",
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
    footerNote: "演示数据 · 仅供产品验收",
  },
  en: {
    nav: ["Overview", "Trend", "Compare", "Versions & banners", "Formula"],
    navIds: ["overview", "trend", "compare", "versions", "methodology"],
    brand: "GACHA REVENUE TRACKER",
    brandSub: "二游流水观察",
    dataBadge: "DEMO ESTIMATE · 2026.07",
    disclaimer: "Demo data, not publisher-reported revenue. Production requires licensed Sensor Tower, AppMagic, iOS rank, and FX inputs.",
    overviewTitle: "July 2026 revenue estimates",
    overviewUnit: "CNY · all-platform gross bookings · before platform fees",
    monthTotal: "Monthly total",
    ytdTotal: "2026 YTD",
    observed: "Commercial titles",
    update: "Through Jul 31, 2026",
    currentMonth: "July estimate",
    ytd: "2026 YTD",
    notLive: "No commercial observation",
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
    compareSub: "Select 2–6 titles to compare 2026 YTD estimates",
    ytdEstimate: "YTD estimate",
    share: "Selected share",
    selected: "selected",
    versionTitle: "Version / banner revenue and ranks",
    versionSub: "Choose a game and version to inspect associated characters, estimate range, country ranks, and seven China app lines",
    allGames: "All games",
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
    hours: "hours",
    rankNote: "Peak is the minimum rank and lowest is the maximum rank in the observation window. Smaller rank numbers are better.",
    appLineNote: "China overall-grossing ranks are compared hourly; one hour is added whenever the game rank is smaller than the app rank.",
    characterNote: "Characters identify the version or banner window. Overlapping banners cannot be reliably split into single-character revenue from rank data alone, so the window total is shown.",
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
    footerNote: "Demo data · product review only",
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

export default function Dashboard({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [selectedGame, setSelectedGame] = useState<GameId>("hsr");
  const [period, setPeriod] = useState<Period>("month");
  const [compareIds, setCompareIds] = useState<GameId[]>(["genshin", "hsr", "zzz", "wuwa"]);
  const [versionGame, setVersionGame] = useState<GameId | "all">("hsr");
  const [selectedVersionId, setSelectedVersionId] = useState("hsr-32");

  const activeGame = games.find((game) => game.id === selectedGame) ?? games[0];
  const selectedVersion = versionDetails.find((version) => version.id === selectedVersionId) ?? versionDetails[0];
  const visibleVersions = versionDetails.filter((item) => versionGame === "all" || item.gameId === versionGame);
  const comparisonGames = games.filter((game) => compareIds.includes(game.id) && game.ytd !== null);
  const compareTotal = comparisonGames.reduce((sum, game) => sum + (game.ytd ?? 0), 0);
  const monthlyTotal = games.reduce((sum, game) => sum + (game.currentMonth ?? 0), 0);

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
    if (!populated.length) return { peak: 0, average: 0, latest: 0 };
    return {
      peak: Math.max(...populated),
      average: populated.reduce((sum, value) => sum + value, 0) / populated.length,
      latest: populated[populated.length - 1],
    };
  }, [trend]);

  const maxAppHours = Math.max(...selectedVersion.appHours.map((item) => item.hours), 1);

  const toggleCompare = (id: GameId) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.length <= 2 ? current : current.filter((gameId) => gameId !== id);
      return [...current, id];
    });
  };

  const changeVersionGame = (gameId: GameId | "all") => {
    setVersionGame(gameId);
    const first = versionDetails.find((item) => gameId === "all" || item.gameId === gameId);
    if (first) setSelectedVersionId(first.id);
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
          <div><span>{t.monthTotal}</span><strong>{formatMoney(monthlyTotal, locale)}</strong></div>
          <div><span>{t.ytdTotal}</span><strong>{formatMoney(72, locale)}</strong></div>
          <div><span>{t.observed}</span><strong>5 / 6</strong></div>
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
          <select value={versionGame} onChange={(event) => changeVersionGame(event.target.value as GameId | "all")} aria-label={t.allGames}>
            <option value="all">{t.allGames}</option>
            {games.map((game) => <option key={game.id} value={game.id}>{game.name[locale]}</option>)}
          </select>
        </div>

        <div className="version-picker" role="listbox" aria-label={t.versionTitle}>
          {visibleVersions.map((item) => {
            const game = games.find((entry) => entry.id === item.gameId)!;
            return (
              <button key={item.id} role="option" aria-selected={item.id === selectedVersion.id} className={item.id === selectedVersion.id ? "active" : ""} onClick={() => setSelectedVersionId(item.id)} style={{ "--game-color": game.color } as React.CSSProperties}>
                <span><GameMark game={game} small /><b>{game.name[locale]} {item.version}</b></span>
                <strong>{item.characters[locale]}</strong>
                <small>{formatMoney(item.revenue, locale)}</small>
              </button>
            );
          })}
        </div>

        <div className="version-summary">
          <div className="version-identity">
            <span>{t.associatedCharacters}</span>
            <strong>{selectedVersion.characters[locale]}</strong>
            <small>{games.find((game) => game.id === selectedVersion.gameId)?.name[locale]} · {selectedVersion.version}</small>
          </div>
          <div><span>{t.dateWindow}</span><strong>{selectedVersion.date}<i>→</i>{selectedVersion.endDate}</strong><small>{selectedVersion.observedHours ? `${selectedVersion.observedHours} ${t.hours}` : "—"}</small></div>
          <div><span>{t.estimateBasis}</span><strong>{selectedVersion.scope[locale]}</strong><small>{t.confidence} {selectedVersion.confidence}</small></div>
          <div className="version-money"><span>{t.versionEstimate}</span><strong>{formatMoney(selectedVersion.revenue, locale)}</strong><small>{t.estimateRange} · {formatMoney(selectedVersion.revenueRange[0], locale)} — {formatMoney(selectedVersion.revenueRange[1], locale)}</small></div>
        </div>

        <div className="intelligence-grid">
          <section className="rank-section">
            <h3>{t.rankTitle}</h3>
            <div className="table-scroll">
              <table className="rank-table">
                <thead><tr><th>{t.region}</th><th>{t.peakRank}</th><th>{t.lowRank}</th><th>{t.rankMeaning}</th></tr></thead>
                <tbody>
                  {(Object.entries(selectedVersion.ranks) as Array<["CN" | "JP" | "US" | "KR", [number | null, number | null]]>).map(([country, rank]) => (
                    <tr key={country}><td><b>{country}</b>{marketNames[country][locale]}</td><td><strong>{rank[0] === null ? "—" : `#${rank[0]}`}</strong><small>{t.peakMeaning}</small></td><td><strong>{rank[1] === null ? "—" : `#${rank[1]}`}</strong><small>{t.lowMeaning}</small></td><td>{selectedVersion.date}<br />{selectedVersion.endDate}</td></tr>
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
                <thead><tr><th>{t.appLine}</th><th>{t.result}</th><th>{t.hoursAbove}</th><th>{t.coverage}</th></tr></thead>
                <tbody>
                  {selectedVersion.appHours.map((item) => {
                    const percentage = selectedVersion.observedHours ? (item.hours / selectedVersion.observedHours) * 100 : 0;
                    return (
                      <tr key={item.app.en}>
                        <td><strong>{item.app[locale]}</strong></td>
                        <td><span className={`line-result ${item.hours > 0 ? "yes" : "no"}`}>{item.hours > 0 ? t.exceeded : t.noHours}</span></td>
                        <td><div className="hours-cell"><i><b style={{ width: `${(item.hours / maxAppHours) * 100}%` }} /></i><strong>{item.hours > 0 ? `${item.hours} ${t.hours}` : "0"}</strong></div></td>
                        <td>{percentage.toFixed(1)}%</td>
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
