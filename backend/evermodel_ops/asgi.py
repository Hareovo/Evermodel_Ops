# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
"""
ASGI config for evermodel_ops project.

Exposes both the HTTP application and the websocket routes defined in
consumer.routing, so `daphne evermodel_ops.asgi:application` serves websockets.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evermodel_ops.settings')

# get_asgi_application() calls django.setup(); it must run before importing
# anything that touches models (consumer.routing imports consumers/models).
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter  # noqa: E402
from consumer import routing  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': routing.ws_router,
})
