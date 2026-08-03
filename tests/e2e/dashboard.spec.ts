import { expect, test } from "@playwright/test";

test("switches revenue grain and locale", async ({ page }) => {
  await page.goto("/zh-CN");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("heading", { name: "2026 年 7 月流水估算" })).toBeVisible();
  await expect(page.getByText("¥10.29 亿")).toBeVisible();
  await expect(page.getByText("¥2.36 亿").first()).toBeVisible();
  await page.getByRole("button", { name: "按年" }).click();
  await expect(page.getByText("2022", { exact: true })).toBeVisible();
  await expect(page.getByText("2026 YTD").first()).toBeVisible();
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: "July 2026 revenue estimates" })).toBeVisible();
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
  await expect(rankingRows.nth(0)).toContainText("2.4 · UP 卡提希娅");
  await expect(rankingRows.nth(0)).toContainText("18 小时");
  await expect(rankingRows.nth(1)).toContainText("3.1 · UP 爱弥斯");
  await expect(rankingRows.nth(1)).toContainText("15 小时");
});
