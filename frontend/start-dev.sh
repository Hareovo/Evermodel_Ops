# 启动前端开发服务器(CRA dev server)
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "node_modules not found, run npm install first"
  exit 1
fi

exec npx react-app-rewired start