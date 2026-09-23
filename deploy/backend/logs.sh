#!/usr/bin/env bash
# 后端 - 跟踪日志：./logs.sh <api|ws|worker|monitor|scheduler>
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
exec bash "$DEPLOY_DIR/backend/supervisor/manage.sh" logs "${1:-api}"
