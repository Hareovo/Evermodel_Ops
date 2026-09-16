#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
PYTHON="$BACKEND_DIR/venv/bin/python"

if [ ! -x "$PYTHON" ]; then
  echo "Missing backend/venv. Create it and install requirements first." >&2
  exit 1
fi
if [ -z "${EVERMODEL_MYSQL_PASSWORD:-}" ] || [ -z "${EVERMODEL_ADMIN_PASSWORD:-}" ]; then
  echo "Set EVERMODEL_MYSQL_PASSWORD and EVERMODEL_ADMIN_PASSWORD before initialization." >&2
  exit 1
fi

cd "$BACKEND_DIR"
"$PYTHON" tools/init_instance.py \
  --admin-user "${EVERMODEL_ADMIN_USER:-admin}" \
  --admin-password "$EVERMODEL_ADMIN_PASSWORD" \
  --admin-name "${EVERMODEL_ADMIN_NAME:-Administrator}"
