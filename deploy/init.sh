#!/usr/bin/env bash
# 兼容保留：转发到 deploy/db/init.sh
# 新位置：deploy/db/init.sh（数据库初始化幂等入口）
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")" && pwd)
exec bash "$DEPLOY_DIR/db/init.sh" "$@"
