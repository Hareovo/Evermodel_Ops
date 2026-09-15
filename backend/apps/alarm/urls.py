# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.urls import path

from .views import *

urlpatterns = [
    path('alarm/', AlarmView.as_view()),
    path('group/', GroupView.as_view()),
    path('contact/', ContactView.as_view()),
    path('test/', handle_test),
]
