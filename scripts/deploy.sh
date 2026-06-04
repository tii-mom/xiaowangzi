#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/Users/yudeyou/Desktop/wangzi/xiaowangzi}"
APP_NAME="${APP_NAME:-xiaowangzi}"
BRANCH="${BRANCH:-main}"
LOG_DIR="${LOG_DIR:-/var/log/xiaowangzi}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

required_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

require_env_key() {
  local key="$1"
  if ! grep -qE "^${key}=" "$ENV_FILE"; then
    echo "Missing required env key: ${key}" >&2
    exit 1
  fi
}

cd "$APP_DIR"
required_file "$ENV_FILE"

for key in \
  NODE_ENV \
  APP_URL \
  NEXT_PUBLIC_APP_URL \
  CLOUDFLARE_ACCOUNT_ID \
  CLOUDFLARE_DATABASE_ID \
  CLOUDFLARE_API_TOKEN \
  DEEPSEEK_API_KEY \
  DEEPSEEK_BASE_URL \
  DEEPSEEK_MODEL \
  ADMIN_TOKEN \
  SESSION_SECRET; do
  require_env_key "$key"
done

if grep -qE '^AGENT_BACKEND=hermes$' "$ENV_FILE"; then
  echo "AGENT_BACKEND=hermes is not allowed before Hermes real verification." >&2
  exit 1
fi

if grep -qE '^NODE_ENV=production$' "$ENV_FILE" && grep -qE 'MockAdapter|USE_MOCK|DB_ADAPTER=mock' "$ENV_FILE"; then
  echo "Mock adapter flags are not allowed in production." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

echo "==> Fetching latest code"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Installing dependencies"
npm ci

echo "==> Running checks"
npm run lint
npm run build
npx tsx scripts/test-user-dashboard.ts

echo "==> Preparing standalone runtime"
if [[ ! -f ".next/standalone/server.js" ]]; then
  echo "Missing .next/standalone/server.js. Ensure next.config.mjs has output: 'standalone'." >&2
  exit 1
fi

mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
if [[ -d public ]]; then
  cp -R public .next/standalone/public
fi

echo "==> Starting or reloading PM2 app: $APP_NAME"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --only "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --only "$APP_NAME"
fi
pm2 save

echo "==> Local health check"
sleep 3
curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null

echo "==> Deployment finished. Run public smoke after Nginx/SSL is ready:"
echo "BASE_URL=https://wan.lat npx tsx scripts/test-e2e-smoke.ts"
