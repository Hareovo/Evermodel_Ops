#!/usr/bin/env bash
# 前端 - 停止（停掉 nginx 容器即可，不动 mysql/redis）
# 注意：这会让 /api 反代一起断。如果只想停前端而保留 API，请单独操作 nginx。
set -euo pipefail

docker stop evermodel-nginx 2>/dev/null || true
echo "前端已停止（nginx 容器已停止，后端 API 同时不可用）"
echo "如需重新启动：deploy/frontend/start.sh"
