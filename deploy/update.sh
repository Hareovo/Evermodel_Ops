#!/usr/bin/env bash
# ============================================================
# Evermodel Ops 一键更新（git pull 之后调用）
#
# 用法: ./deploy/update.sh
# ============================================================
set -euo pipefail

DEPLOY_DIR=$(cd "$(dirname "$0")" && pwd)
APP_DIR=$(cd "$DEPLOY_DIR/.." && pwd)
cd "$APP_DIR"

echo "==> [1/4] 拉取最新代码"
git pull --ff-only

echo
echo "==> [2/4] 后端更新（依赖 → 数据库 → 重启）"
bash "$DEPLOY_DIR/backend.sh" update

echo
echo "==> [3/4] 前端更新（依赖 → 构建）"
bash "$DEPLOY_DIR/frontend.sh" update

echo
echo "==> [4/4] 状态确认"
bash "$DEPLOY_DIR/status.sh"

echo
echo "更新完成。浏览器 Ctrl+F5 强刷查看前端最新版本。"
