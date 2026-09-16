# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.views.generic import View
from django.conf import settings
from django.db import close_old_connections
from django_redis import get_redis_connection
from apps.exec.models import Transfer
from apps.host.models import Host
from apps.setting.utils import AppSetting
from libs import json_response, JsonParser, Argument
from libs.utils import str_decode, human_seconds_time
from libs.locale import get_request_language, translate_console
from concurrent import futures
from threading import Thread
import subprocess
import tempfile
import uuid
import json
import time
import os
import shutil
import shlex
from pathlib import Path


class TransferView(View):
    def get(self, request):
        records = Transfer.objects.filter(user=request.user)
        return json_response([x.to_view() for x in records])

    def delete(self, request):
        """手动清除分发记录。带 id 删单条，带 all=true 清空当前账户全部记录。"""
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('all', type=bool, required=False, help='参数错误')
        ).parse(request.GET)
        if error is None:
            records = Transfer.objects.filter(user=request.user)
            if form.all:
                records.delete()
            elif form.id:
                records.filter(pk=form.id).delete()
            else:
                error = '请指定要清除的分发记录'
        return json_response(error=error)

    def post(self, request):
        data = request.POST.get('data')
        form, error = JsonParser(
            Argument('host', required=False),
            Argument('dst_dir', help='请输入目标路径'),
            Argument('host_ids', type=list, filter=lambda x: len(x), help='请选择目标主机'),
        ).parse(data)
        if error is None:
            host_id = None
            token = uuid.uuid4().hex
            base_dir = os.path.join(settings.TRANSFER_DIR, token)
            if form.host:
                host_id, path = json.loads(form.host)
                if not path.strip('/'):
                    return json_response(error='请输入正确的数据源路径')
                host = Host.objects.get(pk=host_id)
                with host.get_ssh() as ssh:
                    code, _ = ssh.exec_command_raw(f'[ -d {path} ]')
                    if code != 0:
                        return json_response(error='数据源路径必须为该主机上已存在的目录')
                os.makedirs(base_dir)
                with tempfile.NamedTemporaryFile(mode='w') as fp:
                    fp.write(host.pkey or AppSetting.get('private_key'))
                    fp.flush()
                    target = f'{host.username}@{host.hostname}:{path}'
                    ssh_command = f'ssh -p {host.port} -i {fp.name}'
                    command = ['sshfs', '-o', 'ro', '-o', f'ssh_command={ssh_command}', target, base_dir]
                    task = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                    if task.returncode != 0:
                        _cleanup_transfer_dir(base_dir, mounted=True)
                        return json_response(error=task.stdout.decode(errors='replace'))
            else:
                os.makedirs(base_dir)
                index = 0
                while True:
                    file = request.FILES.get(f'file{index}')
                    if not file:
                        break
                    filename = os.path.basename(file.name)
                    if not filename or filename in ('.', '..'):
                        return json_response(error='非法文件名')
                    target = (Path(base_dir).resolve() / filename).resolve()
                    if Path(base_dir).resolve() not in target.parents:
                        return json_response(error='非法文件名')
                    with open(target, 'wb') as f:
                        for chunk in file.chunks():
                            f.write(chunk)
                    index += 1
            Transfer.objects.create(
                user=request.user,
                digest=token,
                host_id=host_id,
                src_dir=base_dir,
                dst_dir=form.dst_dir,
                host_ids=json.dumps(form.host_ids),
            )
            return json_response(token)
        return json_response(error=error)

    def patch(self, request):
        form, error = JsonParser(
            Argument('token', help='参数错误')
        ).parse(request.body)
        if error is None:
            task = Transfer.objects.filter(digest=form.token, user=request.user).first()
            if not task:
                return json_response(error='未找到指定分发任务')
            Thread(target=_dispatch_sync, args=(task, get_request_language(request))).start()
        return json_response(error=error)


def _cleanup_transfer_dir(path, mounted=False):
    root = Path(settings.TRANSFER_DIR).resolve()
    target = Path(path).resolve()
    if root not in target.parents or target == root:
        return
    if mounted:
        subprocess.run(['umount', '-f', str(target)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.rmtree(target, ignore_errors=True)


def _dispatch_sync(task, language='zh'):
    rds = get_redis_connection()
    threads = []
    max_workers = max(10, os.cpu_count() * 5)
    with futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        for host in Host.objects.filter(id__in=json.loads(task.host_ids)):
            t = executor.submit(_do_sync, rds, task, host, language)
            t.token = task.digest
            t.key = host.id
            threads.append(t)
        for t in futures.as_completed(threads):
            exc = t.exception()
            if exc:
                rds.publish(
                    t.token,
                    json.dumps({'key': t.key, 'status': -1, 'data': f'\x1b[31mException: {exc}\x1b[0m'})
                )
    _cleanup_transfer_dir(task.src_dir, mounted=bool(task.host_id))
    close_old_connections()


def _do_sync(rds, task, host, language='zh'):
    token = task.digest
    rds.publish(token, json.dumps({'key': host.id, 'data': '\r\n\x1b[36m### Executing ...\x1b[0m\r\n'}))
    with tempfile.NamedTemporaryFile(mode='w') as fp:
        fp.write(host.pkey or AppSetting.get('private_key'))
        fp.write('\n')
        fp.flush()

        flag = time.time()
        options = ['-azv', '--progress'] if task.host_id else ['-rzv', '--progress']
        dst_dir = task.dst_dir.strip()
        if not dst_dir or any(char in dst_dir for char in '\r\n'):
            raise ValueError('目标路径格式错误')
        target = f'{host.username}@{host.hostname}:{dst_dir}'
        command = [
            'rsync', *options, '-h',
            '-e', f'ssh -p {host.port} -o StrictHostKeyChecking=no -i {fp.name}',
            f'{task.src_dir}/', target,
        ]
        task = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        message = b''
        while True:
            output = task.stdout.read(1)
            if not output:
                break
            if output in (b'\r', b'\n'):
                message += b'\r\n' if output == b'\n' else b'\r'
                message = str_decode(message)
                if 'rsync: command not found' in message:
                    data = translate_console(
                        '\r\n\x1b[31m检测到该主机未安装rsync，可通过批量执行/执行任务模块进行以下命令批量安装\x1b[0m',
                        language)
                    data += '\r\nCentos/Redhat: yum install -y rsync'
                    data += '\r\nUbuntu/Debian: apt install -y rsync'
                    rds.publish(token, json.dumps({'key': host.id, 'data': data}))
                    break
                rds.publish(token, json.dumps({'key': host.id, 'data': message}))
                message = b''
            else:
                message += output
        status = task.wait()
        if status == 0:
            human_time = human_seconds_time(time.time() - flag)
            data = translate_console(f'\r\n\x1b[32m** 分发完成，总耗时：{human_time} **\x1b[0m', language)
            rds.publish(token, json.dumps({'key': host.id, 'data': data}))
        rds.publish(token, json.dumps({'key': host.id, 'status': task.wait()}))
