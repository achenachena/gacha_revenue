import { expect, test } from "@playwright/test";

test("exposes only the explicit validated backend proxy routes", async ({ request }) => {
  const unconfigured = await request.get("/api/backend/versions");
  expect(unconfigured.status()).toBe(503);
  const invalid = await request.get("/api/backend/banner-metrics?game_id=hsr&start=bad&end=2026-08-05");
  expect(invalid.status()).toBe(400);
  const unknown = await request.get("/api/backend/unknown");
  expect(unknown.status()).toBe(404);
});

test("switches revenue grain and locale", async ({ page }) => {
  await page.goto("/zh-CN");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("heading", { name: "2026 年 6 月移动端流水估算" })).toBeVisible();
  await expect(page.getByText("$128.9M")).toBeVisible();
  await expect(page.getByText("$28.5M").first()).toBeVisible();
  await expect(page.getByText("$58.1M").first()).toBeVisible();
  await page.getByRole("button", { name: "按年" }).click();
  await expect(page.getByText("2025", { exact: true })).toBeVisible();
  await expect(page.getByText("2026 YTD").first()).toBeVisible();
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: "June 2026 mobile revenue estimates" })).toBeVisible();
});

test("compares games and opens version intelligence", async ({ page }) => {
  await page.goto("/zh-CN");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("选择游戏").selectOption("hsr");
  await page.getByLabel("选择版本 / 卡池角色").selectOption("hsr-32-anaxa");
  await expect(page.getByText("UP · 那刻夏")).toBeVisible();
  const douyinRow = page.getByRole("row").filter({ hasText: "抖音" });
  await expect(douyinRow).toContainText("未超过");
  await expect(douyinRow).toContainText("0 小时");
  await expect(page.getByText("20.6 小时")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "峰值名次" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "最低名次" })).toBeVisible();
  await page.getByLabel("排名游戏").selectOption("wuwa");
  await page.getByLabel("比较应用线").selectOption("tencent_video");
  const rankingRows = page.locator(".banner-ranking-table tbody tr");
  await expect(rankingRows.nth(0)).toContainText("2.4 · 上半 · UP 卡提希娅");
  await expect(rankingRows.nth(0)).toContainText("18 小时");
  await expect(rankingRows.nth(1)).toContainText("3.1 · 上半 · UP 爱弥斯");
  await expect(rankingRows.nth(1)).toContainText("15 小时");
});

test("adds a provider banner to the automatic per-game ranking", async ({ page }) => {
  await page.route("**/api/backend/public-revenue", (route) =>
    route.fulfill({ json: { data: [], meta: { fetched_at: "2026-08-03T12:00:00Z" } } }),
  );
  await page.route("**/api/backend/versions", (route) =>
    route.fulfill({
      json: {
        data: [{
          id: "wuwa-provider-p1",
          game_id: "wuwa",
          version: "3.6",
          phase_index: 1,
          phase_zh: "上半",
          phase_en: "Phase 1",
          characters_zh: "自动卡池角色",
          characters_en: "Automatic banner character",
          starts_at: "2026-08-01",
          ends_at: "2026-08-22",
          estimate: null,
          p25: null,
          p75: null,
          confidence: "N/A",
          data_status: "public_calendar",
          source_url: "https://example.com/calendar",
          source_updated_at: "2026-08-03",
          ios_grossing_rank_range: { CN: [null, null], JP: [null, null], US: [null, null], KR: [null, null] },
          app_line_observations: [{
            app_id: "tencent_video",
            name_zh: "腾讯视频",
            name_en: "Tencent Video",
            hours_above: null,
            data_status: "awaiting_feed",
            updated_at: null,
          }],
        }],
        meta: { calendar_provider: "connected" },
      },
    }),
  );
  await page.route("**/api/backend/banner-metrics?*", (route) => {
    const providerWindow = new URL(route.request().url()).searchParams.get("start") === "2026-08-01";
    route.fulfill({
      json: {
        data: {
          ranks: {},
          app_line_observations: [{
            app_id: "tencent_video",
            hours_above: providerWindow ? 22 : 0,
            observed_hours: providerWindow ? 48 : 0,
            updated_at: providerWindow ? "2026-08-03T11:00:00Z" : null,
          }],
          source: "apple_public_feed",
          coverage_status: providerWindow ? "observed" : "historical_provider_required",
          collection_started_at: "2026-08-01T00:00:00Z",
          phase_revenue: null,
        },
      },
    });
  });

  await page.goto("/zh-CN");
  const firstRankingRow = page.locator(".banner-ranking-table tbody tr").first();
  await expect(firstRankingRow).toContainText("3.6 · 上半 · UP 自动卡池角色");
  await expect(firstRankingRow).toContainText("22 小时");
  await expect(firstRankingRow).toContainText("Apple 畅销榜 RSS 自动观测");
});
