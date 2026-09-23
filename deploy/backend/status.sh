#!/usr/bin/env bash
# 后端 - 状态：./status.sh [api|ws|worker|monitor|scheduler|all]
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
exec bash "$DEPLOY_DIR/backend/supervisor/manage.sh" status "${1:-all}"
