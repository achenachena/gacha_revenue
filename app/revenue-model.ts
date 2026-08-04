import type { Game, GameId, Locale, RevenueMonth, VersionDetail } from "./data";

export type RevenuePeriod = Pick<RevenueMonth, "year" | "month">;
export type VersionRange = { startId: string; endId: string };

export type VersionRangeOption = {
  id: string;
  label: string;
  date: string;
  estimable: boolean;
};

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

export function highestYTDGameId(games: Game[]): GameId {
  return games.reduce((highest, game) => {
    if (game.ytd === null) return highest;
    if (highest.ytd === null || game.ytd > highest.ytd) return game;
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

function phaseLabel(version: VersionDetail, locale: Locale) {
  const phase = version.phaseIndex === 1
    ? locale === "zh-CN" ? "上" : "P1"
    : version.phaseIndex === 2
      ? locale === "zh-CN" ? "下" : "P2"
      : locale === "zh-CN" ? `第${version.phaseIndex}期` : `P${version.phaseIndex}`;
  return `${version.version}${phase}`;
}

export function buildVersionRangeOptions(
  game: Game,
  versions: VersionDetail[],
  locale: Locale,
): VersionRangeOption[] {
  const unique = new Map<string, VersionDetail>();
  for (const version of versions) {
    if (version.gameId !== game.id) continue;
    unique.set(version.id, version);
  }
  return [...unique.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.phaseIndex - b.phaseIndex)
    .map((version) => ({
      id: version.id,
      label: `${phaseLabel(version, locale)} · UP ${version.characters[locale]}`,
      date: version.date,
      estimable: estimatePhaseRevenue(version, game.revenueHistory) !== null,
    }));
}

export function defaultVersionRange(options: VersionRangeOption[], count = 4): VersionRange | null {
  const estimable = options.filter((option) => option.estimable);
  const candidates = estimable.length ? estimable : options;
  if (!candidates.length) return null;
  const visible = candidates.slice(-count);
  return { startId: visible[0].id, endId: visible[visible.length - 1].id };
}

export function buildVersionRevenueSeries(
  game: Game,
  versions: VersionDetail[],
  range: VersionRange | null,
  locale: Locale,
) {
  const allVersions = versions
    .filter((version) => version.gameId === game.id)
    .filter((version, index, items) => items.findIndex((item) => item.id === version.id) === index)
    .sort((a, b) => a.date.localeCompare(b.date) || a.phaseIndex - b.phaseIndex);
  const startIndex = range ? allVersions.findIndex((version) => version.id === range.startId) : 0;
  const endIndex = range ? allVersions.findIndex((version) => version.id === range.endId) : allVersions.length - 1;
  const first = Math.max(0, Math.min(startIndex < 0 ? 0 : startIndex, endIndex < 0 ? allVersions.length - 1 : endIndex));
  const last = Math.max(startIndex < 0 ? 0 : startIndex, endIndex < 0 ? allVersions.length - 1 : endIndex);
  const selectedVersions = allVersions.slice(first, last + 1);
  const points = selectedVersions
    .map((version) => ({ version, value: estimatePhaseRevenue(version, game.revenueHistory) }))
    .filter((point): point is { version: VersionDetail; value: number } => point.value !== null);

  return {
    values: points.map((point) => point.value),
    labels: points.map((point) => phaseLabel(point.version, locale)),
    available: allVersions.length,
    selected: selectedVersions.length,
    estimable: points.length,
  };
}
