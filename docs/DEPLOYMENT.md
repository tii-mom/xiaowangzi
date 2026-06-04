# 小王子 SoulMate — 腾讯云部署方案

## 环境要求

- 腾讯云 CVM（最低 2C4G）
- Ubuntu 22.04 / Debian 12
- Node.js 20+
- Nginx
- PM2
- 域名 wan.lat（已配置 DNS + SSL）

## 部署步骤

### 1. 安装依赖

```bash
# 安装 Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
npm install -g pm2

# 安装 Nginx
sudo apt-get install -y nginx
```

### 2. 部署应用

```bash
# 在服务器上 clone 代码
git clone https://github.com/tii-mom/xiaowangzi.git
cd xiaowangzi

# 安装依赖
npm ci

# 配置环境变量（.env 不入库，手动创建）
cp .env.example .env
# 编辑 .env 填入真实值

# 构建
npm run build

# 启动（standalone 模式）
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Nginx 配置

```nginx
server {
    listen 80;
    server_name wan.lat;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wan.lat;

    ssl_certificate     /etc/ssl/wan.lat/fullchain.pem;
    ssl_certificate_key /etc/ssl/wan.lat/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. 防火墙

```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 5. 验证

```bash
# 健康检查
curl https://wan.lat/api/health

# PM2 状态
pm2 status

# 日志
pm2 logs xiaowangzi
```

## 环境变量

`.env` 文件**不入库**，需在服务器手动创建。模板见 `.env.example`。

关键变量：
- `DEEPSEEK_API_KEY` — DeepSeek API 密钥
- `BUFPAY_AID` / `BUFPAY_APP_SECRET` — BufPay 支付凭证
- `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` / `CLOUDFLARE_API_TOKEN` — D1 数据库
- `HERMES_BASE_URL` / `HERMES_API_KEY` / `HERMES_WEBHOOK_SECRET` — Hermes Agent
- `SESSION_SECRET` — 会话加密密钥

## 外网可访问检查

- BufPay notify_url: `https://wan.lat/api/pay/notify`
- Hermes webhook: `https://wan.lat/api/webhook/hermes`

## 回滚步骤

```bash
pm2 stop xiaowangzi
# 恢复旧版本代码
git checkout <previous-commit>
npm ci && npm run build
pm2 start xiaowangzi
```

## 备份

```bash
# 数据库备份脚本见 scripts/backup-db.sh
bash scripts/backup-db.sh
```
