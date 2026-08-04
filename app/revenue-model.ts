import type { Game, GameId, Locale, MarketCoverage, RevenueMonth, VersionDetail } from "./data";

export type RevenuePeriod = Pick<RevenueMonth, "year" | "month">;
export type VersionRange = { startId: string; endId: string };

export type VersionRangeOption = {
  id: string;
  label: string;
  date: string;
  estimable: boolean;
};

export type RevenueSeries = {
  values: Array<number | null>;
  labels: string[];
  marketCoverage: Array<MarketCoverage | null>;
  available: number;
  covered: number;
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

function phaseLabel(version: VersionDetail, locale: Locale) {
  const phase = version.phaseIndex === 1
    ? locale === "zh-CN" ? "上" : "P1"
    : version.phaseIndex === 2
      ? locale === "zh-CN" ? "下" : "P2"
      : locale === "zh-CN" ? `第${version.phaseIndex}期` : `P${version.phaseIndex}`;
  return `${version.version}${phase}`;
}

function versionOrder(version: VersionDetail) {
  const [major = 0, minor = 0] = version.version.split(".").map(Number);
  return major * 10_000 + minor * 100 + version.phaseIndex;
}

export function sortVersions(a: VersionDetail, b: VersionDetail) {
  return versionOrder(a) - versionOrder(b) || a.id.localeCompare(b.id);
}

export function versionPhaseKey(version: Pick<VersionDetail, "gameId" | "version" | "phaseIndex">) {
  return `${version.gameId}:${version.version}:${version.phaseIndex}`;
}

export function buildMonthlyRevenueSeries(
  game: Game,
  latest: RevenuePeriod,
): RevenueSeries {
  const [launchYear, launchMonth] = game.launchDate.split("-").map(Number);
  if (!Number.isInteger(launchYear) || !Number.isInteger(launchMonth) || launchYear < 2010 || launchMonth < 1 || launchMonth > 12) {
    return { values: [], labels: [], marketCoverage: [], available: 0, covered: 0 };
  }
  const history = new Map(game.revenueHistory.map((item) => [`${item.year}-${item.month}`, item]));
  const values: Array<number | null> = [];
  const labels: string[] = [];
  const marketCoverage: Array<MarketCoverage | null> = [];
  for (let year = launchYear, month = launchMonth; year < latest.year || year === latest.year && month <= latest.month;) {
    const point = history.get(`${year}-${month}`);
    values.push(point?.value ?? null);
    marketCoverage.push(point?.marketCoverage ?? null);
    labels.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month === 13) {
      year++;
      month = 1;
    }
  }
  return { values, labels, marketCoverage, available: values.length, covered: values.filter((value) => value !== null).length };
}

export function buildYearlyRevenueSeries(
  game: Game,
  latest: RevenuePeriod,
  locale: Locale,
): RevenueSeries {
  const launchYear = Number(game.launchDate.slice(0, 4));
  if (!Number.isInteger(launchYear) || launchYear < 2010) {
    return { values: [], labels: [], marketCoverage: [], available: 0, covered: 0 };
  }
  const yearly = new Map(game.yearly.map((item) => [item.year, item]));
  const values: Array<number | null> = [];
  const labels: string[] = [];
  const marketCoverage: Array<MarketCoverage | null> = [];
  for (let year = launchYear; year <= latest.year; year++) {
    const summary = yearly.get(year);
    values.push(summary?.value ?? null);
    marketCoverage.push(summary?.marketCoverage ?? null);
    const partial = summary !== undefined && !summary.complete;
    labels.push(
      partial
        ? locale === "zh-CN"
          ? year === latest.year && latest.month < 12
            ? `${year}（截至${latest.month}月）`
            : `${year}（部分）`
          : year === latest.year && latest.month < 12
            ? `${year} YTD`
            : `${year} partial`
        : `${year}`,
    );
  }
  return { values, labels, marketCoverage, available: values.length, covered: values.filter((value) => value !== null).length };
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
    .sort(sortVersions)
    .map((version) => ({
      id: version.id,
      label: `${phaseLabel(version, locale)} · UP ${version.characters[locale]}`,
      date: version.date,
      estimable: version.revenue !== null,
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
    .filter((version, index, items) => items.findIndex((item) => versionPhaseKey(item) === versionPhaseKey(version)) === index)
    .sort(sortVersions);
  const startIndex = range ? allVersions.findIndex((version) => version.id === range.startId) : 0;
  const endIndex = range ? allVersions.findIndex((version) => version.id === range.endId) : allVersions.length - 1;
  const first = Math.max(0, Math.min(startIndex < 0 ? 0 : startIndex, endIndex < 0 ? allVersions.length - 1 : endIndex));
  const last = Math.max(startIndex < 0 ? 0 : startIndex, endIndex < 0 ? allVersions.length - 1 : endIndex);
  const selectedVersions = allVersions.slice(first, last + 1);
  const points = selectedVersions.map((version) => ({ version, value: version.revenue }));

  return {
    values: points.map((point) => point.value),
    labels: points.map((point) => phaseLabel(point.version, locale)),
    marketCoverage: points.map((point) => point.value === null ? null : point.version.revenueMarketCoverage),
    available: allVersions.length,
    selected: selectedVersions.length,
    estimable: points.filter((point) => point.value !== null).length,
  };
}
