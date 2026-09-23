#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
PYTHON="$BACKEND_DIR/venv/bin/python"

if [ ! -x "$PYTHON" ]; then
  echo "Missing backend/venv. Create it and install requirements first." >&2
  exit 1
fi
if [ -z "${EVERMODEL_MYSQL_PASSWORD:-}" ]; then
  echo "Set EVERMODEL_MYSQL_PASSWORD before initialization." >&2
  exit 1
fi

# EVERMODEL_ADMIN_PASSWORD 可选：
#   - admin 已存在：脚本会跳过创建，不会改密码
#   - admin 不存在：必须提供，否则 init_instance.py 会报错退出

cd "$BACKEND_DIR"
ARGS=(
  --admin-user "${EVERMODEL_ADMIN_USER:-admin}"
  --admin-name "${EVERMODEL_ADMIN_NAME:-Administrator}"
)
if [ -n "${EVERMODEL_ADMIN_PASSWORD:-}" ]; then
  ARGS+=( --admin-password "$EVERMODEL_ADMIN_PASSWORD" )
fi

"$PYTHON" tools/init_instance.py "${ARGS[@]}"
