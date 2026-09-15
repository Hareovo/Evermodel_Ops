#!/usr/bin/env bash
# ============================================================================
# Evermodel Ops — 数据库一键初始化
#
# 按顺序做四件事：
#   1. 建库 evermodel_ops + 账号 root/evermodel_ops（执行 db/init.sql）
#   2. 建表 / 迁移（backend: python manage.py updatedb）
#   3. 建平台管理员（默认 admin / evermodel_ops，超级管理员）
#   4. 写平台默认设置（db/init.defaults.sql，默认关闭「访问IP校验」弹窗）
#
# 用法：
#   bash db/init.sh                                   # 自动探测容器与 venv，按默认值初始化
#   bash db/init.sh --container spug-mysql            # 指定容器名
#   bash db/init.sh --no-container                    # 用本机 mysql 客户端
#   bash db/init.sh --host 10.0.0.5 --port 3306       # 数据库在别的机器
#   bash db/init.sh --admin-pass '强密码' --db-pass '强密码'
#   bash db/init.sh --no-defaults                     # 不写平台默认设置
#
# ⚠️ 默认凭据仅用于初始化（库 evermodel_ops / 账号 root / 密码 evermodel_ops），
#    生产环境请用 --db-pass / --admin-pass 换成强密码，并同步改
#    backend/evermodel_ops/overrides.py（或 EVERMODEL_MYSQL_PASSWORD 环境变量）。
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_NAME=evermodel_ops
DB_USER=root
DB_PASS=evermodel_ops
DB_HOST=127.0.0.1
DB_PORT=3306
ADMIN_USER=admin
ADMIN_PASS=evermodel_ops
ADMIN_NICK=管理员
CONTAINER=            # 空 = 自动探测
CONTAINER_SET=0
PYTHON=
RUN_DEFAULTS=1

while [ $# -gt 0 ]; do
  case "$1" in
    --db-name)     DB_NAME="${2:?}"; shift 2 ;;
    --db-user)     DB_USER="${2:?}"; shift 2 ;;
    --db-pass)     DB_PASS="${2:?}"; shift 2 ;;
    --host)        DB_HOST="${2:?}"; shift 2 ;;
    --port)        DB_PORT="${2:?}"; shift 2 ;;
    --admin-user)  ADMIN_USER="${2:?}"; shift 2 ;;
    --admin-pass)  ADMIN_PASS="${2:?}"; shift 2 ;;
    --admin-nick)  ADMIN_NICK="${2:?}"; shift 2 ;;
    --container)   CONTAINER="${2:?}"; CONTAINER_SET=1; shift 2 ;;
    --no-container) CONTAINER=""; CONTAINER_SET=1; shift ;;
    --python)      PYTHON="${2:?}"; shift 2 ;;
    --app-dir)     APP_DIR="${2:?}"; shift 2 ;;
    --no-defaults) RUN_DEFAULTS=0; shift ;;
    -h|--help)     sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数：$1（用 --help 查看用法）" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[32m[init]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[init]\033[0m %s\n' "$*"; }
