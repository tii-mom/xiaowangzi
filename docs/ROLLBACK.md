# 生产回滚手册

本文档用于 `xiaowangzi` Web MVP 在腾讯云 CVM 上的最小可执行回滚。回滚前必须确认当前事故范围，并保留日志、版本、数据库状态与支付状态证据。

## 1. 回滚原则

- 不得删除 `.env` 或覆盖真实密钥。
- 不得跳过数据库一致性检查。
- 涉及支付、Token 余额、订单状态时，先冻结相关入口，再处理数据。
- Hermes 未真实验证前，不得在回滚中启用 Hermes。
- 回滚成功前，不得声明服务已恢复。

## 2. 回滚前记录

在服务器项目目录执行：

```bash
cd /Users/yudeyou/Desktop/wangzi/xiaowangzi
pwd
git status --short
git rev-parse HEAD
pm2 status xiaowangzi
curl -i https://wan.lat/api/health || true
```

记录：

- 当前 commit SHA
- 上一个稳定 commit SHA
- 当前 PM2 状态
- 当前 `/api/health` 响应
- 是否涉及支付或扣费异常
- 是否存在未处理 BufPay 回调

## 3. 回滚前备份 D1

优先执行：

```bash
APP_DIR=/Users/yudeyou/Desktop/wangzi/xiaowangzi ./scripts/backup-db.sh
```

备份文件默认写入：

```text
/Users/yudeyou/Desktop/wangzi/xiaowangzi/backups/d1/
```

要求：

- 备份目录不得提交到 GitHub。
- 备份文件权限应为 `600`。
- 备份命令不得输出 Cloudflare API token。

## 4. 回滚代码到上一个 commit

```bash
cd /Users/yudeyou/Desktop/wangzi/xiaowangzi
git fetch origin main
# 替换为项目负责人确认的稳定 commit SHA
git checkout <STABLE_COMMIT_SHA>
npm ci
npm run lint
npm run build
npx tsx scripts/test-user-dashboard.ts
```

如果构建通过，准备 standalone 运行目录：

```bash
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
if [ -d public ]; then cp -R public .next/standalone/public; fi
```

重启 PM2：

```bash
pm2 reload ecosystem.config.js --only xiaowangzi --update-env
pm2 save
pm2 status xiaowangzi
```

## 5. Nginx reload

如果 Nginx 配置没有变化，只需确认配置并 reload：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

如果回滚涉及 Nginx 配置，先恢复上一版配置：

```bash
sudo cp /etc/nginx/sites-available/xiaowangzi.bak /etc/nginx/sites-available/xiaowangzi
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 回滚后 Smoke Test

```bash
curl -fsS https://wan.lat/api/health
BASE_URL=https://wan.lat npx tsx scripts/test-e2e-smoke.ts
```

必须验证：

- `/api/health` 成功。
- 首页可访问。
- Web session 可创建。
- Dashboard 可访问。
- Legal 页面可访问。
- 如果 DeepSeek 已配置，`chat/send` 成功或明确 402。
- 如果 Admin 已配置，admin overview 带 token 成功。

## 7. 支付异常专项回滚

如果事故涉及支付：

1. 临时关闭支付入口。
2. 不要拦截 `/api/pay/notify`，避免已支付订单无法入账。
3. 导出或截图保存 BufPay 后台订单证据。
4. 查询 `payment_orders`、`token_ledger`、`users.token_balance`。
5. 核对同一订单是否重复充值。
6. 对需要补单的订单走人工补单流程并记录审计。
7. 对金额不一致、签名错误的回调保持拒绝。

临时 Nginx 层关闭创建订单入口示例：

```nginx
location = /api/pay/create-order {
    return 503 "payment temporarily disabled";
}
```

修改后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. DeepSeek 异常专项回滚

如果事故涉及 DeepSeek：

- 确认 API Key 未泄露。
- 确认失败请求没有扣费，或补偿已记录。
- UI 必须展示服务暂不可用，而不是沉默失败。
- `system_events` 可记录 provider 错误类型，但不得记录密钥、完整 Authorization header 或敏感 payload。

## 9. D1 数据回滚

D1 数据回滚必须由项目负责人确认，尤其涉及订单、Token 余额、订阅状态时不得直接覆盖。

推荐顺序：

1. 先导出当前事故现场数据。
2. 确认目标备份文件。
3. 在临时 D1 数据库验证导入。
4. 核对关键表：`users`、`token_ledger`、`payment_orders`、`subscriptions`。
5. 停止写入入口后再执行生产恢复。

不要在未核对支付状态前恢复整库。

## 10. 回滚完成报告

回滚后在 PR、Issue 或运维记录中写明：

- 事故开始时间
- 回滚开始和完成时间
- 回滚前 commit
- 回滚后 commit
- 是否涉及 D1 恢复
- 是否涉及支付补单
- smoke test 结果
- 仍然存在的阻塞项
