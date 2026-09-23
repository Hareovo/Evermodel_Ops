#!/usr/bin/env bash
# 后端 - 启动 5 个服务进程
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
exec bash "$DEPLOY_DIR/backend/supervisor/manage.sh" start "${1:-all}"
