#!/usr/bin/env bash
# 后端 - 停止 5 个服务进程
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
exec bash "$DEPLOY_DIR/backend/supervisor/manage.sh" stop "${1:-all}"
