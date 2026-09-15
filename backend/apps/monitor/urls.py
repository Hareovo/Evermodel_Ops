# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.urls import path

from .views import *

urlpatterns = [
    path('', DetectionView.as_view()),
    path('overview/', get_overview),
    path('test/', run_test),
]
