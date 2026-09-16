# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.views.generic import View
from django_redis import get_redis_connection
from django.conf import settings
from libs import json_response, JsonParser, Argument, human_datetime
from libs.locale import get_request_language
from apps.exec.models import ExecTemplate, ExecHistory
from apps.host.models import Host
import uuid
import json
import os


class TemplateView(View):
    def get(self, request):
        templates = ExecTemplate.objects.all()
        types = [x['type'] for x in templates.order_by('type').values('type').distinct()]
        return json_response({'types': types, 'templates': [x.to_view() for x in templates]})

    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', help='请输入模版名称'),
            Argument('type', help='请选择模版类型'),
            Argument('body', help='请输入模版内容'),
            Argument('interpreter', default='sh'),
            Argument('host_ids', type=list, handler=json.dumps, default=[]),
            Argument('parameters', type=list, handler=json.dumps, default=[]),
            Argument('desc', required=False)
        ).parse(request.body)
        if error is None:
            if form.id:
                form.updated_at = human_datetime()
                form.updated_by = request.user
                ExecTemplate.objects.filter(pk=form.pop('id')).update(**form)
            else:
                form.created_by = request.user
                ExecTemplate.objects.create(**form)
        return json_response(error=error)

    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定操作对象')
        ).parse(request.GET)
        if error is None:
            ExecTemplate.objects.filter(pk=form.id).delete()
        return json_response(error=error)


class TaskView(View):
    def get(self, request):
        records = ExecHistory.objects.filter(user=request.user).select_related('template')
        return json_response([x.to_view() for x in records])

    def delete(self, request):
        """手动清除执行记录。带 id 删单条，带 all=true 清空当前账户全部记录。"""
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('all', type=bool, required=False, help='参数错误')
        ).parse(request.GET)
        if error is None:
            records = ExecHistory.objects.filter(user=request.user)
            if form.all:
                records.delete()
            elif form.id:
                records.filter(pk=form.id).delete()
            else:
                error = '请指定要清除的执行记录'
        return json_response(error=error)

    def post(self, request):
        form, error = JsonParser(
            Argument('host_ids', type=list, filter=lambda x: len(x), help='请选择执行主机'),
            Argument('command', help='请输入执行命令内容'),
            Argument('interpreter', default='sh'),
            Argument('template_id', type=int, required=False),
            Argument('params', type=dict, handler=json.dumps, default={})
        ).parse(request.body)
        if error is None:
            token = uuid.uuid4().hex
            form.host_ids.sort()
            if form.template_id:
                template = ExecTemplate.objects.filter(pk=form.template_id).first()
                if not template or template.body != form.command:
                    form.template_id = None

            ExecHistory.objects.create(
                user=request.user,
                digest=token,
                interpreter=form.interpreter,
                template_id=form.template_id,
                command=form.command,
                host_ids=json.dumps(form.host_ids),
                params=form.params
            )
            return json_response(token)
        return json_response(error=error)

    def patch(self, request):
        form, error = JsonParser(
            Argument('token', help='参数错误'),
            Argument('cols', type=int, required=False),
            Argument('rows', type=int, required=False)
        ).parse(request.body)
        if error is None:
            term = None
            if form.cols and form.rows:
                term = {'width': form.cols, 'height': form.rows}
            rds = get_redis_connection()
            task = ExecHistory.objects.filter(digest=form.token, user=request.user).first()
            if not task:
                return json_response(error='未找到指定执行任务')
            for host in Host.objects.filter(id__in=json.loads(task.host_ids)):
                data = dict(
                    key=host.id,
                    name=host.name,
                    token=task.digest,
                    interpreter=task.interpreter,
                    hostname=host.hostname,
                    port=host.port,
                    username=host.username,
                    command=task.command,
                    pkey=host.private_key,
                    params=json.loads(task.params),
                    term=term,
                    language=get_request_language(request),
                )
                rds.rpush(settings.EXEC_WORKER_KEY, json.dumps(data))
        return json_response(error=error)


def handle_terminate(request):
    form, error = JsonParser(
        Argument('token', help='参数错误'),
        Argument('target', required=False)
    ).parse(request.body)
    if error is None:
        rds = get_redis_connection()
        # exec/batch 批量执行把原始 pid 存于 key 'PID:{token}:{target}'
        rds_key = f'PID:{form.token}:{form.target}' if form.target is not None else form.token
        pid_str = rds.get(rds_key)
        if not pid_str:
            return json_response(error='未找到关联进程')
        pid_str = pid_str.decode()
        if '.' in pid_str:
            target, pid = pid_str.split('.', 1)
        else:
            target, pid = str(form.target), pid_str
        if target.isdigit():
            host = Host.objects.get(pk=target)
            with host.get_ssh() as ssh:
                ssh.terminate(pid)
        elif target == 'local':
            try:
                os.killpg(os.getpgid(int(pid)), 9)
            except ProcessLookupError:
                pass  # 进程已自行退出，视为终止成功，继续清理 redis 键
        else:
            return json_response(error='未找到关联进程')
        rds.delete(rds_key)
    return json_response(error=error)
