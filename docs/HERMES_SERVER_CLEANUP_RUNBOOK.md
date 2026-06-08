# Hermes / Clawbot Server Cleanup Runbook

目标：腾讯云 `43.167.220.227` 只保留小王子项目需要的 Clawbot bridge，冻结 OpenClaw/tai 旧进程与目录残留。

本 runbook 不要求删除数据。首次执行应先归档，观察 24 小时后再决定是否删除。

## 当前保留项

- PM2: `xms-clawbot-bridge`
- 目录: `/opt/xms/clawbot-bridge`
- 用途: Clawbot 网页扫码绑定、微信普通消息投递、向 Cloudflare `/api/bot/clawbot/*` 回调。

## 待冻结项

- PM2: `tai-x402`
- PM2: `tai-web`
- PM2: `tai-api`
- PM2: `evomap-heartbeat`，如确认与 Clawbot bridge 无关。
- 目录: `/root/.openclaw`
- 目录: `/opt/trash-talk-openclaw-adapter`
- 目录: `/opt/xiaowangzi-hermes-gateway`
- 目录: `/root/.hermes`，如暂不运行官方 `nousresearch/hermes-agent`。

## 执行前只读检查

```bash
pm2 list
pm2 describe xms-clawbot-bridge
curl -sS http://127.0.0.1:8787/health
find /opt -maxdepth 3 -type d \( -iname "*openclaw*" -o -iname "*hermes*" -o -iname "*claw*" -o -iname "*xms*" \) | sort
find /root -maxdepth 3 -type d \( -iname "*openclaw*" -o -iname "*hermes*" -o -iname "*claw*" \) | sort
```

## 冻结步骤

```bash
mkdir -p /opt/archive/xms-cleanup-$(date +%Y%m%d)
ARCHIVE=/opt/archive/xms-cleanup-$(date +%Y%m%d)

pm2 stop tai-x402 tai-web tai-api evomap-heartbeat
pm2 save

mv /opt/trash-talk-openclaw-adapter "$ARCHIVE/" 2>/dev/null || true
mv /opt/xiaowangzi-hermes-gateway "$ARCHIVE/" 2>/dev/null || true
mv /root/.openclaw "$ARCHIVE/root-openclaw" 2>/dev/null || true
mv /root/.hermes "$ARCHIVE/root-hermes" 2>/dev/null || true
```

## 验收

```bash
pm2 list
curl -sS http://127.0.0.1:8787/health
pm2 logs xms-clawbot-bridge --lines 80 --nostream
```

期望：

- `xms-clawbot-bridge` online。
- `/health` 返回 `ok: true`。
- 微信扫码绑定与普通消息仍可用。
- PM2 中不再运行 OpenClaw/tai 旧进程。

## 回滚

```bash
pm2 resurrect
# 如目录迁移导致误伤，从 /opt/archive/xms-cleanup-YYYYMMDD/ 移回原路径。
```

生产清理前必须确认 Cloudflare staging 的微信消息链路仍能完成：绑定、收消息、AI 回复、`conversations.channel='hermes'`、`token_ledger` 扣费。
