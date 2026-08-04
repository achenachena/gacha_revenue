# 二游流水观察 / Gacha Revenue Tracker

中英双语的二游移动端流水、独立卡池窗口与 iOS 畅销榜观察站。覆盖原神、崩坏：星穹铁道、绝区零、鸣潮、明日方舟：终末地和异环。网站公开读取，不含登录功能。

## 数据边界

月流水采用 GachaDash / GachaRevenue 发布的 Sensor Tower 移动端估算，底层保留来源的美元百万单位：

```text
月移动端流水 = 海外 iOS + 海外 Android + 中国 iOS × (1 + 1.75)
```

- 仅含移动端 IAP，不含 PC、主机、官网直充、广告、周边或 IP 授权。
- `1.75` 是来源采用的中国 Android / 中国 iOS 假设，不是发行商披露或审计结果。
- 上游不可用时只返回明确标记的最后快照，不插值、不把市场估算写成真实流水。
- 中文页面按 Frankfurter 提供的 ECB 每日 USD/CNY 参考汇率换算为亿元人民币；英文页面保留百万美元。汇率响应缓存 12 小时，并始终返回日期、来源与是否使用缓存快照。
- 首页默认展示当年累计（截至公开源最新月份），游戏默认选中当年累计最高者。公开源尚未发布的月份会明确提示，不用未完整月推算整月值。

版本趋势使用两个下拉栏选择任意起止小版本，默认最近 4 期，也可以扩展到当前日历源提供的全部范围。图表只绘制同时具有卡池窗口和月流水覆盖的期次；当前公开月流水源只提供最近 12 个月，因此“从开服到现在”的完整历史需要同时具备更早的月流水档案和卡池日历，代码不会用均值或虚构值补齐。

应用线时长按小时计算：

```text
H[g,p,a] = Σ 1(rank_game(g,t) < rank_app(a,t)) × 1 hour
```

Apple 公共榜当前只提供 Top 100。若游戏在榜、应用掉出 Top 100，可以确定游戏超过应用；若游戏掉榜、应用在榜，可以确定没有超过；两者都掉榜时该小时记为未知，不伪造精确名次。

## 为什么历史时长会为空

Apple 榜单是实时快照，不提供过去任意小时的回放。本站从 `2026-08-04T02:00:00Z` 开始自动采集，因此更早的卡池只能由具有历史小时榜权限的七麦、Sensor Tower 或其他授权供应商回填。页面会区分：

- `observed`：已有自动小时观测；
- `historical_provider_required`：窗口早于采集启用时间，需要授权历史 feed；
- `pending_collection`：卡池尚未开始；
- `collection_gap`：应当采集但窗口内没有可用快照。

空值不会被当作 `0 小时`。只有在存在可判定观测时，`0` 才表示确实没有超过。

## 自动更新架构

```text
EventBridge Scheduler → Go collector Lambda → DynamoDB 小时快照
授权历史榜 adapter ────────────────────────────────┐
自动卡池日历 adapter ───────────────→ Go API Lambda │
浏览器 → Vercel 同源只读代理 ───────────────────────┘
```

- Apple CN / JP / US / KR 畅销榜每小时第 8 分钟采集一次；采集对象按游戏，不依赖当前卡池日历。
- 卡池 feed 和 Vercel 代理各缓存 1 分钟。新卡池进入 feed 后通常在 2 分钟内自动出现在下拉栏；即使日历稍晚发布，此前已经采集的游戏小时榜仍可按窗口重新聚合。
- 授权历史 feed 只在查询早于本站采集起点的窗口时调用，并与 DynamoDB 实时快照按小时合并。
- 未配置商业供应商时，实时采集仍会继续，但历史数据无法免费回溯。代码不会抓取登录页面、绕过付费权限或把密钥写入仓库。

供应商只需一次性适配成以下规范，之后不需要逐卡池手工更新。完整字段由 Go 类型校验，所有 URL 必须为 HTTPS，响应分别限制为 1 MiB / 2 MiB。

卡池 feed：

```json
{
  "data": [{
    "id": "hsr-44-p1",
    "game_id": "hsr",
    "version": "4.4",
    "phase_index": 1,
    "phase_zh": "上半",
    "phase_en": "Phase 1",
    "characters_zh": "角色 A、角色 B",
    "characters_en": "Character A, Character B",
    "starts_at": "2026-07-15",
    "ends_at": "2026-08-05",
    "source_url": "https://provider.example/source",
    "source_updated_at": "2026-07-15"
  }]
}
```

历史小时榜 feed 接收 `game_id`、`start`、`end` 查询参数（UTC RFC3339），返回与 `rankstore.Snapshot` 相同的小时数组：

```json
{
  "data": [{
    "observed_hour": "2026-04-22T01:00:00Z",
    "markets": {
      "CN": {
        "games": {"hsr": 2},
        "app_lines": {"tencent_video": 4}
      }
    }
  }]
}
```

## 本地开发

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local` 使用两个仅服务端变量，绝不能加 `NEXT_PUBLIC_` 前缀：

```text
BACKEND_API_BASE_URL=https://<function-id>.lambda-url.ap-northeast-1.on.aws/v1
BACKEND_PROXY_TOKEN=<与 AWS Lambda 相同的随机值>
```

验证：

```bash
npm run lint
npm run build
npx playwright test
(cd backend && go test ./... && go vet ./...)
bash -n infra/serverless/deploy.sh
jq empty infra/serverless/*.json
```

## 部署配置

Vercel Production / Preview：

| 名称 | 类型 | 必需 | 说明 |
|---|---|---:|---|
| `BACKEND_API_BASE_URL` | server-only env | 是 | Lambda `/v1` 地址 |
| `BACKEND_PROXY_TOKEN` | sensitive env | 是 | 至少 32 字节；建议 64 个随机十六进制字符，与 GitHub secret 相同 |

GitHub `production` environment：

| 名称 | 类型 | 必需 | 说明 |
|---|---|---:|---|
| `AWS_DEPLOY_ROLE_ARN` | variable | 是 | GitHub OIDC 部署角色 |
| `AWS_REGION` | variable | 是 | 当前为 `ap-northeast-1` |
| `BACKEND_PROXY_TOKEN` | secret | 是 | 写入 Lambda 环境，不输出到日志 |
| `CALENDAR_FEED_URL` | variable | 否 | 标准化自动卡池 feed |
| `CALENDAR_FEED_TOKEN` | secret | 否 | 卡池 feed Bearer token |
| `RANK_HISTORY_FEED_URL` | variable | 否 | 标准化授权历史小时榜 feed |
| `RANK_HISTORY_FEED_TOKEN` | secret | 否 | 历史榜 Bearer token |

浏览器只能访问 Vercel 的 `/api/backend/*` allowlist。Vercel 在服务端添加代理 token；Lambda `/v1/*` 使用恒定时间比较拒绝无 token 请求，`/healthz` 仅返回无敏感信息。生产仓库不保存 AWS access key、供应商 token 或 Vercel token。

AWS 使用两个 ARM64 Lambda、一个 DynamoDB 表和一个 EventBridge Scheduler；不创建 VPC、NAT、ECS、RDS、Redis、ALB、ECR、S3 或 API Gateway。免费计划仍需配置预算告警，并关注 AWS credits 与计划到期时间。

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。
