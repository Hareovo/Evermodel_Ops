#!/usr/bin/env bash
# 数据库初始化 - 幂等入口
#
# 职责（按顺序，全部幂等）：
#   1. 调用 python manage.py updatedb
#      → 内部就是 makemigrations + migrate，已执行的迁移会自动跳过
#   2. 补齐缺失的平台默认设置（init.defaults.sql 是 INSERT IGNORE / ON DUPLICATE KEY）
#   3. 不存在 admin 时创建超级管理员（已存在则跳过且不改密码）
#
# 规则：每次发布新版本需要动数据库时，往 backend/tools/init_instance.py
#      或本脚本末尾追加一段幂等逻辑，运维拉新代码后跑一遍本脚本即对齐到最新。
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
PYTHON="$BACKEND_DIR/venv/bin/python"

if [ ! -x "$PYTHON" ]; then
  echo "Missing backend/venv. Run deploy/backend/install.sh first." >&2
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
