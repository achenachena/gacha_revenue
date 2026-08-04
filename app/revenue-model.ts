import type { Game, GameId, Locale, RevenueMonth, VersionDetail } from "./data";

export type RevenuePeriod = Pick<RevenueMonth, "year" | "month">;
export type VersionPointLimit = 4 | 8 | 12 | "all";

const periodNumber = (period: RevenuePeriod) => period.year * 12 + period.month;

export function latestRevenuePeriod(games: Game[]): RevenuePeriod | null {
  let latest: RevenuePeriod | null = null;
  for (const game of games) {
    for (const item of game.revenueHistory) {
      if (!latest || periodNumber(item) > periodNumber(latest)) latest = { year: item.year, month: item.month };
    }
  }
  return latest;
}

export function highestRevenueGameId(games: Game[]): GameId {
  return games.reduce((highest, game) => {
    if (game.currentMonth === null) return highest;
    if (highest.currentMonth === null || game.currentMonth > highest.currentMonth) return game;
    return highest;
  }, games[0]).id;
}

function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`).getTime();
}

export function estimatePhaseRevenue(version: VersionDetail, history: RevenueMonth[]): number | null {
  if (version.revenue !== null) return version.revenue;
  const phaseStart = utcDate(version.date);
  const phaseEnd = utcDate(version.endDate);
  let estimate = 0;
  let covered = false;

  for (const item of history) {
    const monthStart = Date.UTC(item.year, item.month - 1, 1);
    const monthEnd = Date.UTC(item.year, item.month, 1);
    const overlap = Math.max(0, Math.min(phaseEnd, monthEnd) - Math.max(phaseStart, monthStart));
    if (!overlap) continue;
    covered = true;
    estimate += item.value * (overlap / (monthEnd - monthStart));
  }

  return covered ? estimate : null;
}

export function buildVersionRevenueSeries(
  game: Game,
  versions: VersionDetail[],
  limit: VersionPointLimit,
  locale: Locale,
) {
  const points = versions
    .filter((version) => version.gameId === game.id)
    .map((version) => ({ version, value: estimatePhaseRevenue(version, game.revenueHistory) }))
    .filter((point): point is { version: VersionDetail; value: number } => point.value !== null)
    .sort((a, b) => a.version.date.localeCompare(b.version.date));
  const visible = limit === "all" ? points : points.slice(-limit);

  return {
    values: visible.map((point) => point.value),
    labels: visible.map((point) => {
      const phase = point.version.phaseIndex === 1
        ? locale === "zh-CN" ? "上" : "P1"
        : point.version.phaseIndex === 2
          ? locale === "zh-CN" ? "下" : "P2"
          : locale === "zh-CN" ? `第${point.version.phaseIndex}期` : `P${point.version.phaseIndex}`;
      return `${point.version.version}${phase}`;
    }),
    available: points.length,
  };
}
