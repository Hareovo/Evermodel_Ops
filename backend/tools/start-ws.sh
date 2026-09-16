#!/bin/bash
# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
# start websocket service

cd $(dirname $(dirname $0))
if [ -f ./venv/bin/activate ]; then
  source ./venv/bin/activate
fi
exec daphne -b "${EVERMODEL_WS_HOST:-0.0.0.0}" -p "${EVERMODEL_WS_PORT:-9002}" evermodel_ops.asgi:application
