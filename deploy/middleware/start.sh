#!/usr/bin/env bash
# 中间件 - 启动（MariaDB / Redis / nginx）
set -euo pipefail
cd "$(dirname "$0")"
docker compose up -d
echo
echo "=== 中间件状态 ==="
docker compose ps
