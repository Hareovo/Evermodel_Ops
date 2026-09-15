#!/bin/sh
# Copyright: (c) Evermodel Ops
# 在 Grafana 所在机器上执行，放行「允许嵌入 + 匿名只读」，让 Evermodel Ops 的 /grafana 页面能嵌看板。
#
# 用法：
#   sh grafana-allow-embed.sh                        # 自动探测部署方式并修改
#   sh grafana-allow-embed.sh --dry-run              # 只打印将要做的修改，不落盘
#   sh grafana-allow-embed.sh --url http://<grafana-host>:3000
#   sh grafana-allow-embed.sh --help
#
# 不用先拷文件也能执行（从本机管道喂过去，注意 `sh -s`）：
#   ssh root@<host> 'sh -s -- --dry-run' < grafana-allow-embed.sh
#   ssh root@<host> 'sh -s' < grafana-allow-embed.sh
#
# 会自动识别：K8s(ConfigMap) / docker compose / docker run / 裸机 systemd。
# 改完自动重启 Grafana 并实测 /api/search 是否返回 200、是否还带 X-Frame-Options。
set -eu

# 用法文本内联在这里，刻意不用 `sed -n '2,10p' "$0"` 去读文件头 ——
# 脚本经 `ssh host 'sh -s' < file` 或管道执行时 $0 是 "sh"，读它必然报 sed: can't read sh。
# 且必须在解析参数的 while 循环【之前】定义，否则循环里调用时会 "usage: not found"。
usage() {
  cat <<'USAGE'
在 Grafana 所在机器上执行，放行「允许嵌入 + 匿名只读」，让后台的 /grafana 页面能嵌看板。

用法：
  sh grafana-allow-embed.sh [选项]

  （本机执行）                sh grafana-allow-embed.sh
  （远端执行，从本机管道喂）  ssh root@<host> 'sh -s' < grafana-allow-embed.sh
  （带参数）                  ssh root@<host> 'sh -s -- --dry-run' < grafana-allow-embed.sh

选项：
  --dry-run            只打印将要做的修改（diff），不落盘、不重启
  --url <URL>          验证用的 Grafana 地址，默认 http://127.0.0.1:3000
  --ini <路径>         指定 grafana.ini 路径，默认 /etc/grafana/grafana.ini
  --namespace <ns>     K8s 命名空间（自动探测不准时手工指定）
  --deployment <name>  K8s Deployment 名（自动探测不准时手工指定）
  -h, --help           显示本帮助

会自动识别：K8s(ConfigMap) / docker compose / docker run / 裸机 systemd。
改完自动重启 Grafana 并实测 /api/search 是否返回 200、是否还带 X-Frame-Options。
USAGE
}

INI_PATH=/etc/grafana/grafana.ini
GRAFANA_URL="http://127.0.0.1:3000"
DRY_RUN=0
K8S_NS=""
K8S_DEPLOY=""
_CHANGED=0          # patch_ini_file 的副作用：1=写了新配置、0=本来就是对的（用于跳过无谓重启）

while [ $# -gt 0 ]; do
  case "$1" in
    --url) GRAFANA_URL="$2"; shift 2 ;;
    --ini) INI_PATH="$2"; shift 2 ;;
    --namespace) K8S_NS="$2"; shift 2 ;;
    --deployment) K8S_DEPLOY="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; exit 2 ;;
  esac
done

