#!/bin/bash
# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
# start api service

cd $(dirname $(dirname $0))
if [ -f ./venv/bin/activate ]; then
  source ./venv/bin/activate
fi
exec gunicorn -b "${EVERMODEL_API_HOST:-0.0.0.0}:${EVERMODEL_API_PORT:-9001}" -w 2 --threads 8 --access-logfile - evermodel_ops.wsgi
