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
    nav: ["总览", "对比", "版本与角色", "估算口径"],
    navIds: ["overview", "compare", "versions", "methodology"],
    dataBadge: "演示估算 · 2026.07",
    disclaimer:
      "本页为产品演示快照，数值并非官方财报。接入授权 ST / AppMagic 数据后，将由可审计模型自动重算。",
    eyebrow: "跨平台二游商业表现数据库",
    title: "把二游流水，放在同一把尺子上。",
    intro:
      "按月、年度与版本查看六款游戏的合理区间估算，追踪角色卡池、各国 iOS 畅销榜与中国区应用线表现。",
    ytdTotal: "2026 年累计估算",
    observed: "已覆盖商业化项目",
    games: "款游戏",
    update: "数据更新至 2026-07-31",
    currentMonth: "7 月估算流水",
    ytd: "2026 YTD",
    vsPrev: "较上月",
    notLive: "暂无商业化观测",
    confidence: "置信度",
    trendTitle: "单游戏流水趋势",
    trendSub: "切换时间颗粒度，查看估算流水变化",
    month: "按月",
    year: "按年",
    version: "按版本",
    unit: "单位：亿元人民币 · 毛流水估算",
    peak: "本期峰值",
    average: "期间均值",
    latest: "最新一期",
    compareTitle: "游戏间流水比较",
    compareSub: "选择 2–6 款游戏，比较 2026 年累计估算",
    ytdEstimate: "YTD 估算",
    share: "入选游戏占比",
    selected: "已选择",
    versionTitle: "版本与角色表现",
    versionSub: "版本流水、各国 iOS 畅销榜区间与中国区应用线超越时长",
    allGames: "全部游戏",
    date: "上线日期",
    revenue: "版本估算流水",
    rank: "iOS 畅销榜峰值 → 最低",
    cnLines: "中国区 iOS 应用线",
    hoursAbove: "高于该应用",
    hours: "小时",
    noHours: "未超过",
    detailHint: "选择左侧版本查看应用线明细",
    methodologyTitle: "一套可复算的估算标准",
    methodologySub:
      "我们保留每次输入、系数、汇率与模型版本，让“估算”不再是一个黑箱数字。",
    methods: [
      ["01", "商店端基线", "海外 iOS / Google Play 采用 Sensor Tower 与 AppMagic 授权 IAP 毛收入估算的加权中位数；中国区仅使用 iOS 商店观测。"],
      ["02", "平台补全", "按游戏、地区与月份维护中国 Android、PC、主机与官网直充系数；系数由发行商公开信息与历史校准区间约束。"],
      ["03", "汇率与归属", "原币按日汇率加权换算为人民币；版本收入按卡池开放小时切分，跨月版本不会被重复计算。"],
      ["04", "区间与置信度", "A / B 级来自源间离散度、覆盖平台与数据延迟。展示毛流水中位数，同时保留 P25–P75 区间供 API 使用。"],
    ],
    formula: "全平台毛流水 = 商店端 IAP 基线 × 地区校正 × 平台补全 × 汇率",
    excludes: "不包含广告、电商周边、IP 授权；平台抽成前口径。",
    sources: "方法参考",
    sourceNote:
      "Sensor Tower 与 AppMagic 均为第三方估算，适合趋势与同口径比较，不应视为发行商审计收入。",
    footer: "流水观察局 · Gacha Revenue Observatory",
    footerNote: "数据产品原型 · 仅供研究与产品验收",
  },
  en: {
    nav: ["Overview", "Compare", "Versions & banners", "Methodology"],
    navIds: ["overview", "compare", "versions", "methodology"],
    dataBadge: "DEMO ESTIMATE · 2026.07",
    disclaimer:
      "This is a product demo snapshot, not publisher-reported revenue. Licensed ST / AppMagic inputs will be recalculated by an auditable model.",
    eyebrow: "Cross-platform gacha performance database",
    title: "One yardstick for gacha revenue.",
    intro:
      "Explore defensible monthly, annual, and version estimates across six games, with banner attribution, country iOS ranks, and China app-line performance.",
    ytdTotal: "2026 estimated total",
    observed: "Commercial titles covered",
    games: "games",
    update: "Updated through Jul 31, 2026",
    currentMonth: "July estimate",
    ytd: "2026 YTD",
    vsPrev: "vs previous month",
    notLive: "No commercial observation",
    confidence: "Confidence",
    trendTitle: "Single-game revenue trend",
    trendSub: "Change the time grain to inspect estimate movement",
    month: "Monthly",
    year: "Annual",
    version: "By version",
    unit: "CNY 100M · estimated gross bookings",
    peak: "Period peak",
    average: "Period average",
    latest: "Latest",
    compareTitle: "Cross-game comparison",
    compareSub: "Select 2–6 titles to compare 2026 YTD estimates",
    ytdEstimate: "YTD estimate",
    share: "Selected share",
    selected: "selected",
    versionTitle: "Version & banner performance",
    versionSub: "Revenue, country iOS grossing rank range, and hours above China app lines",
    allGames: "All games",
    date: "Launch date",
    revenue: "Version estimate",
    rank: "iOS grossing peak → low",
    cnLines: "China iOS app lines",
    hoursAbove: "Hours ranked above",
    hours: "hours",
    noHours: "Never above",
    detailHint: "Select a version on the left to inspect app lines",
    methodologyTitle: "An estimate you can reproduce",
    methodologySub:
      "Every input, coefficient, FX rate, and model version is retained, so estimates are not black-box numbers.",
    methods: [
      ["01", "Store baseline", "Overseas iOS / Google Play uses the weighted median of licensed Sensor Tower and AppMagic gross IAP estimates; China observes iOS only."],
      ["02", "Platform completion", "Per-game, market, and month coefficients complete China Android, PC, console, and direct top-up. Public disclosures and historical ranges constrain each coefficient."],
      ["03", "FX & attribution", "Daily FX converts local currency to CNY. Revenue is split by banner-open hour, preventing versions crossing months from being counted twice."],
      ["04", "Range & confidence", "A / B grades reflect source dispersion, platform coverage, and latency. The UI shows the gross median while the API retains P25–P75."],
    ],
    formula: "All-platform gross = Store IAP baseline × Region factor × Platform completion × FX",
    excludes: "Excludes ads, merchandise, and IP licensing; shown before platform fees.",
    sources: "Method references",
    sourceNote:
      "Sensor Tower and AppMagic are third-party estimates intended for directional and like-for-like analysis, not audited publisher revenue.",
    footer: "Gacha Revenue Observatory · 流水观察局",
    footerNote: "Data product prototype · research and product review only",
  },
} as const;

