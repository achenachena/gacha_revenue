# 二游流水观察 / Gacha Revenue Tracker

中英双语的二游移动端流水、上下半卡池与 iOS 畅销榜观察站。覆盖原神、崩坏：星穹铁道、绝区零、鸣潮、明日方舟：终末地和异环（Neverness to Everness）。网站与 API 都是公开读取，不包含登录功能。

## 数据口径

月流水直接使用 [GachaDash](https://www.gachadash.com/revenue) / GachaRevenue 发布的 Sensor Tower 汇总估算，保留来源的美元百万单位：

```text
月移动端流水 = 海外 iOS + 海外 Android + 中国 iOS × (1 + 1.75)
```

- 仅含移动端 IAP，不含 PC、主机、官网直充、广告、周边或 IP 授权。
- `1.75` 是公开源使用的中国 Android / 中国 iOS 默认假设，不是审计值。
- Go API 每六小时检查六个游戏的公开月度序列；来源临时不可用时明确标记 `fallback_snapshot=true`，不会生成插值。
- 第三方估算无法等同发行商真实收入。本站保证来源、口径与计算可追溯，不把市场估算称为审计收入。

卡池流水只在小时榜单覆盖达到 80% 后计算：

```text
小时权重 W(h) = Σ market_weight × rank(h)^-0.85
卡池流水 R(phase) = Σ month_revenue × W(phase ∩ month) / W(month)
```

每个月单独归属，跨月不重复计算；覆盖不足返回 `null`，不会把月流水平均摊给上下半。

## 自动榜单观测

生产链路为：

```text
EventBridge Scheduler → Go collector Lambda → DynamoDB 小时快照
Vercel Next.js 前端 ──→ Go API Lambda Function URL ────────────↗
```

Go collector Lambda 每小时读取 Apple 公开 Top Grossing RSS（CN / JP / US / KR；接口当前返回 Top 100），记录：

- 每个独立上半 / 下半窗口的四区峰值与最低可见名次；
- 中国区游戏超过抖音、腾讯视频、QQ 音乐、剪映、网易云音乐、百度网盘、夸克的小时数；
- 同一小时 `rank_game < rank_app` 时累计一小时；不在 Top 100 可见范围时不伪造精确名次。

Apple 公共 feed 只能从采集启用时开始积累，也不提供卡池日历。历史回填与未来卡池自动建档仍需合法购买的七麦、Sensor Tower 或其他授权 feed；免费 AWS 服务本身不能免费获得这些商业数据。当前卡池日历来自仓库中的公开日历快照，小时榜单从部署成功后自动积累。

## 本地运行

```bash
npm ci
npm run dev
```

后端依赖由 Docker Compose 启动：

```bash
docker compose up --build
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

## Vercel 前端

标准 Next.js 项目，生产构建为 `npm run build`。AWS API 可用后，在 Vercel 项目的 Production / Preview 环境设置：

```text
NEXT_PUBLIC_API_BASE_URL=https://<function-id>.lambda-url.ap-northeast-1.on.aws/v1
```

然后重新部署。未设置时，前端会使用仓库中最后一次同来源快照，不会请求未部署的 API。

## AWS 后端

生产后端是无 VPC 的免费额度友好架构：

- 两个 ARM64 Go Lambda：公开只读 API 与每小时榜单采集器；当账号并发配额允许时分别限制并发为 2 和 1（新账号配额不足时部署日志会明确提示）。
- 一个 DynamoDB Standard 表，固定 `5 RCU / 5 WCU`，数据保留 13 个月后由 TTL 清理。
- 一个 EventBridge Scheduler，每小时第 8 分钟采集 Apple CN / JP / US / KR Top Grossing。
- Lambda Function URL 直接提供 GET API；CloudWatch 日志只保留 7 天。
- 不创建 VPC、NAT、ECS、RDS、ElastiCache、ALB、ECR、S3、API Gateway、Route 53 或 Secrets Manager。

GitHub Actions 的 `Deploy free AWS backend` workflow 使用 GitHub OIDC，不保存长期 AWS access key。仓库 `production` environment 只需要：

| Variable | 内容 |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::597994428399:role/gacha-revenue-free-github-deploy` |
| `AWS_REGION` | `ap-northeast-1` |

角色信任范围必须限制为 `repo:achenachena/gacha_revenue:environment:production`，并附加 [最小部署权限](infra/serverless/github-deploy-policy.json)。触发 workflow 后会幂等创建或更新所有资源、立即采集一轮数据，并在 Summary 输出 Function URL。

“Free plan / 免费额度”仍不是无限期免计费承诺：需要保持 AWS 预算告警开启，并关注账号的 credits 与 Free plan 到期日。部署脚本把资源规格锁定在上述范围，也不授予 GitHub 删除资源或创建其他 AWS 服务的权限。
