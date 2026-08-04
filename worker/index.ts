/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type RankMarket = "cn" | "jp" | "us" | "kr";

const gameAppIds: Record<string, Partial<Record<RankMarket, string>>> = {
  genshin: { cn: "1467190251", jp: "1517783697", us: "1517783697", kr: "1517783697" },
  hsr: { cn: "1523037824", jp: "1599719154", us: "1599719154", kr: "1599719154" },
  zzz: { cn: "1606359076", jp: "1606356401", us: "1606356401", kr: "1606356401" },
  wuwa: { cn: "6450693428", jp: "6475033368", us: "6475033368", kr: "6475033368" },
  endfield: { cn: "6753859465", jp: "6752642477", us: "6752642477", kr: "6752642477" },
  nte: { cn: "6514281568", jp: "6754593077", us: "6754593077", kr: "6754593077" },
};

const appLineIds: Record<string, string> = {
  douyin: "1142110895",
  tencent_video: "458318329",
  qq_music: "414603431",
  capcut_cn: "1458072671",
  netease_music: "590338362",
  baidu_netdisk: "547166701",
  quark: "1160172628",
};

type AppleFeedEntry = { id?: { attributes?: { "im:id"?: string } } };

function json(payload: unknown, status = 200, cacheControl?: string) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  return new Response(JSON.stringify(payload), { status, headers });
}

