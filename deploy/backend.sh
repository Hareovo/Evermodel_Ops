#!/usr/bin/env bash
# ============================================================
# 后端管理（1 个 Django 代码库，跑 5 个服务进程）
#
# 用法: deploy/backend.sh {install|build|start|stop|restart|status|logs|update} [api|ws|worker|monitor|scheduler|all]
#
#   install   首次安装: venv + 依赖 + overrides.py + supervisor/systemd（需 sudo）
#   build     装/更新 Python 依赖（不重启）
#   update    更新流程: build + 数据库幂等对齐 + 重启全部
#   logs      需指定具体服务名
# ============================================================
set -euo pipefail
DEPLOY_DIR=$(cd "$(dirname "$0")" && pwd)
APP_DIR=$(cd "$DEPLOY_DIR/.." && pwd)
CONF=/etc/evermodel_ops/supervisord.conf
ACTION=${1:-status}
SERVICE=${2:-all}

map_service() {
  case "$1" in
    api)       echo evermodel_ops-api ;;
    ws)        echo evermodel_ops-ws ;;
    worker)    echo evermodel_ops-worker ;;
    monitor)   echo evermodel_ops-monitor ;;
    scheduler) echo evermodel_ops-scheduler ;;
    all)       echo all ;;
    *) echo "未知服务: $1（支持 api|ws|worker|monitor|scheduler|all）" >&2; exit 2 ;;
  esac
}

case "$ACTION" in
  install)
    echo "==> 创建 venv 并安装依赖"
    cd "$APP_DIR/backend"
    [ -d venv ] || python3 -m venv venv
    . venv/bin/activate
    pip install --quiet --upgrade pip
    pip install --quiet -r requirements.txt
    if [ ! -f evermodel_ops/overrides.py ]; then
      cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py
      echo "==> 已生成 evermodel_ops/overrides.py（按需要修改）"
    fi
    echo "==> 安装 supervisor + systemd 托管"
    bash "$DEPLOY_DIR/backend/supervisor/install.sh" "$APP_DIR"
    ;;
  build)
    cd "$APP_DIR/backend"
    [ -d venv ] || { echo "backend/venv 缺失，先执行: sudo $0 install" >&2; exit 1; }
    . venv/bin/activate
    pip install --quiet --upgrade pip
    pip install --quiet -r requirements.txt
    echo "后端依赖已安装/更新"
    ;;
  start|stop|restart)
    supervisorctl -c "$CONF" "$ACTION" "$(map_service "$SERVICE")"
    ;;
  status)
    supervisorctl -c "$CONF" status
    ;;
  logs)
    [ "$SERVICE" = "all" ] && { echo "logs 需指定服务: api|ws|worker|monitor|scheduler" >&2; exit 2; }
    supervisorctl -c "$CONF" tail -f "$(map_service "$SERVICE")"
    ;;
  update)
    bash "$0" build
    echo
    echo "==> 数据库对齐（幂等）"
    EVERMODEL_MYSQL_PASSWORD="${EVERMODEL_MYSQL_PASSWORD:-evermodel_ops}" \
      bash "$DEPLOY_DIR/db/init.sh"
    echo
    echo "==> 重启后端 5 个进程"
    supervisorctl -c "$CONF" restart all
    echo
    supervisorctl -c "$CONF" status
    ;;
  *)
    echo "用法: $0 {install|build|start|stop|restart|status|logs|update} [api|ws|worker|monitor|scheduler|all]" >&2
    exit 2
    ;;
esac
