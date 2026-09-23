#!/usr/bin/env bash
# ============================================================
# Evermodel Ops 一键部署（首次安装）
#
# 部署形态：1 个前端 + 1 个后端代码库（跑 5 个服务进程） + 中间件
#
# 用法：sudo ./deploy/install.sh [/opt/evermodel_ops]
# ============================================================
set -euo pipefail

APP_DIR=${1:-$(cd "$(dirname "$0")/.." && pwd)}
DEPLOY_DIR="$APP_DIR/deploy"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0 $APP_DIR" >&2
  exit 1
fi

echo "==> [1/4] 启动中间件（MariaDB / Redis / nginx）"
bash "$DEPLOY_DIR/middleware/start.sh"

echo
echo "==> [2/4] 安装后端（venv / 依赖 / supervisor + systemd）"
bash "$DEPLOY_DIR/backend/install.sh" "$APP_DIR"

echo
echo "==> [3/4] 初始化数据库（幂等）"
if [ -z "${EVERMODEL_ADMIN_PASSWORD:-}" ]; then
  echo "未设置 EVERMODEL_ADMIN_PASSWORD。" >&2
  echo "首次部署必须提供管理员密码，例如：" >&2
  echo "  sudo EVERMODEL_ADMIN_PASSWORD='你的管理员密码' ./deploy/install.sh" >&2
  exit 1
fi
EVERMODEL_MYSQL_PASSWORD="${EVERMODEL_MYSQL_PASSWORD:-evermodel_ops}" \
EVERMODEL_ADMIN_PASSWORD="$EVERMODEL_ADMIN_PASSWORD" \
  bash "$DEPLOY_DIR/db/init.sh"

echo
echo "==> [4/4] 安装并构建前端"
bash "$DEPLOY_DIR/frontend/install.sh"
bash "$DEPLOY_DIR/frontend/build.sh"

echo
echo "==============================================="
echo "  部署完成"
echo "==============================================="
bash "$DEPLOY_DIR/status.sh"
