#!/usr/bin/env bash
# 前端 - 更新流程：装依赖（如有变化）→ 构建
# 假设调用者已在 git pull 之后
set -euo pipefail

DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "==> [1/2] 装/更新前端依赖"
bash "$DEPLOY_DIR/frontend/install.sh"

echo
echo "==> [2/2] 构建前端"
bash "$DEPLOY_DIR/frontend/build.sh"

echo
echo "==> 前端更新完成，浏览器 Ctrl+F5 强刷查看"
