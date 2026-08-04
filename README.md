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
EventBridge Scheduler → SQS → Go worker → S3 原始归档
                                      ↘ PostgreSQL 小时观测与聚合 → Go API
Vercel Next.js 前端 ────────────────────────────────────────────↗
```

Go worker 每小时读取 Apple 公开 Top Grossing RSS（CN / JP / US / KR，Top 200），记录：

- 每个独立上半 / 下半窗口的四区峰值与最低可见名次；
- 中国区游戏超过抖音、腾讯视频、QQ 音乐、剪映、网易云音乐、百度网盘、夸克的小时数；
- 同一小时 `rank_game < rank_app` 时累计一小时；不在 Top 200 时不伪造精确名次。

Apple 公共 feed 只能从采集启用时开始积累，也不提供卡池日历。历史回填与未来卡池自动建档必须接入合法购买的七麦、Sensor Tower 或其他授权 feed；令牌只保存在 AWS Secrets Manager。

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
(cd infra/terraform && terraform fmt -check -recursive && terraform validate)
```

## Vercel 前端

标准 Next.js 项目，生产构建为 `npm run build`。AWS API 可用后，在 Vercel 项目的 Production / Preview 环境设置：

```text
NEXT_PUBLIC_API_BASE_URL=https://api.<你的域名>/v1
```

然后重新部署。未设置时，前端会使用仓库中最后一次同来源快照，不会请求未部署的 API。

## AWS 后端

Terraform 创建 ECR、ECS Fargate、ALB/ACM、RDS PostgreSQL、ElastiCache Redis、SQS/DLQ、EventBridge Scheduler、S3、Secrets Manager、SSM 和 CloudWatch。它复用一个现有 VPC：ECS/ALB 使用至少两个公有子网，RDS/Redis 使用至少两个私有子网。

复制示例并替换值可本地部署：

```bash
cp infra/terraform/backend.hcl.example infra/terraform/backend.hcl
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
cd infra/terraform
terraform init -backend-config=backend.hcl
terraform apply
```

GitHub Actions 的 `Deploy AWS backend` workflow 使用 GitHub OIDC，不保存长期 AWS access key。仓库 `production` environment 需要以下 Variables：

| Variable | 内容 |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | 信任本仓库 GitHub OIDC 的 AWS IAM role ARN |
| `AWS_REGION` | 推荐 `ap-northeast-1` |
| `TF_STATE_BUCKET` | 已存在、开启版本控制与加密的 Terraform state S3 bucket |
| `AWS_VPC_ID` | 目标 VPC ID |
| `AWS_PUBLIC_SUBNET_IDS` | JSON 数组，例如 `["subnet-a","subnet-c"]` |
| `AWS_PRIVATE_SUBNET_IDS` | JSON 数组，例如 `["subnet-b","subnet-d"]` |
| `API_DOMAIN_NAME` | Route 53 区域下的 API 域名，例如 `api.example.com` |
| `ROUTE53_ZONE_ID` | 上述域名的 public hosted zone ID |
| `RAW_DATA_BUCKET_NAME` | 全球唯一的新 S3 bucket 名 |

可选成本 / 高可用 Variables：`API_DESIRED_COUNT`、`WORKER_DESIRED_COUNT`、`RDS_INSTANCE_CLASS`、`REDIS_NODE_TYPE`、`REDIS_NUM_CACHE_CLUSTERS`。默认 workflow 使用单 API、单 worker、`db.t4g.small` 与单 Redis 节点，属于较低成本、非高可用配置。

首次部署后，如有授权历史 API，在 Secrets Manager 输出的 `rank_feed_secret_arn` 对应 secret 中写入：

```json
{
  "AUTHORIZED_RANK_FEED_URL": "https://licensed-provider.example/feed",
  "AUTHORIZED_RANK_FEED_TOKEN": "replace-me"
}
```

供应商 token 不进入 GitHub Variables、Vercel或前端包。
