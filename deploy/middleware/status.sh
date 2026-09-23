#!/usr/bin/env bash
# 中间件 - 状态
set -euo pipefail
cd "$(dirname "$0")"
docker compose ps
