#!/usr/bin/env bash
set -euo pipefail

# == E2E local DB bootstrap ==
#
# 目的：本地 playwright 一律寫入獨立 local DB（wowlix_e2e），唔准再掂 .env
# 嗰個 shared DB —— 之前 e2e-* 測試店直接落咗 shared DB，污染 prod sitemap
# （見 docs/HANDOFF.md 2026-07-22 root cause）。學 CI e2e job：空 DB + db push。
#
# 每次 drop + recreate：mirror CI 空 DB 起步（空 DB path 以前抓過真 bug，
# 例如 default tenant branding 500），重跑唔會積 e2e-shared-* row。
#
# DB 名寫死 wowlix_e2e，唔讀 .env —— 呢個 script 冇任何路徑會掂 shared DB。

if [ -n "${CI:-}" ]; then
  echo "CI detected — CI 有自己嘅 postgres service，跳過 local bootstrap。"
  exit 0
fi

E2E_DB_NAME="wowlix_e2e"
E2E_DB_HOST="localhost"
E2E_DB_PORT="5432"
E2E_DB_URL="postgresql://${USER}@${E2E_DB_HOST}:${E2E_DB_PORT}/${E2E_DB_NAME}"

echo "== E2E local DB bootstrap (${E2E_DB_NAME}) =="

if ! command -v pg_isready >/dev/null 2>&1; then
  echo "ERROR: 搵唔到 postgres client tools（pg_isready）。"
  echo "  brew install postgresql@14"
  exit 1
fi

if ! pg_isready -h "${E2E_DB_HOST}" -p "${E2E_DB_PORT}" -q; then
  echo "ERROR: local postgres 未起（${E2E_DB_HOST}:${E2E_DB_PORT}）。"
  echo "  brew services start postgresql@14"
  exit 1
fi

echo "-- drop + recreate ${E2E_DB_NAME}"
dropdb --if-exists -h "${E2E_DB_HOST}" -p "${E2E_DB_PORT}" "${E2E_DB_NAME}"
createdb -h "${E2E_DB_HOST}" -p "${E2E_DB_PORT}" "${E2E_DB_NAME}"

echo "-- prisma db push（schema-first，同 CI e2e job 一致）"
DATABASE_URL="${E2E_DB_URL}" npx prisma db push

echo "== E2E local DB ready: ${E2E_DB_URL} =="
