import { expect, test } from "@playwright/test";

test("switches revenue grain and locale", async ({ page }) => {
  await page.goto("/zh-CN");
  await expect(page.getByRole("heading", { name: "2026 年 7 月流水估算" })).toBeVisible();
  await expect(page.getByText("估算流水（亿元人民币）").first()).toBeVisible();
  await expect(page.locator("polyline.chart-line")).toBeVisible();
  await page.getByRole("button", { name: "按年" }).click();
  await expect(page.getByText("2022", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "EN" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: "July 2026 revenue estimates" })).toBeVisible();
});

test("compares games and opens version intelligence", async ({ page }) => {
  await page.goto("/zh-CN");
  await page.getByRole("button", { name: /明日方舟：终末地/ }).nth(1).click();
  await expect(page.getByText("5 已选择")).toBeVisible();
  await page.getByLabel("全部游戏").selectOption("wuwa");
  await page.getByRole("option", { name: /鸣潮 2.4/ }).click();
  await expect(page.getByText("卡提希娅 · 露帕").last()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "峰值名次" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "最低名次" })).toBeVisible();
  await expect(page.getByText("抖音", { exact: true })).toBeVisible();
  await expect(page.getByText("夸克网盘", { exact: true })).toBeVisible();
});
