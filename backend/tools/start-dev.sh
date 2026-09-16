#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"
PYTHON=${PYTHON:-"$ROOT_DIR/venv/bin/python"}
if [ ! -x "$PYTHON" ]; then
  echo "Missing backend/venv; create it first" >&2
  exit 1
fi
SERVICE=${1:-all}

run() {
  "$@" &
}

case "$SERVICE" in
  api) exec "$PYTHON" manage.py runserver "${EVERMODEL_DEV_HOST:-127.0.0.1}:${EVERMODEL_DEV_PORT:-8000}" ;;
  worker) exec "$PYTHON" manage.py runworker ;;
  scheduler) exec "$PYTHON" manage.py runscheduler ;;
  monitor) exec "$PYTHON" manage.py runmonitor ;;
  all)
    run "$PYTHON" manage.py runserver "${EVERMODEL_DEV_HOST:-127.0.0.1}:${EVERMODEL_DEV_PORT:-8000}"
    run "$PYTHON" manage.py runworker
    run "$PYTHON" manage.py runscheduler
    run "$PYTHON" manage.py runmonitor
    trap 'kill 0' EXIT
    wait
    ;;
  *) echo "Usage: $0 [all|api|worker|scheduler|monitor]" >&2; exit 2 ;;
esac
