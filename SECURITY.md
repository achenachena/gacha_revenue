# Security policy

## Reporting a vulnerability

请使用 GitHub 仓库的 **Security → Report a vulnerability** 私下提交安全问题。不要在公开 Issue 中粘贴 token、AWS ARN 以外的账号凭据、供应商响应或可利用细节。

## Secret handling

- 仓库只提交 `.env.example` 的空键名；真实值仅存在于 Vercel sensitive environment variables、GitHub environment secrets 和 Lambda environment variables。
- `NEXT_PUBLIC_*` 会进入浏览器包，禁止用于任何 token、API key 或私有后端地址。
- GitHub Actions 使用 OIDC 获取短期 AWS 凭据，不保存长期 access key。
- 若凭据曾出现在提交、构建日志或浏览器 bundle 中，应先吊销并轮换，再处理 Git 历史；仅删除当前文件不足以消除泄露。

## Supported deployment

仅当前 `main` 分支和最新生产部署接受安全修复。后端是公开数据的只读服务，不处理用户账号、支付信息或个人数据。
