# 二游流水观察 / Gacha Revenue Tracker

中英双语的二游移动端流水、版本卡池与 iOS 畅销榜观察站。当前覆盖原神、崩坏：星穹铁道、绝区零、鸣潮、明日方舟：终末地和异环（Neverness to Everness）。公开站点无需登录。

## 数据口径

月流水直接使用 [GachaDash](https://www.gachadash.com/revenue) / GachaRevenue 发布的 Sensor Tower 汇总估算，保留来源的美元百万单位：

```text
月移动端流水 = 海外 iOS + 海外 Android + 中国 iOS × (1 + 1.75)
```

- 仅含移动端 IAP，不含 PC、主机、官网直充、广告、周边或 IP 授权。
- `1.75` 是 GachaRevenue 对中国 Android / 中国 iOS 的默认假设，不是审计值。
- 前端通过 `/api/public-revenue` 自动检查每个游戏公开的 12 个月历史；失败时使用仓库内同来源、带日期的快照，不生成插值或假数据。
- 第三方估算无法保证等于发行商真实收入。项目保证来源、口径和计算可追溯，不把市场估算称为审计收入。

卡池流水在小时榜单覆盖达到 80% 后才计算：

```text
小时权重 W(h) = Σ market_weight × rank(h)^-0.85
卡池流水 R(phase) = Σ month_revenue × W(phase ∩ month) / W(month)
```

每个月单独归属，跨月不重复计算；覆盖不足时返回 `null`，不会把月流水平均摊给上下半。

## iOS 榜单自动观测

Cloudflare Worker 每小时读取 Apple 公开 Top Grossing RSS（CN / JP / US / KR，Top 200），写入 D1：

- 游戏在卡池窗口内的峰值名次与最低名次。
- 中国区游戏对抖音、腾讯视频、QQ 音乐、剪映、网易云音乐、百度网盘、夸克的累计超越小时数。
- 同一小时内的游戏与应用线榜位直接比较：`rank_game < rank_app` 时累计一小时。
- App 不在 Top 200 时以“超出 feed 范围”保存，界面不伪造精确名次。

`.github/workflows/hourly-rank-ingestion.yml` 每小时触发幂等采集；Worker 也提供 `scheduled` handler。无需每次新卡池人工填数据。Apple RSS 只能从采集启用时开始积累，历史小时榜需使用七麦或 Sensor Tower 的授权历史 API 回填；现有 Go worker 已保留授权 feed 摄取链路。

## 卡池目录

`app/data.ts` 按具体阶段保存卡池日历和来源 URL：

- 原神、崩铁、绝区零、鸣潮、异环按上半 / 下半分开。
- 终末地保留实际节奏；1.0 是三期，不强行改成两个半版本。
- 同阶段的首发、复刻角色合并显示，但榜单观察窗口不跨阶段。
- 异环正确映射为 Hotta Studio / 完美世界的 Neverness to Everness，不是网易 ANANTA。

## 本地运行与验证

```bash
npm install
npm run dev
```

完整验证：

```bash
npm run lint
npm test
(cd backend && go test ./...)
npx playwright test
```

生产构建由 vinext 输出 Cloudflare Worker ESM。D1 逻辑绑定为 `DB`，Drizzle 迁移位于 `drizzle/`。

## AWS / 授权数据架构

仓库仍包含原需求的 Go REST API、PostgreSQL、Redis、SQS、EventBridge、S3、ECS Fargate、Terraform、OpenTelemetry 和 Cognito/RBAC 基础设施。公开读取无需登录；编辑和管理 API 才使用 JWT 角色。

授权排名 feed 的生产链路：

```text
EventBridge → SQS → Go ingestion worker → S3 raw archive
                                  ↘ PostgreSQL observations → aggregates → API
```

供应商令牌必须保存在 Secrets Manager，不能放进前端包或日志。Sensor Tower / 七麦的历史小时数据与日级收入能用于回填，但两者都需要商业授权；项目不绕过登录、会员或导出限制。
