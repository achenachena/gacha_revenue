import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Hourly snapshots from Apple's public Top Grossing RSS feeds. A null rank
// means that the app was outside the feed's Top 200 at that hour.
export const iosRankObservations = sqliteTable(
  "ios_rank_observations",
  {
    subjectKey: text("subject_key").notNull(),
    market: text("market").notNull(),
    observedAt: text("observed_at").notNull(),
    rank: integer("rank"),
    sourceUrl: text("source_url").notNull(),
    sourceStatus: integer("source_status").notNull(),
    capturedAt: text("captured_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.subjectKey, table.market, table.observedAt] })],
);
