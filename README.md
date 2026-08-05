# Gacha Revenue Tracker

A bilingual, read-only dashboard for estimated mobile revenue, version/banner windows, and iOS grossing-rank observations. It currently covers Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Wuthering Waves, Arknights: Endfield, and Neverness to Everness. The public site has no sign-in flow.

## What the data means

Canonical revenue values are stored as USD millions. The published monthly estimate is:

```text
monthly mobile revenue = non-China iOS + non-China Android + China iOS × (1 + 1.75)
```

- Revenue covers mobile IAP only. It excludes PC, console, direct-store payments, advertising, merchandise, and licensing.
- `1.75` is the upstream model's China Android / China iOS assumption, not publisher-reported or audited revenue.
- Chinese pages convert canonical USD values to CNY with the ECB reference rate exposed by Frankfurter. English pages display USD.
- Missing months remain null. The application does not interpolate them or distribute lifetime milestones across months.
- Version estimates are computed by the Go backend from exact banner/month overlap:

```text
phase revenue = Σ(month revenue × phase/month overlap hours ÷ hours in month)
```

GACHAREVENUE and GachaDash republish third-party Sensor Tower estimates. Those estimates may be revised and should not be presented as publisher revenue. See the [GACHAREVENUE methodology](https://revenue.ennead.cc/revenue) and [changelog](https://revenue.ennead.cc/changelog).

### Historical coverage

The Go service embeds a versioned revenue snapshot and merges newer validated source months by `(game, year, month)`.

- Complete-market monthly estimates start in January 2024 for Genshin Impact and Honkai: Star Rail.
- Zenless Zone Zero, Wuthering Waves, Arknights: Endfield, and Neverness to Everness have complete-market estimates from launch.
- An archived public GACHAREVENUE dataset adds Genshin Impact from December 2022 and Honkai: Star Rail from launch in April 2023. These older points cover global mobile excluding China because the archived China rows are empty. They are explicitly tagged `partial` and `global_mobile_excluding_china` throughout the Go API.
- No reliable month-by-month source is currently available for earlier Genshin Impact months. Those periods remain empty even when a lifetime milestone is known.

The chart breaks the line when coverage scope changes and renders partial-market history as a dashed gray series. Annual and banner aggregates inherit `complete`, `partial`, or `mixed` coverage metadata so unlike scopes cannot be silently combined.

The embedded banner catalog contains localized phase dates and character names for Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, and Wuthering Waves from the public [BannerHistory calendar](https://bannerhistory.app/en/schedule). Provider updates enrich matching `(game, version, phase)` entries while owner-verified rank evidence remains authoritative.

## Rank observations

App-line time is calculated hourly:

```text
hours_above(game, phase, app) = Σ 1(game_rank < app_rank) × one hour
```

Every stored snapshot carries its actual visible depth, while exact stored ranks are capped to 1–200. Apple's public feed currently returns only 100 rows even when 200 are requested, so a miss in that source is reported as `Outside Top 100`. A normalized authorized feed may supply complete Top 200 observations; ranks 1–200 are then retained exactly and a miss is displayed as `Outside Top 200`. The application never promotes a Top 100 miss to Top 200 or stores an exact rank greater than 200.

The collector calculates new observations automatically, but pre-collection windows require an authorized historical provider or separately sourced published evidence. Unknown values remain null and are never represented as zero. Published historical summaries store source links and retain unknown full-window lowest ranks as null.

## Architecture

```text
EventBridge Scheduler ──> Go collector Lambda ──> DynamoDB snapshots
                                                    │
Browser ──> Vercel Next.js proxy ──> Go API Lambda ─┘
```

Responsibilities are intentionally separated:

- `backend/internal/revenue`: canonical revenue facts, validation, monthly merging, YTD, annual aggregation, coverage propagation, and version allocation.
- `backend/internal/revenuesource`: public-source retrieval and validation.
- `backend/internal/revenuestore`: DynamoDB persistence.
- `backend/internal/versioncatalog`: embedded phase catalog and provider enrichment rules.
- `backend/internal/bannerstats`: feed-depth-aware peak/lowest-rank and app-line aggregation shared by every API path.
- `backend/internal/httpapi`: public REST response composition.
- `app/api-client.ts`: DTO-to-view-model normalization only.
- `app/revenue-model.ts`: labels, range selection, and null-preserving chart projection only; it does not calculate revenue.
- `app/dashboard.tsx`: interaction and visualization.

The browser requests one server-aggregated ranking payload per selected game instead of issuing one request per banner. Large version and ranking sections load only when they approach the viewport; canonical facts and aggregation rules remain in Go.

External calendar and licensed rank providers use normalized adapters. Secrets are server-only environment variables and are never committed.

## Local development

Requirements: Node.js 22.13 or newer and a current Go toolchain.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Server-only frontend variables:

```text
BACKEND_API_BASE_URL=https://<function-id>.lambda-url.<region>.on.aws/v1
BACKEND_PROXY_TOKEN=<same random value configured on the Lambda>
```

Run all checks:

```bash
npm run lint
npm run build
npx playwright test
(cd backend && go test ./... && go vet ./...)
bash -n infra/serverless/deploy.sh
jq empty infra/serverless/*.json
```

## Deployment

The frontend is deployed to Vercel. The zero-idle-cost AWS profile uses two ARM64 Lambda functions, one DynamoDB table, and EventBridge Scheduler; it does not create ECS, RDS, Redis, NAT Gateway, ALB, ECR, or API Gateway resources.

Vercel variables:

| Name | Required | Notes |
|---|---:|---|
| `BACKEND_API_BASE_URL` | yes | Go API `/v1` base URL |
| `BACKEND_PROXY_TOKEN` | yes | Sensitive, server-only value; at least 32 random bytes |

GitHub `production` environment:

| Name | Kind | Required | Notes |
|---|---|---:|---|
| `AWS_DEPLOY_ROLE_ARN` | variable | yes | GitHub OIDC deployment role |
| `AWS_REGION` | variable | yes | AWS deployment region |
| `BACKEND_PROXY_TOKEN` | secret | yes | Shared with the Lambda environment |
| `CALENDAR_FEED_URL` | variable | no | Normalized automatic calendar provider |
| `CALENDAR_FEED_TOKEN` | secret | no | Calendar provider bearer token |
| `RANK_HISTORY_FEED_URL` | variable | no | Authorized normalized hourly-rank provider; may supply current and historical Top 200 snapshots |
| `RANK_HISTORY_FEED_TOKEN` | secret | no | Rank provider bearer token |

The browser can access only an explicit Vercel proxy allowlist. Vercel attaches the proxy token server-side; the Lambda compares it in constant time. The public repository must not contain AWS access keys, provider tokens, Vercel tokens, or local environment files.

Report security issues privately as described in [SECURITY.md](SECURITY.md).
