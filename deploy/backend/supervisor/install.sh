#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${1:-$(cd "$(dirname "$0")/../../.." && pwd)}
CONF_DIR=/etc/evermodel_ops
SUPERVISOR_CONF="$CONF_DIR/supervisord.conf"
PROGRAM_CONF="$CONF_DIR/conf.d/evermodel_ops.conf"
ENV_FILE="$CONF_DIR/environment"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0 /opt/evermodel_ops" >&2
  exit 1
fi
[ -x "$APP_DIR/backend/venv/bin/python" ] || { echo "Missing backend/venv" >&2; exit 1; }

mkdir -p "$APP_DIR/backend/logs" "$CONF_DIR/conf.d" /var/log/evermodel_ops
install -m 0644 "$APP_DIR/deploy/backend/supervisor/supervisord.conf" "$SUPERVISOR_CONF"
sed "s|__APP_DIR__|$APP_DIR|g" "$APP_DIR/deploy/backend/supervisor/evermodel_ops.conf" > "$PROGRAM_CONF"
sed "s|__APP_DIR__|$APP_DIR|g" "$APP_DIR/deploy/backend/supervisor/evermodel_ops.service" \
  > /etc/systemd/system/evermodel_ops.service

if [ ! -f "$ENV_FILE" ]; then
  {
    echo "EVERMODEL_MYSQL_DB=evermodel_ops"
    echo "EVERMODEL_MYSQL_USER=root"
    echo "EVERMODEL_MYSQL_HOST=127.0.0.1"
    echo "EVERMODEL_MYSQL_PORT=3306"
    echo "EVERMODEL_REDIS_HOST=127.0.0.1"
    echo "EVERMODEL_REDIS_PORT=6379"
    echo "EVERMODEL_DEBUG=false"
    echo "EVERMODEL_ALLOWED_HOSTS=*"
    echo "EVERMODEL_MYSQL_PASSWORD=evermodel_ops"
    echo "EVERMODEL_SECRET_KEY=CHANGE_ME_SECRET_KEY"
  } > "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
  echo "Wrote $ENV_FILE; edit it to set real passwords before starting services."
  echo "IMPORTANT: open $ENV_FILE and set EVERMODEL_MYSQL_PASSWORD (match compose/init)"
  echo "and EVERMODEL_SECRET_KEY; then run: sudo systemctl restart evermodel_ops"
else
  echo "Keeping existing $ENV_FILE."
fi

systemctl daemon-reload
systemctl enable --now evermodel_ops

# supervisord 由 systemd 启动;等待 unix socket 出现,起不来时给出诊断
for _ in $(seq 1 15); do
  [ -S /run/evermodel_ops-supervisor.sock ] && break
  sleep 1
done

if [ ! -S /run/evermodel_ops-supervisor.sock ]; then
  echo "supervisord did not start. Diagnostics:" >&2
  systemctl --no-pager status evermodel_ops --full >&2 || true
  journalctl -u evermodel_ops -n 30 --no-pager >&2 || true
  exit 1
fi

supervisorctl -c "$SUPERVISOR_CONF" reread
supervisorctl -c "$SUPERVISOR_CONF" update
supervisorctl -c "$SUPERVISOR_CONF" start all || true
supervisorctl -c "$SUPERVISOR_CONF" status