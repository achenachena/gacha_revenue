import "server-only";

import {
  normalizeExchangeRate,
  normalizePublicRevenue,
  type ExchangeRateData,
  type ExchangeRateResponse,
  type PublicRevenueData,
  type PublicRevenueResponse,
} from "./api-client";
import { backendConfiguration, backendPolicies, maxBackendResponseBytes } from "./backend-server";

type InitialDashboardData = {
  revenue: PublicRevenueData | null;
  exchangeRate: ExchangeRateData | null;
};

async function fetchBackendJSON<T>(endpoint: "public-revenue" | "exchange-rate"): Promise<T | null> {
  const configuration = backendConfiguration();
  if (!configuration) return null;

  try {
    const response = await fetch(new URL(endpoint, configuration.baseURL), {
      headers: { Accept: "application/json", "X-Backend-Token": configuration.token },
      next: { revalidate: backendPolicies[endpoint].revalidate },
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || !contentType.toLowerCase().startsWith("application/json") || contentLength > maxBackendResponseBytes) {
      return null;
    }
    const body = await response.arrayBuffer();
    if (body.byteLength > maxBackendResponseBytes) return null;
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    return null;
  }
}

export async function loadInitialDashboardData(): Promise<InitialDashboardData> {
  const [revenuePayload, exchangeRatePayload] = await Promise.all([
    fetchBackendJSON<PublicRevenueResponse>("public-revenue"),
    fetchBackendJSON<ExchangeRateResponse>("exchange-rate"),
  ]);
  return {
    revenue: revenuePayload ? normalizePublicRevenue(revenuePayload) : null,
    exchangeRate: exchangeRatePayload ? normalizeExchangeRate(exchangeRatePayload) : null,
  };
}
