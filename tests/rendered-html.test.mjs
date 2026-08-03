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
  assert.match(html, /估算流水（亿元人民币）/);
  assert.match(html, /峰值名次/);
  assert.match(html, /最低名次/);
  assert.match(html, /抖音/);
  assert.match(html, /H\[g,v,a\]/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the English URL locale", async () => {
  const response = await render("/en");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /GACHA REVENUE TRACKER/);
  assert.match(html, /Genshin Impact/);
  assert.match(html, /CN¥7\.20B/);
  assert.match(html, /Revenue estimation formulas/);
});
