#!/usr/bin/env bash
# 前端 - 启动（重载 nginx，让最新 build/ 生效）
# 说明：前端是纯静态资源，没有独立进程。"启动"= 确保 nginx 在跑 + reload
set -euo pipefail

DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)

# 确保中间件（含 nginx）已启动
bash "$DEPLOY_DIR/middleware/start.sh"

# reload nginx 让最新静态资源被服务（其实静态文件由 nginx 直接从磁盘读，不 reload 也行；
# 但 reload 能让 nginx 重新 stat 目录、释放可能的句柄缓存，无副作用）
docker exec evermodel-nginx nginx -s reload 2>/dev/null || true

echo "前端已就绪（nginx 通过挂载 frontend/build 直接伺服）"
