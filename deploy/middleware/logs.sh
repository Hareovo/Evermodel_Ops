#!/usr/bin/env bash
# 中间件 - 跟踪日志：./logs.sh [mysql|redis|nginx]
set -euo pipefail
cd "$(dirname "$0")"
docker compose logs -f "${1:-}"