say()  { printf '%s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 一份 awk 改一个 key：在指定 section 内把该 key 改成指定值。
# - 该行是注释态（;key= / #key=）也会被替换成生效行
# - section 内没有该 key 就补在 section 末尾
# - section 不存在就整体追加到文件末尾（绝不重复写同名 section，go-ini 会报错）
# ---------------------------------------------------------------------------
ini_set() { # $1=file $2=section $3=key $4=value
  awk -v S="$2" -v K="$3" -v V="$4" '
    function flush_pending() {
      if (pending && !hit) { print K " = " V; pending = 0; hit = 1 }
    }
    BEGIN { cur = ""; pending = 0; hit = 0; saw = 0 }
    /^[ \t]*\[/ {
      flush_pending()
      s = $0
      sub(/^[ \t]*\[/, "", s); sub(/\][ \t]*$/, "", s)
      cur = s
      if (cur == S) saw = 1
      print
      next
    }
    {
      if (cur == S && !hit) {
        t = $0
        sub(/^[ \t]*[;#]?[ \t]*/, "", t)
        # 命中已存在的键（无论是否被注释）就地改写，并且必须清掉 pending，
        # 否则 next 跳过了下面的赋值，会在 section 末尾再补一行重复键
        if (t ~ ("^" K "[ \t]*=")) { print K " = " V; hit = 1; pending = 0; next }
      }
      print
      if (cur == S && !hit) pending = 1
    }
    END {
      if (cur == S) flush_pending()
      if (!saw) { print ""; print "[" S "]"; print K " = " V }
    }
  ' "$1"
}

# 把 4 个配置写进指定 ini 文件；$2=1 表示 dry-run
# 副作用：设置全局 _CHANGED（1=有改动、0=本来就是对的），调用方据此决定要不要重启 Grafana
patch_ini_file() { # $1=ini路径 $2=dry_run [$3=显示用的目标名]
  _f="$1"; _dry="$2"; _label="${3:-$1}"
  [ -f "$_f" ] || die "找不到配置文件 $_f"
  _tmp="$(mktemp)"
  cp "$_f" "$_tmp"
  ini_set "$_tmp" security         allow_embedding true    > "$_tmp.1"; mv "$_tmp.1" "$_tmp"
  ini_set "$_tmp" auth.anonymous   enabled         true    > "$_tmp.1"; mv "$_tmp.1" "$_tmp"
  ini_set "$_tmp" auth.anonymous   org_name        "Main Org." > "$_tmp.1"; mv "$_tmp.1" "$_tmp"
  ini_set "$_tmp" auth.anonymous   org_role        Viewer  > "$_tmp.1"; mv "$_tmp.1" "$_tmp"

  if [ "$_dry" = "1" ]; then
    say "--- [dry-run] $_label 的差异 ---"
    diff "$_f" "$_tmp" || true
    rm -f "$_tmp"
    _CHANGED=0
    return 0
  fi
  if diff -q "$_f" "$_tmp" >/dev/null; then
    ok "$_label 无需修改（已配置）"
    rm -f "$_tmp"
    _CHANGED=0
    return 0
  fi
  cat "$_tmp" > "$_f"     # 原地写，保留 inode（bind mount 场景必须如此）
  rm -f "$_tmp"
  _CHANGED=1
  ok "$_label 已更新"
}

# 无改动就不重启：Grafana 一重启，正在看监控的人会掉一下，配置本来就对时没必要
_restart_if_changed() {
  if [ "$_CHANGED" = "1" ]; then
    say "  重启容器 $CONTAINER ..."
    docker restart "$CONTAINER" >/dev/null
  else
    say "  配置无需变更，跳过重启"
  fi
}

verify() {
  say ""
  say "== 验证（从本机访问 $GRAFANA_URL）=="
  _i=0
  while [ $_i -lt 20 ]; do
    _code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$GRAFANA_URL/api/search?type=dash-db" || true)"
    [ "$_code" = "200" ] && break
    _i=$((_i + 1)); sleep 2
  done
  case "$_code" in
    200) ok "匿名只读已生效：/api/search 返回 200" ;;
    401) die "仍是 401 —— 配置没生效，检查是否改到了 Grafana 真正加载的配置文件" ;;
    *)   die "意外状态码 ${_code:-无响应}，确认 $GRAFANA_URL 是否是 Grafana 根地址" ;;
  esac

  _hdr="$(curl -s -m 5 -I "$GRAFANA_URL/login" | tr -d '\r' | grep -i '^x-frame-options' || true)"
  if [ -z "$_hdr" ]; then
    ok "响应头无 X-Frame-Options，允许被 iframe 嵌套"
  else
    die "仍带 $_hdr —— allow_embedding 没生效"
  fi
  say ""
  say "全部就绪，回 Evermodel Ops 的 /grafana 页面刷新即可。"
}

# ===========================================================================
# 1) K8s：改 ConfigMap 再滚动重启
# ===========================================================================
if [ -z "$K8S_DEPLOY" ] && command -v kubectl >/dev/null 2>&1; then
  if kubectl get deploy -A 2>/dev/null | grep -qi grafana; then
    _line="$(kubectl get deploy -A 2>/dev/null | grep -i grafana | head -1)"
    _ns="$(printf '%s' "$_line" | awk '{print $1}')"
    _dp="$(printf '%s' "$_line" | awk '{print $2}')"
    K8S_NS="${K8S_NS:-$_ns}"; K8S_DEPLOY="${K8S_DEPLOY:-$_dp}"
  fi
fi

if [ -n "$K8S_DEPLOY" ]; then
  say "检测到 K8s 部署：ns=$K8S_NS deploy=$K8S_DEPLOY"
  _cm="$(kubectl -n "$K8S_NS" get deploy "$K8S_DEPLOY" -o jsonpath='{range .spec.template.spec.volumes[*]}{.configMap.name}{"\n"}{end}' | grep -i grafana | head -1)"
  [ -n "$_cm" ] || die "没找到挂载的 grafana configMap，请手工确认 ini 是怎么进容器的"
  say "  configMap = $_cm（key 见下）"
  _cur="$(kubectl -n "$K8S_NS" get cm "$_cm" -o json | sed -n 's/.*"grafana.ini": "\(.*\)".*/\1/p' | head -1)"
  say "  当前 ini 里 allow_embedding 相关行："
  kubectl -n "$K8S_NS" get cm "$_cm" -o go-template='{{index .data "grafana.ini"}}' 2>/dev/null | grep -n -E 'allow_embedding|\[auth.anonymous\]|^;?enabled|org_role' | sed 's/^/    /' || true

  if [ "$DRY_RUN" = "1" ]; then
    say "  [dry-run] 将给 configMap $_cm 打补丁并 rollout restart，未执行。"
    exit 0
  fi
  _tmpd="$(mktemp -d)"
  kubectl -n "$K8S_NS" get cm "$_cm" -o go-template='{{index .data "grafana.ini"}}' > "$_tmpd/grafana.ini"
  patch_ini_file "$_tmpd/grafana.ini" 0 "configMap $_K8S_NS/$_cm (grafana.ini)"
  if [ "$_CHANGED" = "0" ]; then
    rm -rf "$_tmpd"
    say "  configMap 无需变更，跳过 apply 与 rollout restart"
    verify
    exit 0
  fi
  kubectl -n "$K8S_NS" create cm "$_cm" --from-file=grafana.ini="$_tmpd/grafana.ini" \
    --dry-run=client -o yaml | kubectl -n "$K8S_NS" apply -f -
  rm -rf "$_tmpd"
  kubectl -n "$K8S_NS" rollout restart deploy "$K8S_DEPLOY"
  kubectl -n "$K8S_NS" rollout status deploy "$K8S_DEPLOY" --timeout=180s
  verify
  exit 0
fi

# ===========================================================================
# 2) Docker
# ===========================================================================
if command -v docker >/dev/null 2>&1; then
  CONTAINER="$(docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null | grep -i grafana | head -1 | cut -f1 || true)"
  if [ -n "$CONTAINER" ]; then
    say "检测到 docker 容器：$CONTAINER"

    # 若是 compose 起的，提示应该改 compose 而不是容器内（否则重建即丢）
    _labels="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$CONTAINER" 2>/dev/null || true)"
    if [ -n "$_labels" ] && [ "$_labels" != "<no value>" ]; then
      warn "这个容器由 docker compose 管理（$_labels）"
      warn "下面的修改在容器重建后会丢失，建议同时把环境变量写进 compose/env："
      warn "  GF_SECURITY_ALLOW_EMBEDDING=true / GF_AUTH_ANONYMOUS_ENABLED=true / GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer"
    fi

    # 若 ini 是从宿主机 bind mount 进来的，直接改宿主文件，容器重建也不丢
    _src="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/grafana/grafana.ini"}}{{.Source}}{{end}}{{end}}' "$CONTAINER" 2>/dev/null || true)"
    if [ -n "$_src" ]; then
      say "  ini 来自宿主机 bind mount：$_src"
      if [ "$DRY_RUN" = "1" ]; then patch_ini_file "$_src" 1; exit 0; fi
      patch_ini_file "$_src" 0
      _restart_if_changed
    else
      say "  ini 在容器内：$INI_PATH（容器重建会丢失，建议改用挂载或环境变量）"
      # 用管道读写而不是 docker cp：docker cp 的宿主路径在 Git Bash 下会被路径转换搞坏
      _tmpi="$(mktemp)"
      docker exec -u 0 "$CONTAINER" cat "$INI_PATH" > "$_tmpi"
      patch_ini_file "$_tmpi" "$DRY_RUN" "$CONTAINER:$INI_PATH"
      if [ "$DRY_RUN" = "1" ]; then
        rm -f "$_tmpi"
        exit 0
      fi
      if [ "$_CHANGED" = "1" ]; then
        docker exec -i -u 0 "$CONTAINER" sh -c \
          "cat > '$INI_PATH.new' && mv -f '$INI_PATH.new' '$INI_PATH'" < "$_tmpi"
      fi
      rm -f "$_tmpi"
      _restart_if_changed
    fi
    verify
    exit 0
  fi
  say "本机 docker 里没有运行中的 grafana 容器，继续探测裸机安装。"
fi

# ===========================================================================
# 3) 裸机 systemd
# ===========================================================================
if command -v systemctl >/dev/null 2>&1 && systemctl list-units --type=service 2>/dev/null | grep -q grafana; then
  say "检测到 systemd 服务 grafana-server"
  [ "$(id -u)" = "0" ] || die "需要 root 权限修改 $INI_PATH 并重启服务，请用 sudo 重新执行"
  if [ "$DRY_RUN" = "1" ]; then patch_ini_file "$INI_PATH" 1; exit 0; fi
  patch_ini_file "$INI_PATH" 0
  if [ "$_CHANGED" = "1" ]; then
    systemctl restart grafana-server
  else
    say "  配置无需变更，跳过重启"
  fi
  verify
  exit 0
fi

die "没识别出 Grafana 的部署方式（K8s / docker / systemd 都没命中）。请手工改 $INI_PATH 后重启，或带上 --ini 参数指定实际路径。"