function formatMoney(value: number | null, locale: Locale) {
  if (value === null) return "—";
  return locale === "zh-CN" ? `¥${value.toFixed(2)} 亿` : `¥${value.toFixed(2)}B`;
}

function GameMark({ game, small = false }: { game: Game; small?: boolean }) {
  return (
    <span
      className={`game-mark ${small ? "game-mark-small" : ""}`}
      style={{ background: game.color }}
      aria-hidden="true"
    >
      {game.shortName}
    </span>
  );
}

function MiniTrend({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mini-trend" aria-hidden="true">
      {values.slice(-7).map((value, index) => (
        <span
          key={index}
          style={{ height: `${Math.max((value / max) * 100, 5)}%`, background: color }}
        />
      ))}
    </div>
  );
}

function LineChart({
  values,
  labels,
  color,
  locale,
}: {
  values: number[];
  labels: string[];
  color: string;
  locale: Locale;
}) {
  const max = Math.max(...values, 1) * 1.16;
  const width = 100 / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => ({
    x: index * width,
    y: 100 - (value / max) * 84 - 5,
    value,
  }));

  return (
    <div className="line-chart" aria-label={copy[locale].trendTitle}>
      <div className="chart-grid">
        {[0, 1, 2, 3].map((line) => (
          <span key={line} style={{ top: `${line * 30 + 5}%` }} />
        ))}
      </div>
      <div className="plot-area">
        {points.slice(0, -1).map((point, index) => {
          const next = points[index + 1];
          const dx = next.x - point.x;
          const dy = next.y - point.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <span
              className="chart-segment"
              key={`segment-${index}`}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                width: `${length}%`,
                transform: `rotate(${angle}deg)`,
                background: color,
              }}
            />
          );
        })}
        {points.map((point, index) => (
          <span
            className="chart-point"
            key={`point-${index}`}
            style={{ left: `${point.x}%`, top: `${point.y}%`, borderColor: color }}
          >
            <span className="point-label">{point.value.toFixed(1)}</span>
          </span>
        ))}
      </div>
      <div className="chart-labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [selectedGame, setSelectedGame] = useState<GameId>("hsr");
  const [period, setPeriod] = useState<Period>("month");
  const [compareIds, setCompareIds] = useState<GameId[]>([
    "genshin",
    "hsr",
    "zzz",
    "wuwa",
  ]);
  const [versionGame, setVersionGame] = useState<GameId | "all">("all");
  const [selectedVersionId, setSelectedVersionId] = useState("hsr-32");

  const activeGame = games.find((game) => game.id === selectedGame) ?? games[0];
  const selectedVersion =
    versionDetails.find((version) => version.id === selectedVersionId) ?? versionDetails[0];
  const visibleVersions = versionDetails.filter(
    (item) => versionGame === "all" || item.gameId === versionGame,
  );
  const comparisonGames = games.filter((game) => compareIds.includes(game.id) && game.ytd !== null);
  const compareTotal = comparisonGames.reduce((sum, game) => sum + (game.ytd ?? 0), 0);

  const trend = useMemo(() => {
    if (period === "year") {
      return { values: activeGame.yearly, labels: yearLabels };
    }
    if (period === "version") {
      return {
        values: activeGame.versions.map((item) => item.value),
        labels: activeGame.versions.map((item) => item.label),
      };
    }
    return { values: activeGame.monthly, labels: monthLabels[locale] };
  }, [activeGame, locale, period]);

  const stats = useMemo(() => {
    const populated = trend.values.filter((value) => value > 0);
    if (!populated.length) return { peak: 0, average: 0, latest: 0 };
    return {
      peak: Math.max(...populated),
      average: populated.reduce((sum, value) => sum + value, 0) / populated.length,
      latest: populated[populated.length - 1],
    };
  }, [trend]);

  const toggleCompare = (id: GameId) => {
    setCompareIds((current) => {
      if (current.includes(id)) {
        return current.length <= 2 ? current : current.filter((gameId) => gameId !== id);
      }
      return [...current, id];
    });
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href={`/${locale}`} aria-label={t.footer}>
          <span className="brand-symbol"><i /><i /><i /></span>
          <span><strong>ROLLING</strong><small>流水观察局</small></span>
        </a>
        <nav aria-label="Primary navigation">
          {t.nav.map((label, index) => (
            <a key={label} href={`#${t.navIds[index]}`}>{label}</a>
          ))}
        </nav>
        <div className="header-actions">
          <span className="snapshot-badge">{t.dataBadge}</span>
          <a className={locale === "zh-CN" ? "active" : ""} href="/zh-CN">中</a>
          <span>/</span>
          <a className={locale === "en" ? "active" : ""} href="/en">EN</a>
        </div>
      </header>

      <div className="demo-banner"><span>i</span>{t.disclaimer}</div>

      <section className="hero" id="overview">
        <div className="hero-copy">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
        <div className="hero-metric">
          <span>{t.ytdTotal}</span>
          <strong>¥72.0<small>{locale === "zh-CN" ? "亿" : "B"}</small></strong>
          <div><b>5</b> {t.observed} · <b>6</b> {t.games}</div>
          <small>{t.update}</small>
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
              style={{ "--game-color": game.color, "--game-pale": game.pale } as React.CSSProperties}
            >
              <div className="game-card-top">
                <GameMark game={game} />
                <span className={`confidence confidence-${game.confidence.replace("+", "plus")}`}>
                  {t.confidence} {game.confidence}
                </span>
              </div>
              <div className="game-name"><strong>{game.name[locale]}</strong><span>{game.publisher}</span></div>
              {game.currentMonth === null ? (
                <div className="not-live"><b>—</b><span>{t.notLive}</span></div>
              ) : (
                <>
                  <div className="card-money"><strong>{formatMoney(game.currentMonth, locale)}</strong><span>{t.currentMonth}</span></div>
                  <div className="card-foot">
                    <span>{t.ytd} <b>{formatMoney(game.ytd, locale)}</b></span>
                    <span className={game.change && game.change > 0 ? "positive" : "negative"}>
                      {game.change && game.change > 0 ? "+" : ""}{game.change}%
                    </span>
                  </div>
                  <MiniTrend values={game.monthly} color={game.color} />
                </>
              )}
            </button>
          );
        })}
      </section>

      <section className="panel trend-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">01 · TREND</p>
            <h2>{t.trendTitle}</h2>
            <p>{t.trendSub}</p>
          </div>
          <div className="period-switch" role="group" aria-label={t.trendSub}>
            {(["month", "year", "version"] as Period[]).map((item) => (
              <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>
                {t[item]}
              </button>
            ))}
          </div>
        </div>
        <div className="trend-layout">
          <div className="trend-main">
            <div className="chart-title-row">
              <div><GameMark game={activeGame} small /><strong>{activeGame.name[locale]}</strong></div>
              <span>{t.unit}</span>
            </div>
            {trend.values.length ? (
              <LineChart values={trend.values} labels={trend.labels} color={activeGame.color} locale={locale} />
            ) : (
              <div className="empty-chart">{t.notLive}</div>
            )}
          </div>
          <aside className="trend-stats">
            <div><span>{t.peak}</span><strong>{formatMoney(stats.peak, locale)}</strong></div>
            <div><span>{t.average}</span><strong>{formatMoney(stats.average, locale)}</strong></div>
            <div><span>{t.latest}</span><strong>{formatMoney(stats.latest, locale)}</strong></div>
            <p><i style={{ background: activeGame.color }} />{activeGame.name[locale]} · {period === "month" ? "2026" : "2022—2026"}</p>
          </aside>
        </div>
      </section>

      <section className="panel comparison-panel" id="compare">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">02 · COMPARE</p>
            <h2>{t.compareTitle}</h2>
            <p>{t.compareSub}</p>
          </div>
          <span className="selected-count">{compareIds.length} {t.selected}</span>
        </div>
        <div className="game-toggles">
          {games.map((game) => (
            <button
              key={game.id}
              className={compareIds.includes(game.id) ? "active" : ""}
              onClick={() => toggleCompare(game.id)}
              style={{ "--game-color": game.color } as React.CSSProperties}
            >
              <span style={{ background: game.color }} />{game.name[locale]}
            </button>
          ))}
        </div>
        <div className="compare-bars">
          {comparisonGames
            .sort((a, b) => (b.ytd ?? 0) - (a.ytd ?? 0))
            .map((game, index) => (
              <div className="compare-row" key={game.id}>
                <span className="compare-rank">0{index + 1}</span>
                <div className="compare-game"><GameMark game={game} small /><strong>{game.name[locale]}</strong></div>
                <div className="compare-bar-track">
                  <span style={{ width: `${((game.ytd ?? 0) / 24) * 100}%`, background: game.color }} />
                </div>
                <div className="compare-value"><strong>{formatMoney(game.ytd, locale)}</strong><small>{t.ytdEstimate}</small></div>
                <div className="compare-share"><strong>{compareTotal ? (((game.ytd ?? 0) / compareTotal) * 100).toFixed(1) : 0}%</strong><small>{t.share}</small></div>
              </div>
            ))}
        </div>
      </section>

      <section className="panel versions-panel" id="versions">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">03 · VERSION INTELLIGENCE</p>
            <h2>{t.versionTitle}</h2>
            <p>{t.versionSub}</p>
          </div>
          <select value={versionGame} onChange={(event) => setVersionGame(event.target.value as GameId | "all")} aria-label={t.allGames}>
            <option value="all">{t.allGames}</option>
            {games.map((game) => <option key={game.id} value={game.id}>{game.name[locale]}</option>)}
          </select>
        </div>
        <div className="version-layout">
          <div className="version-list">
            {visibleVersions.map((item) => {
              const game = games.find((entry) => entry.id === item.gameId)!;
              return (
                <button key={item.id} className={item.id === selectedVersion.id ? "active" : ""} onClick={() => setSelectedVersionId(item.id)}>
                  <div className="version-main-info">
                    <GameMark game={game} small />
                    <span><strong>{game.name[locale]} {item.version}</strong><small>{item.characters[locale]}</small></span>
                  </div>
                  <span className="version-date"><small>{t.date}</small>{item.date}</span>
                  <span className="version-revenue"><small>{t.revenue}</small><strong>{formatMoney(item.revenue, locale)}</strong></span>
                  <span className="row-arrow">→</span>
                </button>
              );
            })}
          </div>
          <aside className="version-detail">
            <div className="version-detail-head">
              <span>{t.rank}</span>
              <strong>{games.find((game) => game.id === selectedVersion.gameId)?.name[locale]} {selectedVersion.version}</strong>
              <small>{selectedVersion.characters[locale]}</small>
            </div>
            <div className="country-ranks">
              {Object.entries(selectedVersion.ranks).map(([country, rank]) => (
                <div key={country}><span>{country}</span><strong>{rank[0] ?? "—"}</strong><i>→</i><b>{rank[1] ?? "—"}</b></div>
              ))}
            </div>
            <div className="app-line-head"><strong>{t.cnLines}</strong><span>{t.hoursAbove}</span></div>
            <div className="app-lines">
              {selectedVersion.appHours.map((item) => (
                <div key={item.app.en}>
                  <span>{item.app[locale]}</span>
                  <i><b style={{ width: `${Math.min((item.hours / 125) * 100, 100)}%` }} /></i>
                  <strong>{item.hours ? `${item.hours} ${t.hours}` : t.noHours}</strong>
                </div>
              ))}
            </div>
            <p className="detail-note">{t.detailHint}</p>
          </aside>
        </div>
      </section>

      <section className="methodology" id="methodology">
        <div className="method-intro">
          <p className="section-kicker">04 · METHODOLOGY</p>
          <h2>{t.methodologyTitle}</h2>
          <p>{t.methodologySub}</p>
          <div className="formula-card"><span>MODEL / v1.4</span><strong>{t.formula}</strong><small>{t.excludes}</small></div>
        </div>
        <div className="method-list">
          {t.methods.map((method) => (
            <div key={method[0]}><span>{method[0]}</span><div><strong>{method[1]}</strong><p>{method[2]}</p></div></div>
          ))}
          <div className="source-links">
            <strong>{t.sources}</strong>
            <a href="https://sensortower.com/product/mobile-app/app-performance-insights" target="_blank" rel="noreferrer">Sensor Tower ↗</a>
            <a href="https://appmagic.rocks/tool-descriptions/iap-distribution/" target="_blank" rel="noreferrer">AppMagic ↗</a>
          </div>
          <p className="source-note">{t.sourceNote}</p>
        </div>
      </section>

      <footer><strong>{t.footer}</strong><span>{t.footerNote}</span><a href="#overview">↑ TOP</a></footer>
    </main>
  );
}

