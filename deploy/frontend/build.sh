#!/usr/bin/env bash
# 前端 - 构建：npm run build → frontend/build/
# 失败时旧产物保持原样（nginx 继续伺服旧版本），不会出现半成品站点
set -euo pipefail

APP_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$APP_DIR/frontend"

if [ ! -d node_modules ]; then
  echo "node_modules missing. Run deploy/frontend/install.sh first." >&2
  exit 1
fi

echo "==> 构建前端（npm run build）"
npm run build

# 校验产物
if [ ! -f build/index.html ]; then
  echo "构建异常：build/index.html 不存在" >&2
  exit 1
fi

echo
echo "==> 构建完成。产物在 frontend/build/"
echo "    nginx 容器挂载该目录，浏览器 Ctrl+F5 强刷即可看到新版本。"
