# 二游流水观察 / Gacha Revenue Tracker

面向二游市场研究的中英双语流水估算与对比产品。当前覆盖原神、崩坏：星穹铁道、绝区零、鸣潮、明日方舟：终末地与异环。

> 前端内置 2026 年 7 月全平台毛流水模型快照，用于恢复月度、年度、版本趋势与对比；所有金额均明确标记为模型估算，并提供 P25–P75 区间，不能视为发行商实收。榜单与超应用时长采用更严格边界：没有逐小时观测依据的字段返回 `null` 并显示“待接入”。本地 fallback 仅保留产品方明确校正的三条应用线观测，并标记为 `verified_manual`。

## 已实现

- `/zh-CN` 与 `/en` URL 级本地化。
- 年度、月度、版本三个颗粒度的单游戏趋势。
- 2–6 款游戏多选比较与 YTD 份额。
- 游戏与“版本 / 具体卡池角色”双下拉选择。
- 版本/角色估算、CN/JP/US/KR iOS 畅销榜峰值和区间；缺失数据不会被当成 0。
- 抖音、腾讯视频、QQ 音乐、剪映、网易云音乐、百度网盘、夸克网盘七条中国区 iOS 应用线的超越时长。
- 每个游戏可按任一应用线查看所有已核验卡池的超越时长排名。
- 明示第三方估算、毛流水口径、排除项、置信度与模型版本。
- Go REST API、OpenAPI 3.1、Cognito RS256 JWT 验证与 viewer/editor/admin 权限。
- PostgreSQL 版本化迁移、S3/SQS worker 入口、Redis/RDS/ECS/Cognito 等 Terraform 资源。
- Docker Compose、GitHub Actions、Go 测试、Playwright 与 k6 测试骨架。

## 估算口径

默认展示人民币、平台抽成前的全平台毛流水中位估算：

```text
全平台毛流水 = 商店端 IAP 基线 × 地区校正 × 平台补全 × 日汇率加权
```

1. 海外 iOS / Google Play：对授权 Sensor Tower 与 AppMagic IAP 毛收入估算做稳健加权；中国区商店基线只使用 iOS。
2. 中国 Android、PC、主机、官网直充：按游戏、地区、月份维护系数，并以发行商公开信息和历史区间校准。
3. 跨月版本：按卡池开放小时归属收入，不重复计入版本。
4. 同时保留 P25、P50、P75；A/B 置信度来自数据源离散度、平台覆盖和延迟。
5. 不包含广告、电商周边与 IP 授权收入。

Sensor Tower 官方说明其产品通过专有模型与样本估算下载、收入和使用趋势；AppMagic 的公开方法说明收入估算来自各国畅销榜位置，且中国收入仅覆盖 App Store。生产实现必须遵守两家供应商的许可与导出限制，S3 原始对象不得公开。

## 本地运行

只运行前端：

```bash
npm install
npm run dev
```

完整本地依赖：

```bash
docker compose up --build
```

主要地址：前端 `http://localhost:3000/zh-CN`，API `http://localhost:8080/v1`，健康检查 `http://localhost:8080/healthz`。

## 验证

```bash
npm run build
npm test
npm run lint
(cd backend && go test ./...)
npx playwright test
k6 run tests/load/api.js
```

## 目录

```text
app/                    Next.js / React 前端
backend/cmd/api/        Go REST API
backend/cmd/worker/     Go 摄取与聚合 worker 入口
backend/openapi/        OpenAPI 3.1 契约
backend/migrations/     PostgreSQL 迁移
infra/terraform/        AWS 生产基础设施
tests/e2e/              Playwright 浏览器测试
tests/load/             k6 API 压测
```

## 生产数据流

```text
EventBridge（排名每小时、流水每日）→ SQS → ingestion worker → S3 raw archive
                           ↓
                    PostgreSQL observations
                           ↓
                versioned aggregation model
                           ↓
                  estimates + Redis cache → Go API → Next.js
```

排名 worker 只接受授权 feed 的标准 JSON，先按 SHA-256 将原始响应归档到 S3，再幂等写入 PostgreSQL。游戏与应用线必须在同一 UTC 小时都有观测，该小时才进入比较；缺一侧数据时是“未知”，不会被算成 0 小时。每次写入后并发刷新卡池峰值/最低值和应用线物化视图。连续失败五次进入 DLQ。

授权排名 feed 的响应格式：

```json
{
  "banners": [
    {
      "game_id": "wuwa",
      "version": "3.1",
      "phase_zh": "爱弥斯卡池",
      "phase_en": "Aemeath banner",
      "character_zh": "爱弥斯",
      "character_en": "Aemeath",
      "starts_at": "2026-02-05T02:00:00Z",
      "ends_at": "2026-02-26T02:00:00Z"
    }
  ],
  "records": [
    {
      "subject_type": "game",
      "subject_id": "wuwa",
      "market": "CN",
      "observed_at": "2026-08-03T12:00:00Z",
      "grossing_rank": 3,
      "record_id": "provider-record-id"
    }
  ]
}
```

生产环境需在 Secrets Manager 的 application JSON secret 中设置：

- `DATABASE_URL`
- `REDIS_URL`
- `AUTHORIZED_RANK_FEED_URL`
- `AUTHORIZED_RANK_FEED_TOKEN`

前端设置 `NEXT_PUBLIC_API_BASE_URL` 后会自动读取 Go API 的最新版本/卡池观测；未设置时展示模型流水快照和明确标注的本地榜单校正。授权流水 feed 接入后，应以同结构的数据库聚合结果覆盖模型快照。

## 上线前清单

- 配置 Sensor Tower / AppMagic 与逐小时排名 feed 的授权凭据，不在前端包或日志中放供应商密钥。
- 为中国 Android / PC / 主机系数完成至少 6 个月回测并记录置信区间。
- 将 Terraform 中的示例 Cognito 回调域名换为正式域名，并在入口层接入 ALB / CloudFront / WAF。
- 通过 Secrets Manager 注入数据库与供应商令牌；Parameter Store 只放非敏感配置。
- 为原始授权数据设置许可要求对应的 S3 生命周期与访问审计。
- 在生产发布前让数据供应商审核展示粒度与再分发条款。
