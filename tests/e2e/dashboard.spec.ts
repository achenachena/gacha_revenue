import { expect, test } from "@playwright/test";

test("exposes only the explicit validated backend proxy routes", async ({ request }) => {
  const unconfigured = await request.get("/api/backend/versions");
  expect(unconfigured.status()).toBe(503);
  const exchangeRate = await request.get("/api/backend/exchange-rate");
  expect(exchangeRate.status()).toBe(503);
  const invalidExchangeRate = await request.get("/api/backend/exchange-rate?base=EUR");
  expect(invalidExchangeRate.status()).toBe(400);
  const invalid = await request.get("/api/backend/banner-metrics?game_id=hsr&start=bad&end=2026-08-05");
  expect(invalid.status()).toBe(400);
  const unknown = await request.get("/api/backend/unknown");
  expect(unknown.status()).toBe(404);
});

test("switches revenue grain and locale", async ({ page }) => {
  await page.goto("/zh-CN");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("heading", { name: "2026 年累计移动端流水估算（截至 6 月）" })).toBeVisible();
  await expect(page.getByText("¥57.50亿")).toBeVisible();
  await expect(page.getByText(/2026 年 7 月公开源尚未发布/)).toBeVisible();
  const activeCard = page.locator(".game-card[aria-pressed='true']");
  await expect(activeCard).toContainText("原神");
  await expect(activeCard).toContainText("¥18.67亿");
  await expect(page.locator(".game-card").filter({ hasText: "异环" })).toContainText("¥2.99亿");

  await page.locator(".game-card").filter({ hasText: "崩坏：星穹铁道" }).click();
  await expect(page.getByText("¥12.57亿").first()).toBeVisible();
  await expect(page.getByText("3.92", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".line-chart text").filter({ hasText: "2024-01" })).toHaveCount(1);
  await expect(page.getByText("6.99", { exact: true }).first()).toBeAttached();
  await page.getByRole("button", { name: "按年" }).click();
  await expect(page.getByText("2024", { exact: true })).toBeAttached();
  await expect(page.getByText("2025", { exact: true })).toBeAttached();
  await expect(page.getByText("2026（截至6月）", { exact: true })).toBeAttached();
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: "2026 YTD mobile revenue estimates (through June)" })).toBeVisible();
  await expect(page.locator(".game-card[aria-pressed='true']")).toContainText("$276.5M");
});

test("keeps overview text clear and lets users expand phase history", async ({ page }) => {
  await page.goto("/zh-CN");
  const activeCard = page.locator(".game-card[aria-pressed='true']");
  const cardFoot = activeCard.locator(".card-foot");
  const miniTrend = activeCard.locator(".mini-trend");
  const [footBox, trendBox] = await Promise.all([cardFoot.boundingBox(), miniTrend.boundingBox()]);
  expect(footBox).not.toBeNull();
  expect(trendBox).not.toBeNull();
  expect((footBox?.y ?? 0) + (footBox?.height ?? 0)).toBeLessThanOrEqual(trendBox?.y ?? 0);

  await expect(page.locator(".line-chart text").filter({ hasText: "2020-09" })).toHaveCount(1);
  await expect(page.locator(".line-chart text").filter({ hasText: "2026-06" })).toHaveCount(1);
  const chart = page.locator("#trend .line-chart");
  await page.locator("#trend").getByRole("button", { name: "查看开服" }).click();
  await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBe(0);
  await page.locator("#trend").getByRole("button", { name: "查看最新" }).click();
  await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "按版本" }).click();
  const headingBox = await page.locator("#trend .panel-heading").boundingBox();
  const filterBox = await page.locator("#trend .trend-filter-bar").boundingBox();
  expect(headingBox).not.toBeNull();
  expect(filterBox).not.toBeNull();
  expect(filterBox?.y ?? 0).toBeGreaterThanOrEqual((headingBox?.y ?? 0) + (headingBox?.height ?? 0));
  const start = page.getByLabel("起始小版本");
  const end = page.getByLabel("结束小版本");
  await expect(start).toHaveValue("gi-65-p1");
  await expect(end).toHaveValue("gi-66-p2");
  await expect(page.getByTestId("trend-point")).toHaveCount(4);
  await expect(page.getByText("6.5上", { exact: true })).toBeVisible();
  await expect(page.getByText("6.6下", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "选择开服至今" }).click();
  await expect(start).toHaveValue("catalog-genshin-10-p1");
  await expect(end).toHaveValue("gi-67-p2");
  await expect(page.getByText(/已选 102 个小版本，其中 \d+ 个有月流水覆盖/)).toBeVisible();
  await expect(page.locator(".line-chart text").filter({ hasText: "1.0上" })).toHaveCount(1);
  await expect(page.locator(".line-chart text").filter({ hasText: "6.7下" })).toHaveCount(1);
});

test("compares games and opens version intelligence", async ({ page }) => {
  await page.goto("/zh-CN");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  const bannerSelect = page.getByLabel("选择版本 / 卡池角色");
  await page.getByLabel("选择游戏").selectOption("endfield");
  await bannerSelect.selectOption("ef-10-p1");
  await expect(page.getByText("UP · 莱万汀")).toBeVisible();
  await expect(bannerSelect.locator("option")).toHaveCount(11);
  const allOptionText = await bannerSelect.locator("option").allTextContents();
  expect(allOptionText.join(" ")).not.toMatch(/那刻夏|Anaxa|Laevatain/);
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
