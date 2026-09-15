# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from libs.mixins import View
from libs import json_response
from apps.account.models import History


class HistoryView(View):
    def get(self, request):
        histories = History.objects.all()
        return json_response(histories)
