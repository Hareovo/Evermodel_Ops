#!/usr/bin/env bash
# ============================================================
# 前端管理（React 静态产物，服务器本地构建，nginx 伺服）
#
# 用法: deploy/frontend.sh {install|build|start|stop|update|status}
#
#   install   装/同步 Node 依赖（lock 文件无变化时自动跳过）
#   build     npm run build → frontend/build/（nginx 挂载该目录）
#   start     确保中间件在跑 + reload nginx
#   stop      停 nginx 容器（注意：/api 反代会一起断）
#   update    install + build
# ============================================================
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")" && pwd)
APP_DIR=$(cd "$DEPLOY_DIR/.." && pwd)
ACTION=${1:-status}

case "$ACTION" in
  install)
    cd "$APP_DIR/frontend"
    command -v npm >/dev/null 2>&1 || { echo "npm 未安装，请先装 Node.js（>= 16）" >&2; exit 1; }
    [ -f package-lock.json ] || { echo "package-lock.json 缺失" >&2; exit 1; }
    if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
      echo "==> npm ci（安装/同步依赖）"
      npm ci --no-audit --no-fund
    else
      echo "==> 依赖无变化，跳过 npm ci"
    fi
    ;;
  build)
    cd "$APP_DIR/frontend"
    [ -d node_modules ] || { echo "node_modules 缺失，先执行 $0 install" >&2; exit 1; }
    echo "==> 构建前端（npm run build）"
    npm run build
    [ -f build/index.html ] || { echo "构建异常：build/index.html 不存在" >&2; exit 1; }
    echo "==> 构建完成，浏览器 Ctrl+F5 强刷查看新版本"
    ;;
  start)
    bash "$DEPLOY_DIR/middleware.sh" start
    docker exec evermodel-nginx nginx -s reload 2>/dev/null || true
    echo "前端已就绪（nginx 通过挂载 frontend/build 直接伺服）"
    ;;
  stop)
    docker stop evermodel-nginx 2>/dev/null || true
    echo "前端已停止（nginx 容器已停止，后端 API 同时不可用）"
    ;;
  update)
    bash "$0" install
    echo
    bash "$0" build
    ;;
  status)
    docker ps --filter name=evermodel-nginx --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    ;;
  *)
    echo "用法: $0 {install|build|start|stop|update|status}" >&2
    exit 2
    ;;
esac
