#!/usr/bin/env bash
# ============================================================================
# Evermodel Ops — 后端 5 进程托管安装脚本（supervisor + systemd）
#
# 做的事：
#   1. 检查 supervisord 是否可用（缺了就用 apt 装 supervisor 包）
#   2. 建日志目录 backend/logs（⚠️ 缺了 5 个进程会全部 spawn error）
#   3. 把本目录的配置装到 /etc/evermodel_ops/，并把 __APP_DIR__ 换成实际部署路径
#   4. 装 systemd 单元 /etc/systemd/system/evermodel_ops.service
#   5. systemctl enable --now，最后打印各进程状态
#
# 用法：
#   sudo bash deploy/supervisor/install.sh                 # 部署路径自动取仓库根
#   sudo bash deploy/supervisor/install.sh --app-dir /opt/evermodel_ops
#   EVERMODEL_APP_DIR=/opt/evermodel_ops sudo -E bash deploy/supervisor/install.sh
#
# 幂等：可重复执行，覆盖前会备份已有配置为 *.bak
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CONF_DIR=/etc/evermodel_ops
CONF_D_DIR="$CONF_DIR/conf.d"
SUPERVISORD_CONF="$CONF_DIR/supervisord.conf"
PROGRAM_CONF="$CONF_D_DIR/evermodel_ops.conf"
UNIT_FILE=/etc/systemd/system/evermodel_ops.service
LOG_DIR=/var/log/evermodel_ops
SERVICE=evermodel_ops

APP_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --app-dir) APP_DIR="${2:-}"; shift 2 ;;
    --app-dir=*) APP_DIR="${1#*=}"; shift ;;
    -h|--help) sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数：$1（用 --help 查看用法）" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[32m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[install]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[install] 错误：\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. 前置检查
# ---------------------------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "请用 root 执行：sudo bash $0"

# 部署路径优先级：--app-dir > 环境变量 > 本脚本上两级目录（即仓库根）
if [ -z "$APP_DIR" ]; then
  APP_DIR="${EVERMODEL_APP_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
fi
APP_DIR="${APP_DIR%/}"

[ -f "$APP_DIR/backend/manage.py" ] || die "在 $APP_DIR 下找不到 backend/manage.py，请用 --app-dir 指定正确的部署路径"

if ! command -v supervisord >/dev/null 2>&1; then
  warn "未找到 supervisord，尝试安装 supervisor 包…"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y supervisor
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y supervisor
  elif command -v yum >/dev/null 2>&1; then
    yum install -y supervisor
  else
    die "没有可用的包管理器，请先自行安装 supervisor"
  fi
  command -v supervisord >/dev/null 2>&1 || die "supervisor 安装失败，请手工安装后重试"
fi

# 发行版的 supervisor 包会自带一个 systemd 服务（supervisor.service），
# 它和我们这套是「两个独立实例」，同时跑会抢同一批端口。这里只做提醒，不擅自停别人。
if systemctl is-active --quiet supervisor 2>/dev/null; then
  warn "检测到发行版自带的 supervisor.service 正在运行。"
  warn "它和本脚本装的是两套独立实例，会同时拉起端口冲突的进程。"
  warn "二选一：要么 systemctl disable --now supervisor，要么改用发行版方式（见 README.md「方式 B」）。"
fi

say "部署路径 APP_DIR = $APP_DIR"

# ---------------------------------------------------------------------------
# 1. 目录
# ---------------------------------------------------------------------------
# backend/logs 是 5 个进程的 stdout_logfile 所在目录，
# 目录不存在 supervisor 打不开日志文件 → 5 个进程全部 ERROR (spawn error)。
mkdir -p "$APP_DIR/backend/logs" "$CONF_D_DIR" "$LOG_DIR"
say "已确保目录：$APP_DIR/backend/logs、$CONF_D_DIR、$LOG_DIR"

# ---------------------------------------------------------------------------
# 2. 装 supervisord 主配置
# ---------------------------------------------------------------------------
if [ -f "$SUPERVISORD_CONF" ] && ! cmp -s "$SCRIPT_DIR/supervisord.conf" "$SUPERVISORD_CONF"; then
  cp -a "$SUPERVISORD_CONF" "$SUPERVISORD_CONF.bak"
  warn "已有 $SUPERVISORD_CONF，已备份为 .bak 并覆盖"
fi
install -m 0644 "$SCRIPT_DIR/supervisord.conf" "$SUPERVISORD_CONF"

# ---------------------------------------------------------------------------
# 3. 装 5 个程序配置（替换 __APP_DIR__ 占位符）
# ---------------------------------------------------------------------------
if [ -f "$PROGRAM_CONF" ]; then
  cp -a "$PROGRAM_CONF" "$PROGRAM_CONF.bak"
fi
sed "s|__APP_DIR__|$APP_DIR|g" "$SCRIPT_DIR/evermodel_ops.conf" > "$PROGRAM_CONF"
chmod 0644 "$PROGRAM_CONF"

if grep -q '__APP_DIR__' "$PROGRAM_CONF"; then
  die "占位符替换失败，请检查 evermodel_ops.conf 是否被改坏"
fi
say "已写入 $SUPERVISORD_CONF 与 $PROGRAM_CONF"

# ---------------------------------------------------------------------------
# 4. 装 systemd 单元
# ---------------------------------------------------------------------------
if [ -f "$UNIT_FILE" ]; then
  cp -a "$UNIT_FILE" "$UNIT_FILE.bak"
fi
sed "s|__APP_DIR__|$APP_DIR|g" "$SCRIPT_DIR/evermodel_ops.service" > "$UNIT_FILE"
chmod 0644 "$UNIT_FILE"
say "已写入 $UNIT_FILE"

# ---------------------------------------------------------------------------
# 5. 启动
# ---------------------------------------------------------------------------
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
systemctl restart "$SERVICE"
say "已 systemctl enable --now $SERVICE，等待进程就绪…"

sleep 4
echo
supervisorctl -c "$SUPERVISORD_CONF" status || true
echo

RUNNING=$(supervisorctl -c "$SUPERVISORD_CONF" status 2>/dev/null | grep -c 'RUNNING' || true)
if [ "$RUNNING" -eq 5 ]; then
  say "5 个进程全部 RUNNING，托管完成。"
else
  warn "只有 $RUNNING/5 个进程处于 RUNNING，请排查："
  echo "     supervisorctl -c $SUPERVISORD_CONF status"
  echo "     tail -50 $LOG_DIR/supervisord.log"
  echo "     tail -50 $APP_DIR/backend/logs/api.log"
  echo "   最常见的两个原因："
  echo "     1) $APP_DIR/backend/logs 权限不对 / venv 没建好（pip install -r requirements.txt）"
  echo "     2) 数据库或 Redis 连不上（看 overrides.py 里的 EVERMODEL_MYSQL_* / EVERMODEL_REDIS_*）"
  exit 1
fi

cat <<EOF

后续：
  查看状态    supervisorctl -c $SUPERVISORD_CONF status
  重启全部    systemctl restart $SERVICE
  停止全部    systemctl stop $SERVICE
  开机自启    systemctl enable $SERVICE   （本脚本已执行）
  单个服务    supervisorctl -c $SUPERVISORD_CONF restart evermodel_ops-worker
  日志        $APP_DIR/backend/logs/{api,ws,worker,monitor,scheduler}.log

⚠️ worker / scheduler 启动时会清空对应的 Redis 队列（防止旧任务乱跑），
   重启后堆积的任务需要重新提交一次。
EOF
