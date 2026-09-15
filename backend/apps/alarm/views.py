# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.views.generic import View
from libs import json_response, JsonParser, Argument
from libs.notify import Notification
from apps.alarm.models import Alarm, Group, Contact
from apps.monitor.models import Detection
import json


class AlarmView(View):
    def get(self, request):
        alarms = Alarm.objects.all()
        return json_response(alarms)


class GroupView(View):
    def get(self, request):
        groups = Group.objects.all()
        return json_response(groups)

    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', help='请输入组名'),
            Argument('contacts', type=list, help='请选择联系人'),
            Argument('desc', required=False)
        ).parse(request.body)
        if error is None:
            form.contacts = json.dumps(form.contacts)
            if form.id:
                Group.objects.filter(pk=form.id).update(**form)
            else:
                form.created_by = request.user
                Group.objects.create(**form)
        return json_response(error=error)

    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定操作对象')
        ).parse(request.GET)
        if error is None:
            detection = Detection.objects.filter(notify_grp__regex=fr'[^0-9]{form.id}[^0-9]').first()
            if detection:
                return json_response(error=f'监控任务【{detection.name}】正在使用该报警组，请解除关联后再尝试删除该联系组')
            Group.objects.filter(pk=form.id).delete()
        return json_response(error=error)


class ContactView(View):
    def get(self, request):
        contacts = Contact.objects.all()
        return json_response(contacts)

    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', help='请输入联系人姓名'),
            Argument('phone', required=False),
            Argument('email', required=False),
            Argument('ding', required=False),
            Argument('qy_wx', required=False),
            Argument('feishu', required=False),
            Argument('secret', required=False),
        ).parse(request.body)
        if error is None:
            if form.id:
                Contact.objects.filter(pk=form.id).update(**form)
            else:
                form.created_by = request.user
                Contact.objects.create(**form)
        return json_response(error=error)

    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定操作对象')
        ).parse(request.GET)
        if error is None:
            group = Group.objects.filter(contacts__contains=f'\"{form.id}\"').first()
            if group:
                return json_response(error=f'报警联系组【{group.name}】包含此联系人，请解除关联后再尝试删除该联系人')
            Contact.objects.filter(pk=form.id).delete()
        return json_response(error=error)


def handle_test(request):
    form, error = JsonParser(
        Argument('mode', help='参数错误'),
        Argument('value', help='参数错误'),
        # 机器人开启加签时前端会一并传来，未开启则为空
        Argument('secret', required=False),
    ).parse(request.body)
    if error is None:
        notify = Notification(None, '1', 'Evermodel Ops', 'Evermodel Ops（测试）', '这是一条测试告警信息', None)

        if form.mode == '3':
            notify.monitor_by_dd([(form.value, form.secret)])
        elif form.mode == '4':
            notify.monitor_by_email([form.value])
        elif form.mode == '5':
            notify.monitor_by_qy_wx([form.value])
        elif form.mode == '7':
            notify.monitor_by_fs([(form.value, form.secret)])
        else:
            return json_response(error='不支持的报警方式')
    return json_response(error=error)
