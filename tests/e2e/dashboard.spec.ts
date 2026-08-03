import { expect, test } from "@playwright/test";

test("switches revenue grain and locale", async ({ page }) => {
  await page.goto("/zh-CN");
  await expect(page.getByRole("heading", { name: "把二游流水，放在同一把尺子上。" })).toBeVisible();
  await page.getByRole("button", { name: "按年" }).click();
  await expect(page.getByText("2022", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "EN" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: "One yardstick for gacha revenue." })).toBeVisible();
});

test("compares games and opens version intelligence", async ({ page }) => {
  await page.goto("/zh-CN");
  await page.getByRole("button", { name: /明日方舟：终末地/ }).nth(1).click();
  await expect(page.getByText("5 已选择")).toBeVisible();
  await page.getByRole("button", { name: /鸣潮 2.4/ }).click();
  await expect(page.getByText("卡提希娅 · 露帕").last()).toBeVisible();
  await expect(page.getByText("抖音", { exact: true })).toBeVisible();
});

