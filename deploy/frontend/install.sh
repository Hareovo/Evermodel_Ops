#!/usr/bin/env bash
# 前端 - 首次安装/更新依赖
# 策略：node_modules 缺失 → npm ci；lock 文件比 node_modules 新（git pull 拉到了依赖变更）→ npm ci；
#       否则跳过，避免每次更新全量重装
set -euo pipefail

APP_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$APP_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Please install Node.js (>= 16) first." >&2
  exit 1
fi

if [ ! -f package-lock.json ]; then
  echo "package-lock.json missing. Run on dev machine: npm install && commit the lockfile." >&2
  exit 1
fi

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "==> npm ci (安装/同步依赖)"
  npm ci --no-audit --no-fund
else
  echo "==> 依赖无变化，跳过 npm ci"
fi
