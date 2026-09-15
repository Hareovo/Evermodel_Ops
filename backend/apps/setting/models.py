# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.conf import settings
from django.db import models
from libs.mixins import ModelMixin
from apps.account.models import User
import json

KEYS_DEFAULT = {
    'verify_ip': True,
    'bind_ip': True,
    'mail_service': {},
    'private_key': None,
    'public_key': None,
    # 监控大屏（Grafana）：{url, timeout, dashboards}
    # 初始值取自 evermodel_ops/overrides.py 的 GRAFANA_*，一旦在「系统管理 / 系统设置 / 监控大屏」
    # 里保存过，就以库里的为准 —— 这样改地址不用再动代码、也不用重启后端。
    'grafana': {
        'url': getattr(settings, 'GRAFANA_URL', '') or '',
        'timeout': getattr(settings, 'GRAFANA_TIMEOUT', 5),
        'dashboards': '',
    },
}


class Setting(models.Model, ModelMixin):
    key = models.CharField(max_length=50, unique=True)
    value = models.TextField()
    desc = models.CharField(max_length=255, null=True)

    def to_view(self):
        tmp = self.to_dict(selects=('key',))
        tmp['value'] = self.real_val
        return tmp

    @property
    def real_val(self):
        if self.value:
            return json.loads(self.value)
        else:
            return KEYS_DEFAULT.get(self.key)

    def __repr__(self):
        return '<Setting %r>' % self.key

    class Meta:
        db_table = 'settings'


class UserSetting(models.Model, ModelMixin):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    key = models.CharField(max_length=32)
    value = models.TextField()

    class Meta:
        db_table = 'user_settings'
        unique_together = ('user', 'key')
