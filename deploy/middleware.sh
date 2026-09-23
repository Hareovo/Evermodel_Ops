#!/usr/bin/env bash
# ============================================================
# 中间件管理（MariaDB / Redis / nginx，Docker Compose）
#
# 用法: deploy/middleware.sh {start|stop|status|logs} [mysql|redis|nginx]
# ============================================================
set -euo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)

case "${1:-status}" in
  start)
    cd "$DIR/middleware" && docker compose up -d
    echo
    docker compose ps
    ;;
  stop)
    cd "$DIR/middleware" && docker compose down
    echo "中间件已停止（数据保留在 deploy/data/）"
    ;;
  status)
    cd "$DIR/middleware" && docker compose ps
    ;;
  logs)
    cd "$DIR/middleware" && docker compose logs -f "${2:-}"
    ;;
  *)
    echo "用法: $0 {start|stop|status|logs} [mysql|redis|nginx]" >&2
    exit 2
    ;;
esac
