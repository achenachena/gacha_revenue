import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/zh-CN") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Chinese revenue dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /二游流水观察/);
  assert.doesNotMatch(html, /把二游流水|流水观察局/);
  assert.match(html, /原神/);
  assert.match(html, /明日方舟：终末地/);
  assert.match(html, /月流水来自公开源 · 榜单按小时自动观测/);
  assert.match(html, /2026 年 6 月移动端流水估算/);
  assert.match(html, /\$128\.9M/);
  assert.match(html, /\$28\.5M/);
  assert.match(html, /\$58\.1M/);
  assert.doesNotMatch(html, /\$3\.84 亿|¥3\.84 亿/);
  assert.match(html, /选择版本 \/ 卡池角色/);
  assert.match(html, /卡提希娅/);
  assert.match(html, /爱弥斯/);
  assert.match(html, /异环/);
  assert.match(html, /Hotta Studio \/ Perfect World/);
  assert.match(html, /18 小时/);
  assert.match(html, /15 小时/);
  assert.match(html, /单游戏卡池超应用时间排名/);
  assert.match(html, /峰值名次/);
  assert.match(html, /最低名次/);
  assert.match(html, /抖音/);
  assert.match(html, /H\[g,v,a\]/);
  assert.doesNotMatch(html, /20\.6 小时/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the English URL locale", async () => {
  const response = await render("/en");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /GACHA REVENUE TRACKER/);
  assert.match(html, /Genshin Impact/);
  assert.match(html, /PUBLIC MONTHLY SOURCE · HOURLY APPLE RANKS/);
  assert.match(html, /June 2026 mobile revenue estimates/);
  assert.match(html, /Per-game banner app-line ranking/);
  assert.match(html, /Revenue estimation formulas/);
});
