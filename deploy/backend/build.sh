#!/usr/bin/env bash
# 后端 - 装/更新 Python 依赖（不重启进程，由 update.sh 编排重启）
set -euo pipefail

APP_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$APP_DIR/backend"

if [ ! -d venv ]; then
  echo "backend/venv missing. Run deploy/backend/install.sh first." >&2
  exit 1
fi

. venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "backend dependencies installed/updated"
