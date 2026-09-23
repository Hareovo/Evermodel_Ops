#!/usr/bin/env bash
# 后端 - 更新流程：装依赖 → 数据库对齐 → 重启 5 个进程
# 假设调用者已在 git pull 之后
set -euo pipefail

DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "==> [1/4] 装/更新后端依赖"
bash "$DEPLOY_DIR/backend/build.sh"

echo
echo "==> [2/4] 数据库对齐（幂等）"
EVERMODEL_MYSQL_PASSWORD="${EVERMODEL_MYSQL_PASSWORD:-evermodel_ops}" \
  bash "$DEPLOY_DIR/db/init.sh"

echo
echo "==> [3/4] 重启后端 5 个进程"
bash "$DEPLOY_DIR/backend/restart.sh" all

echo
echo "==> [4/4] 状态确认"
bash "$DEPLOY_DIR/backend/status.sh"
