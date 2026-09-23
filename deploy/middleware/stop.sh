#!/usr/bin/env bash
# 中间件 - 停止（不删数据）
set -euo pipefail
cd "$(dirname "$0")"
docker compose down
echo "中间件已停止（数据保留在 deploy/data/）"
