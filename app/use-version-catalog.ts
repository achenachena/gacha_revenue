"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { loadVersions } from "./api-client";
import type { GameId, VersionDetail } from "./data";

type CatalogByGame = Partial<Record<GameId, VersionDetail[]>>;

export function useVersionCatalog(requestedGames: GameId[]) {
  const requestKey = [...new Set(requestedGames)].sort().join("|");
  const [catalogByGame, setCatalogByGame] = useState<CatalogByGame>({});

  useEffect(() => {
    const gameIds = requestKey ? requestKey.split("|") as GameId[] : [];
    const missing = gameIds.filter((gameId) => !Object.hasOwn(catalogByGame, gameId));
    if (!missing.length) return;

    let active = true;
    Promise.allSettled(missing.map(async (gameId) => ({
      gameId,
      versions: (await loadVersions(gameId)).filter((version) => version.gameId === gameId),
    })))
      .then((results) => {
        if (!active) return;
        const successful = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        for (const result of results) {
          if (result.status === "rejected") console.error("Unable to load version catalog", result.reason);
        }
        if (!successful.length) return;
        startTransition(() => {
          setCatalogByGame((current) => {
            const next = { ...current };
            for (const result of successful) next[result.gameId] = result.versions;
            return next;
          });
        });
      });
    return () => {
      active = false;
    };
  }, [catalogByGame, requestKey]);

  const catalog = useMemo(() => Object.values(catalogByGame).flat(), [catalogByGame]);
  const loadedGames = useMemo(
    () => new Set(Object.keys(catalogByGame) as GameId[]),
    [catalogByGame],
  );

  return { catalog, loadedGames };
}
