import type { NextRequest } from "next/server";

const allowedGames = new Set(["genshin", "hsr", "zzz", "wuwa", "endfield", "nte"]);
const policies = {
  "public-revenue": { revalidate: 21_600 },
  "exchange-rate": { revalidate: 43_200 },
  methodology: { revalidate: 86_400 },
  versions: { revalidate: 60 },
  "banner-metrics": { revalidate: 300 },
} as const;
const maxResponseBytes = 2 * 1024 * 1024;

export type BackendEndpoint = keyof typeof policies;

function jsonError(status: number, error: string) {
  return Response.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    },
  );
}

function isISODate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function validatedQuery(endpoint: BackendEndpoint, searchParams: URLSearchParams): URLSearchParams | null {
  if (endpoint === "public-revenue" || endpoint === "exchange-rate" || endpoint === "methodology") {
    return searchParams.size === 0 ? new URLSearchParams() : null;
  }
  if (endpoint === "versions") {
    if ([...searchParams.keys()].some((key) => key !== "game_id")) return null;
    if (searchParams.getAll("game_id").length > 1) return null;
    const gameID = searchParams.get("game_id");
    return gameID === null || allowedGames.has(gameID) ? new URLSearchParams(searchParams) : null;
  }
  if ([...searchParams.keys()].some((key) => !["game_id", "start", "end"].includes(key))) return null;
  const gameID = searchParams.get("game_id");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (["game_id", "start", "end"].some((key) => searchParams.getAll(key).length !== 1)) return null;
  if (!gameID || !allowedGames.has(gameID) || !isISODate(start) || !isISODate(end)) return null;
  const startAt = new Date(`${start}T00:00:00Z`);
  const endAt = new Date(`${end}T00:00:00Z`);
  const duration = endAt.getTime() - startAt.getTime();
  if (duration <= 0 || duration > 62 * 24 * 60 * 60 * 1000) return null;
  return new URLSearchParams({ game_id: gameID, start, end });
}

function upstreamBaseURL(): URL | null {
  const raw = process.env.BACKEND_API_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw.endsWith("/") ? raw : `${raw}/`);
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(parsed.hostname);
    if ((!localDevelopment && parsed.protocol !== "https:") || parsed.username || parsed.password || parsed.hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function proxyBackend(request: NextRequest, endpoint: BackendEndpoint) {
  const query = validatedQuery(endpoint, request.nextUrl.searchParams);
  if (!query) return jsonError(400, "invalid query");
  const baseURL = upstreamBaseURL();
  const token = process.env.BACKEND_PROXY_TOKEN;
  if (!baseURL || !token || token.length < 32 || token.length > 256) return jsonError(503, "data service unavailable");

  const upstreamURL = new URL(endpoint, baseURL);
  upstreamURL.search = query.toString();
  try {
    const upstream = await fetch(upstreamURL, {
      headers: { Accept: "application/json", "X-Backend-Token": token },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    const contentLength = Number(upstream.headers.get("content-length") ?? 0);
    if (!contentType.toLowerCase().startsWith("application/json") || contentLength > maxResponseBytes) {
      return jsonError(502, "invalid upstream response");
    }
    const body = await upstream.arrayBuffer();
    if (body.byteLength > maxResponseBytes) return jsonError(502, "invalid upstream response");
    const policy = policies[endpoint];
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": upstream.ok
          ? `public, max-age=60, s-maxage=${policy.revalidate}, stale-while-revalidate=${policy.revalidate}, stale-if-error=86400`
          : "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError(502, "data service unavailable");
  }
}
