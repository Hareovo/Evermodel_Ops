#!/usr/bin/env bash
set -euo pipefail

CONF=/etc/evermodel_ops/supervisord.conf
SERVICE=${2:-all}
case "$SERVICE" in
  api) SERVICE=evermodel_ops-api ;;
  ws) SERVICE=evermodel_ops-ws ;;
  worker) SERVICE=evermodel_ops-worker ;;
  monitor) SERVICE=evermodel_ops-monitor ;;
  scheduler) SERVICE=evermodel_ops-scheduler ;;
  all) SERVICE=all ;;
  *) echo "Usage: $0 {start|stop|restart|status|logs} [all|api|ws|worker|monitor|scheduler]"; exit 2 ;;
esac

case "${1:-status}" in
  start|stop|restart|status) supervisorctl -c "$CONF" "$1" "$SERVICE" ;;
  logs) supervisorctl -c "$CONF" tail -f "$SERVICE" ;;
  *) echo "Usage: $0 {start|stop|restart|status|logs} [service]"; exit 2 ;;
esac
