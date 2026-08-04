export type PublishedRevenueMonth = {
  year: number;
  month: number;
  value: number;
};

type RevenueGameId = "genshin" | "hsr" | "zzz" | "wuwa" | "endfield" | "nte";

function yearSeries(year: number, values: number[], firstMonth = 1): PublishedRevenueMonth[] {
  return values.map((value, index) => ({ year, month: firstMonth + index, value }));
}

/**
 * Published mobile IAP estimates in millions of USD.
 *
 * Historical points through June 2025 were recovered from GACHAREVENUE's
 * public regional dataset and combined with its published formula: all
 * available non-CN regional totals + CN iOS * 2.75 (iOS + estimated Android).
 * The existing GachaDash snapshot remains the incremental source from July
 * 2025 onward. Sensor Tower's June 2025 model revision is already reflected.
 *
 * GACHAREVENUE warns that some migrated legacy rows are missing regions. We
 * therefore intentionally exclude pre-2024 Genshin/HSR rows instead of
 * presenting incomplete regional sums as worldwide estimates.
 */
export const publishedRevenueHistory: Record<RevenueGameId, PublishedRevenueMonth[]> = {
  genshin: [
    ...yearSeries(2024, [99.25, 92.75, 68, 119.5, 53.25, 67.5, 37.25, 42.25, 46.25, 52.75, 37.795, 45.585]),
    ...yearSeries(2025, [99.44, 27.28, 39.845, 22.69, 36.085, 65.505, 42.335, 27.765, 43.875, 56.725, 20.97, 40.825]),
    ...yearSeries(2026, [66.04, 55.245, 40.11, 40.105, 41.655, 33.34]),
  ],
  hsr: [
    ...yearSeries(2024, [47.5, 92.5, 144.25, 109, 91, 95.5, 41.25, 40.25, 69, 43.25, 23.595, 55.52]),
    ...yearSeries(2025, [50.775, 45.785, 29.935, 103.45, 44.575, 19.12, 92.45, 29.925, 39.535, 23.45, 81.38, 27.895]),
    ...yearSeries(2026, [8.0375, 21.135, 31.73, 58.1, 38.765, 28.455]),
  ],
  zzz: [
    ...yearSeries(2024, [99.75, 32.5, 35.5, 15.5, 20.29, 57.93], 7),
    ...yearSeries(2025, [26.255, 17.935, 15.915, 21.94, 10.615, 38.34, 22.96, 15.925, 10.89, 12.915, 10.89, 27.55]),
    ...yearSeries(2026, [23.245, 13.35, 16.44, 7.167, 9.37, 9.655]),
  ],
  wuwa: [
    ...yearSeries(2024, [25.75, 46.25, 29.5, 13.5, 11.5, 9.75, 18.25, 7.75], 5),
    ...yearSeries(2025, [28, 13.775, 21.625, 21.625, 25.35, 39.975, 16.875, 14.875, 21.9, 16.6, 18.875, 23.175]),
    ...yearSeries(2026, [19.15, 46, 11.4, 14.7, 31.75, 34]),
  ],
  endfield: yearSeries(2026, [28.55, 26.08, 22.05, 17.28, 4.766, 9.52]),
  nte: yearSeries(2026, [6.74, 23.575, 13.95], 4),
};

export const historicalRevenueSource = {
  name: "GACHAREVENUE",
  url: "https://revenue.ennead.cc/revenue",
  changelogUrl: "https://revenue.ennead.cc/changelog",
  retrievedAt: "2026-08-04",
  unit: "million_usd",
  reliableCoverageStart: {
    genshin: "2024-01",
    hsr: "2024-01",
    zzz: "2024-07",
    wuwa: "2024-05",
    endfield: "2026-01",
    nte: "2026-04",
  } satisfies Record<RevenueGameId, string>,
} as const;
