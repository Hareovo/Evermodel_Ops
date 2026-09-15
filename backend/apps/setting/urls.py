# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
# from django.urls import path
from django.urls import path
from apps.setting.views import *
from apps.setting.apis import get_apis
from apps.setting.grafana import get_grafana
from apps.setting.user import UserSettingView

urlpatterns = [
    path('', SettingView.as_view()),
    path('user/', UserSettingView.as_view()),
    path('apis/', get_apis),
    path('grafana/', get_grafana),
    path('email_test/', email_test),
]
