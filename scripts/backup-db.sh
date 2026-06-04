#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/Users/yudeyou/Desktop/wangzi/xiaowangzi}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups/d1}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${CLOUDFLARE_DATABASE_ID:?Missing CLOUDFLARE_DATABASE_ID}"
: "${CLOUDFLARE_API_TOKEN:?Missing CLOUDFLARE_API_TOKEN}"

mkdir -p "$BACKUP_DIR"
OUT_FILE="$BACKUP_DIR/d1-backup-$TIMESTAMP.sql"

echo "Creating Cloudflare D1 backup: $OUT_FILE"

# Wrangler reads CLOUDFLARE_API_TOKEN from the environment.
# For D1, database_id can be used as the database selector.
npx wrangler d1 export "$CLOUDFLARE_DATABASE_ID" --output "$OUT_FILE"

chmod 600 "$OUT_FILE"

echo "Backup complete: $OUT_FILE"
echo "Keep backups outside git. Do not commit $BACKUP_DIR."
