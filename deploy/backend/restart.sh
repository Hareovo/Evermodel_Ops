#!/usr/bin/env bash
# 后端 - 重启：./restart.sh [api|ws|worker|monitor|scheduler|all]
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
exec bash "$DEPLOY_DIR/backend/supervisor/manage.sh" restart "${1:-all}"
