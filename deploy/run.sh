#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"
case "${1:-status}" in
  middleware) docker compose -f deploy/docker-compose.yaml "${2:-ps}" ;;
  init) exec deploy/init.sh ;;
  backend) exec deploy/supervisor/manage.sh "${2:-status}" "${3:-all}" ;;
  frontend) exec npm --prefix frontend start ;;
  status) docker compose -f deploy/docker-compose.yaml ps; deploy/supervisor/manage.sh status || true ;;
  *) echo "Usage: $0 {middleware [up|down|ps|logs]|init|backend [start|stop|restart|status|logs] [service]|frontend|status}"; exit 2 ;;
esac
