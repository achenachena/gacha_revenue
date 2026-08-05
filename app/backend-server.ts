import "server-only";

export const backendPolicies = {
  "public-revenue": { revalidate: 21_600 },
  "exchange-rate": { revalidate: 43_200 },
  methodology: { revalidate: 86_400 },
  versions: { revalidate: 60 },
  "banner-metrics": { revalidate: 300 },
  "banner-rankings": { revalidate: 300 },
} as const;

export const maxBackendResponseBytes = 2 * 1024 * 1024;

export type BackendEndpoint = keyof typeof backendPolicies;

export function backendConfiguration(): { baseURL: URL; token: string } | null {
  const raw = process.env.BACKEND_API_BASE_URL?.trim();
  const token = process.env.BACKEND_PROXY_TOKEN;
  if (!raw || !token || token.length < 32 || token.length > 256) return null;

  try {
    const baseURL = new URL(raw.endsWith("/") ? raw : `${raw}/`);
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      baseURL.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(baseURL.hostname);
    if ((!localDevelopment && baseURL.protocol !== "https:") || baseURL.username || baseURL.password || baseURL.hash) return null;
    return { baseURL, token };
  } catch {
    return null;
  }
}
