#!/usr/bin/env bash
# ============================================================
# Evermodel Ops 一键更新（git pull 之后调用）
#
# 流程：
#   1. git pull --ff-only
#   2. 后端：装依赖 → 数据库对齐（幂等）→ 重启 5 个进程
#   3. 前端：装依赖（如有变化）→ 构建
#   4. 状态确认
#
# 用法：./deploy/update.sh
# ============================================================
set -euo pipefail

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
DEPLOY_DIR="$APP_DIR/deploy"
cd "$APP_DIR"

echo "==> [1/4] 拉取最新代码"
git pull --ff-only

echo
echo "==> [2/4] 后端更新"
bash "$DEPLOY_DIR/backend/update.sh"

echo
echo "==> [3/4] 前端更新"
bash "$DEPLOY_DIR/frontend/update.sh"

echo
echo "==> [4/4] 状态确认"
bash "$DEPLOY_DIR/status.sh"

echo
echo "更新完成。浏览器 Ctrl+F5 强刷查看前端最新版本。"
