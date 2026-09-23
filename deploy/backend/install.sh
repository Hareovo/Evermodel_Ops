#!/usr/bin/env bash
# 后端 - 首次安装：建 venv / 装依赖 / 装 supervisor + systemd
# 用法：sudo ./deploy/backend/install.sh [/opt/evermodel_ops]
set -euo pipefail

APP_DIR=${1:-$(cd "$(dirname "$0")/../.." && pwd)}
DEPLOY_DIR="$APP_DIR/deploy"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0 $APP_DIR" >&2
  exit 1
fi

echo "==> 创建 Python venv 并安装依赖"
cd "$APP_DIR/backend"
if [ ! -d venv ]; then
  python3 -m venv venv
fi
. venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

if [ ! -f evermodel_ops/overrides.py ]; then
  cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py
  echo "==> 已生成 evermodel_ops/overrides.py（按需要修改）"
fi

echo "==> 安装 supervisor + systemd 托管"
bash "$DEPLOY_DIR/backend/supervisor/install.sh" "$APP_DIR"

echo
echo "==> 后端安装完成"
"$DEPLOY_DIR/backend/status.sh"