step() { printf '\n\033[36m== %s ==\033[0m\n' "$*"; }
die()  { printf '\033[31m[init] 错误：\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. 探测
# ---------------------------------------------------------------------------
BACKEND_DIR="$APP_DIR/backend"
[ -f "$BACKEND_DIR/manage.py" ] || die "在 $APP_DIR 下找不到 backend/manage.py，请用 --app-dir 指定部署路径"

if [ "$CONTAINER_SET" -eq 0 ]; then
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'spug-mysql'; then
    CONTAINER=spug-mysql
  fi
fi

if [ -z "$PYTHON" ]; then
  if [ -x "$BACKEND_DIR/venv/bin/python" ]; then
    PYTHON="$BACKEND_DIR/venv/bin/python"
  elif [ -x "$BACKEND_DIR/venv/Scripts/python.exe" ]; then
    PYTHON="$BACKEND_DIR/venv/Scripts/python.exe"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON=python3
  elif command -v python >/dev/null 2>&1; then
    PYTHON=python
  else
    die "找不到 Python，请先建好 backend/venv（python3 -m venv venv && pip install -r requirements.txt）"
  fi
fi

say "部署路径  $APP_DIR"
say "数据库    $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
if [ -n "$CONTAINER" ]; then
  say "SQL 执行  经容器 $CONTAINER 内的 mysql 客户端"
else
  say "SQL 执行  本机 mysql 客户端"
fi
say "Python    $PYTHON"

if [ "$DB_PASS" = 'evermodel_ops' ]; then
  warn "数据库密码仍是初始化默认值 evermodel_ops，生产环境请用 --db-pass 改掉。"
fi
if [ "$ADMIN_PASS" = 'evermodel_ops' ]; then
  warn "管理员密码仍是初始化默认值 evermodel_ops，首次登录后请尽快在平台上修改。"
fi

# ---------------------------------------------------------------------------
# SQL 执行封装：文件 + 可选库名
# ---------------------------------------------------------------------------
sql_file() {
  local file="$1" db="${2:-}"
  local args=(-u"$DB_USER" -p"$DB_PASS")
  [ -n "$db" ] && args+=("$db")

  if [ -n "$CONTAINER" ]; then
    docker exec -i "$CONTAINER" mysql "${args[@]}" < "$file"
  else
    command -v mysql >/dev/null 2>&1 || die "本机没有 mysql 客户端，请改用 --container <容器名>"
    mysql -h"$DB_HOST" -P"$DB_PORT" "${args[@]}" < "$file"
  fi
}

# 让 manage.py 连到「同一个库」：环境变量优先级高于 overrides.py 里的默认值
export EVERMODEL_MYSQL_DB="$DB_NAME"
export EVERMODEL_MYSQL_USER="$DB_USER"
export EVERMODEL_MYSQL_PASSWORD="$DB_PASS"
export EVERMODEL_MYSQL_HOST="$DB_HOST"
export EVERMODEL_MYSQL_PORT="$DB_PORT"

manage() { ( cd "$BACKEND_DIR" && "$PYTHON" manage.py "$@" ); }

# ---------------------------------------------------------------------------
# 1. 建库 + 账号
# ---------------------------------------------------------------------------
step "1/4 建库与账号"
sql_file "$SCRIPT_DIR/init.sql"

# ---------------------------------------------------------------------------
# 2. 建表
# ---------------------------------------------------------------------------
step "2/4 建表（manage.py updatedb）"
manage updatedb

# ---------------------------------------------------------------------------
# 3. 管理员
# ---------------------------------------------------------------------------
step "3/4 平台管理员"
# user add 在账号已存在时只是打印错误、退出码仍是 0，所以按输出判断，改为重置密码
ADD_OUT="$(manage user add -u "$ADMIN_USER" -p "$ADMIN_PASS" -n "$ADMIN_NICK" -s 2>&1 || true)"
echo "$ADD_OUT"
if printf '%s' "$ADD_OUT" | grep -q '已存在'; then
  warn "管理员 $ADMIN_USER 已存在，改为重置其密码"
  manage user reset -u "$ADMIN_USER" -p "$ADMIN_PASS"
fi

# ---------------------------------------------------------------------------
# 4. 平台默认设置
# ---------------------------------------------------------------------------
step "4/4 平台默认设置"
if [ "$RUN_DEFAULTS" -eq 1 ]; then
  sql_file "$SCRIPT_DIR/init.defaults.sql" "$DB_NAME"
else
  warn "已跳过（--no-defaults）"
fi

cat <<EOF

初始化完成。

  登录地址  http://<服务器地址>/
  账号      $ADMIN_USER
  密码      $ADMIN_PASS
  数据层    $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME

下一步：
  1) 启动后端 5 个进程：sudo bash deploy/supervisor/install.sh
  2) 部署前端产物：见 frontend/BUILD.md（npm run dist 后解压到站点根）
  3) 首次登录后到「系统管理 / 系统设置」核对告警渠道与监控大屏地址

⚠️ 别忘了改密码：数据库用 --db-pass，平台管理员登录后在「我的账户」里改。
EOF
