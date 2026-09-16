#!/usr/bin/env bash
set -euo pipefail
ENV_FILE=/etc/evermodel_ops/environment
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi
exec /usr/bin/supervisord -n -c /etc/evermodel_ops/supervisord.conf "$@"