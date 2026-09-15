# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.views.generic import View


# 混入类，提供Model实例to_dict方法
class ModelMixin(object):
    __slots__ = ()

    def to_dict(self, excludes: tuple = None, selects: tuple = None) -> dict:
        if not hasattr(self, '_meta'):
            raise TypeError('<%r> does not a django.db.models.Model object.' % self)
        elif selects:
            return {f: getattr(self, f) for f in selects}
        elif excludes:
            return {f.attname: getattr(self, f.attname) for f in self._meta.fields if f.attname not in excludes}
        else:
            return {f.attname: getattr(self, f.attname) for f in self._meta.fields}

    def update_by_dict(self, data):
        for key, value in data.items():
            setattr(self, key, value)
        self.save()
