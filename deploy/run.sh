#!/usr/bin/env bash
# 兼容保留：旧版统一入口
# 新结构：
#   deploy/install.sh              首次一键部署
#   deploy/update.sh               git pull 后一键更新
#   deploy/status.sh               状态总览
#   deploy/middleware/*.sh         中间件（MariaDB/Redis/nginx）
#   deploy/backend/*.sh            后端 1+5
#   deploy/frontend/*.sh           前端
#   deploy/db/init.sh              数据库初始化（幂等）
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")" && pwd)

case "${1:-status}" in
  middleware)
    sub="${2:-status}"
    exec bash "$DEPLOY_DIR/middleware/$sub.sh" "${@:3}"
    ;;
  init)
    exec bash "$DEPLOY_DIR/db/init.sh" "${@:2}"
    ;;
  backend)
    sub="${2:-status}"
    exec bash "$DEPLOY_DIR/backend/$sub.sh" "${@:3}"
    ;;
  frontend)
    sub="${2:-status}"
    if [ "$sub" = "status" ]; then
      echo "前端无独立进程，由 nginx 容器伺服"
      docker ps --filter name=evermodel-nginx --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
      exit 0
    fi
    exec bash "$DEPLOY_DIR/frontend/$sub.sh" "${@:3}"
    ;;
  install|update|status)
    exec bash "$DEPLOY_DIR/$1.sh" "${@:2}"
    ;;
  *)
    cat <<'EOF'
用法（兼容旧版，推荐直接用新脚本）：
  deploy/install.sh                  首次一键部署
  deploy/update.sh                   git pull 后一键更新
  deploy/status.sh                   状态总览

  deploy/middleware/{start,stop,status,logs}.sh
  deploy/backend/{install,build,start,stop,restart,status,logs,update}.sh [api|ws|worker|monitor|scheduler|all]
  deploy/frontend/{install,build,start,stop,update}.sh
  deploy/db/init.sh                  数据库初始化（幂等）
EOF
    exit 2 ;;
esac
