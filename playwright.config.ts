import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "go run ./cmd/local-api",
      cwd: "backend",
      env: { PROXY_TOKEN: "playwright-local-token-32-bytes-minimum", GOCACHE: "/tmp/gacha-revenue-go-cache" },
      url: "http://127.0.0.1:8080/healthz",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      env: {
        BACKEND_API_BASE_URL: "http://127.0.0.1:8080/v1/",
        BACKEND_PROXY_TOKEN: "playwright-local-token-32-bytes-minimum",
      },
      url: "http://localhost:3000/zh-CN",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 15"] } },
  ],
});