function currentUtcHour() {
  const date = new Date();
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

async function collectAppleRanks(env: Env) {
  const observedAt = currentUtcHour();
  const capturedAt = new Date().toISOString();
  const markets = Object.keys({ cn: 1, jp: 1, us: 1, kr: 1 }) as RankMarket[];
  const snapshots = await Promise.all(markets.map(async (market) => {
    const sourceUrl = `https://itunes.apple.com/${market}/rss/topgrossingapplications/limit=200/json`;
    const response = await fetch(sourceUrl, { headers: { "User-Agent": "gacha-revenue-observatory/1.0" } });
    if (!response.ok) throw new Error(`Apple ${market} feed returned ${response.status}`);
    const payload = await response.json() as { feed?: { entry?: AppleFeedEntry[] } };
    const ranks = new Map<string, number>();
    (payload.feed?.entry ?? []).forEach((entry, index) => {
      const appId = entry.id?.attributes?.["im:id"];
      if (appId) ranks.set(appId, index + 1);
    });
    return { market, sourceUrl, sourceStatus: response.status, ranks };
  }));

  const statements: D1PreparedStatement[] = [];
  const upsert = `INSERT INTO ios_rank_observations
    (subject_key, market, observed_at, rank, source_url, source_status, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(subject_key, market, observed_at) DO UPDATE SET
      rank=excluded.rank, source_url=excluded.source_url,
      source_status=excluded.source_status, captured_at=excluded.captured_at`;
  for (const snapshot of snapshots) {
    for (const [gameId, ids] of Object.entries(gameAppIds)) {
      const appId = ids[snapshot.market];
      if (!appId) continue;
      statements.push(env.DB.prepare(upsert).bind(`game:${gameId}`, snapshot.market.toUpperCase(), observedAt, snapshot.ranks.get(appId) ?? null, snapshot.sourceUrl, snapshot.sourceStatus, capturedAt));
    }
    if (snapshot.market === "cn") {
      for (const [lineId, appId] of Object.entries(appLineIds)) {
        statements.push(env.DB.prepare(upsert).bind(`line:${lineId}`, "CN", observedAt, snapshot.ranks.get(appId) ?? null, snapshot.sourceUrl, snapshot.sourceStatus, capturedAt));
      }
    }
  }
  if (statements.length) await env.DB.batch(statements);
  return { observed_at: observedAt, records: statements.length, source: "Apple public Top Grossing RSS", limit: 200 };
}

async function rankRefresh(env?: Env) {
  if (!env?.DB) return json({ error: "rank database binding is unavailable" }, 503);
  try {
    const last = await env.DB.prepare("SELECT MAX(observed_at) AS observed_at FROM ios_rank_observations").first<{ observed_at: string | null }>();
    if (last?.observed_at === currentUtcHour()) return json({ status: "already_collected", observed_at: last.observed_at });
    return json({ status: "collected", ...(await collectAppleRanks(env)) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "rank collection failed" }, 502);
  }
}

async function bannerMetrics(url: URL, env?: Env) {
  if (!env?.DB) return json({ error: "rank database binding is unavailable" }, 503);
  const gameId = url.searchParams.get("game_id") ?? "";
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  if (!Object.hasOwn(gameAppIds, gameId) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return json({ error: "valid game_id, start and end are required" }, 400);
  }
  try {
    const rankRows = await env.DB.prepare(`SELECT market,
      MIN(rank) AS peak_rank,
      MAX(rank) AS lowest_rank,
      SUM(CASE WHEN rank IS NOT NULL THEN 1 ELSE 0 END) AS ranked_hours,
      COUNT(*) AS observed_hours,
      SUM(CASE WHEN rank IS NULL THEN 1 ELSE 0 END) AS outside_top_200_hours
    FROM ios_rank_observations
    WHERE subject_key = ? AND observed_at >= ? AND observed_at < ?
    GROUP BY market ORDER BY market`)
    .bind(`game:${gameId}`, `${start}T00:00:00.000Z`, `${end}T00:00:00.000Z`).all();
    const lineRows = await env.DB.prepare(`SELECT SUBSTR(line.subject_key, 6) AS app_id,
      SUM(CASE WHEN COALESCE(game.rank, 201) < COALESCE(line.rank, 201) THEN 1 ELSE 0 END) AS hours_above,
      COUNT(*) AS observed_hours,
      MAX(game.captured_at) AS updated_at
    FROM ios_rank_observations game
    JOIN ios_rank_observations line ON line.market='CN' AND line.observed_at=game.observed_at AND line.subject_key LIKE 'line:%'
    WHERE game.subject_key=? AND game.market='CN' AND game.observed_at >= ? AND game.observed_at < ?
    GROUP BY line.subject_key ORDER BY line.subject_key`)
    .bind(`game:${gameId}`, `${start}T00:00:00.000Z`, `${end}T00:00:00.000Z`).all();
    const ranks: Record<string, unknown> = {};
    for (const row of rankRows.results as Array<Record<string, unknown>>) {
      ranks[String(row.market)] = {
        peak_rank: row.peak_rank,
        lowest_rank: row.lowest_rank,
        observed_hours: row.observed_hours,
        ranked_hours: row.ranked_hours,
        lowest_is_beyond_200: Number(row.outside_top_200_hours ?? 0) > 0,
      };
    }
    let phaseRevenue: Awaited<ReturnType<typeof phaseRevenueEstimate>> = null;
    try {
      phaseRevenue = await phaseRevenueEstimate(gameId, start, end, env);
    } catch {
      // Rank metrics remain useful if the public monthly source is temporarily unavailable.
    }
    return json({ data: { ranks, app_line_observations: lineRows.results, source: "apple_public_feed", feed_limit: 200, phase_revenue: phaseRevenue }, meta: { start, end, game_id: gameId } }, 200, "public, max-age=300, s-maxage=900");
  } catch (error) {
    const message = error instanceof Error ? error.message : "rank metrics unavailable";
    const missingSchema = message.includes("no such table") || message.includes("no such column");
    return json({ error: missingSchema ? "rank database schema is not ready" : message }, missingSchema ? 503 : 502);
  }
}

const revenueGames = [
  ["genshin", "genshin-impact"], ["hsr", "honkai-star-rail"], ["zzz", "zenless-zone-zero"],
  ["wuwa", "wuthering-waves"], ["endfield", "arknights-endfield"], ["nte", "neverness-to-everness"],
] as const;

async function fetchGameRevenueHistory(slug: string) {
  const sourceUrl = `https://www.gachadash.com/game/${slug}`;
  const response = await fetch(sourceUrl, { headers: { "User-Agent": "gacha-revenue-observatory/1.0" } });
  if (!response.ok) throw new Error(`${slug} returned ${response.status}`);
  const html = await response.text();
  const start = html.indexOf('\\"revenueHistory\\":[');
  const finish = html.indexOf("]", start);
  if (start < 0 || finish < 0) throw new Error(`${slug} revenue history not found`);
  const history: Array<{ year: number; month: number; value: number }> = [];
  const pattern = /\\"year\\":(\d{4}),\\"month\\":(\d+),\\"revenue_total\\":(\d+)/g;
  for (const match of html.slice(start, finish + 1).matchAll(pattern)) {
    history.push({ year: Number(match[1]), month: Number(match[2]), value: Number(match[3]) / 100_000_000 });
  }
  if (!history.length) throw new Error(`${slug} revenue history was empty`);
  return { history, sourceUrl };
}

async function phaseRevenueEstimate(gameId: string, start: string, end: string, env: Env) {
  const slug = revenueGames.find(([id]) => id === gameId)?.[1];
  if (!slug) return null;
  const { history } = await fetchGameRevenueHistory(slug);
  const phaseStart = new Date(`${start}T00:00:00.000Z`);
  const phaseEnd = new Date(`${end}T00:00:00.000Z`);
  const firstMonth = new Date(Date.UTC(phaseStart.getUTCFullYear(), phaseStart.getUTCMonth(), 1));
  let estimate = 0;
  let usedMonths = 0;
  let minimumCoverage = 1;
  const marketWeights: Record<string, number> = { CN: 0.45, JP: 0.25, US: 0.2, KR: 0.1 };
  for (let cursor = firstMonth; cursor < phaseEnd; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const sourceMonth = history.find((item) => item.year === cursor.getUTCFullYear() && item.month === cursor.getUTCMonth() + 1);
    if (!sourceMonth) return null;
    const rows = await env.DB.prepare(`SELECT market, observed_at, rank FROM ios_rank_observations
      WHERE subject_key=? AND observed_at>=? AND observed_at<? ORDER BY observed_at, market`)
      .bind(`game:${gameId}`, cursor.toISOString(), monthEnd.toISOString()).all();
    const byHour = new Map<string, number>();
    for (const row of rows.results as Array<Record<string, unknown>>) {
      const observedAt = String(row.observed_at);
      const market = String(row.market);
      const rank = Number(row.rank ?? 201);
      byHour.set(observedAt, (byHour.get(observedAt) ?? 0) + (marketWeights[market] ?? 0) * rank ** -0.85);
    }
    const expectedHours = (monthEnd.getTime() - cursor.getTime()) / 3_600_000;
    const coverage = byHour.size / expectedHours;
    minimumCoverage = Math.min(minimumCoverage, coverage);
    if (coverage < 0.8) return { estimate: null, coverage: minimumCoverage, formula: "rank_weighted_monthly_allocation", threshold: 0.8 };
    let monthWeight = 0;
    let phaseWeight = 0;
    for (const [hour, weight] of byHour) {
      monthWeight += weight;
      const at = new Date(hour);
      if (at >= phaseStart && at < phaseEnd) phaseWeight += weight;
    }
    if (monthWeight <= 0) return null;
    estimate += sourceMonth.value * (phaseWeight / monthWeight);
    usedMonths += 1;
  }
  return { estimate: usedMonths ? estimate : null, coverage: minimumCoverage, formula: "rank_weighted_monthly_allocation", threshold: 0.8 };
}

async function publicRevenue() {
  try {
    const data = await Promise.all(revenueGames.map(async ([gameId, slug]) => {
      const { history, sourceUrl } = await fetchGameRevenueHistory(slug);
      return { game_id: gameId, history, source_url: sourceUrl };
    }));
    return json({ data, meta: { currency: "USD", unit: "million", basis: "mobile_iap_ios_android", provider: "Sensor Tower via GachaRevenue / GachaDash", china_android_multiplier: 1.75, fetched_at: new Date().toISOString() } }, 200, "public, max-age=3600, s-maxage=21600");
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "public revenue refresh failed" }, 502);
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/public-revenue") return publicRevenue();
    if (url.pathname === "/api/ranks/refresh") return rankRefresh(env);
    if (url.pathname === "/api/banner-metrics") return bannerMetrics(url, env);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env!.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env!.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(collectAppleRanks(env));
  },
};

export default worker;
