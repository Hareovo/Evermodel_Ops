# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.core.cache import cache
from django.conf import settings
from django.views.generic import View
from libs import JsonParser, Argument, human_datetime, json_response
from libs.utils import get_request_real_ip
from apps.account.models import User, History
from apps.setting.utils import AppSetting
from apps.account.utils import verify_password
from functools import partial
import user_agents
import ipaddress
import time
import uuid


class UserView(View):
    def get(self, request):
        users = []
        for u in User.objects.filter(is_deleted=False):
            tmp = u.to_dict(excludes=('access_token', 'password_hash'))
            tmp['password'] = '******'
            users.append(tmp)
        return json_response(users)

    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('username', help='请输入登录名'),
            Argument('password', help='请输入密码'),
            Argument('nickname', help='请输入姓名'),
        ).parse(request.body)
        if error is None:
            user = User.objects.filter(username=form.username, is_deleted=False).first()
            if user and (not form.id or form.id != user.id):
                return json_response(error=f'已存在登录名为【{form.username}】的用户')

            password = form.pop('password')
            if form.id:
                user = User.objects.get(pk=form.id)
                user.update_by_dict(form)
            else:
                if not verify_password(password):
                    return json_response(error='请设置至少8位包含数字、小写和大写字母的新密码')
                form.password_hash = User.make_password(password)
                User.objects.create(**form)
        return json_response(error=error)

    def patch(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='参数错误'),
            Argument('password', required=False),
            Argument('is_active', type=bool, required=False),
        ).parse(request.body)
        if error is None:
            user = User.objects.get(pk=form.id)
            if form.password:
                if not verify_password(form.password):
                    return json_response(error='请设置至少8位包含数字、小写和大写字母的新密码')
                user.token_expired = 0
                user.password_hash = User.make_password(form.password)
            if form.is_active is not None:
                user.is_active = form.is_active
                cache.delete(user.username)
            user.save()
        return json_response(error=error)

    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定操作对象')
        ).parse(request.GET)
        if error is None:
            user = User.objects.filter(pk=form.id).first()
            if user:
                if user.id == request.user.id:
                    return json_response(error='无法删除当前登录账户')
                user.is_active = True
                user.is_deleted = True
                user.save()
        return json_response(error=error)


class SelfView(View):
    def get(self, request):
        data = request.user.to_dict(selects=('nickname',))
        return json_response(data)

    def patch(self, request):
        form, error = JsonParser(
            Argument('old_password', required=False),
            Argument('new_password', required=False),
            Argument('nickname', required=False, help='请输入昵称'),
        ).parse(request.body)
        if error is None:
            if form.old_password and form.new_password:
                if not verify_password(form.new_password):
                    return json_response(error='请设置至少8位包含数字、小写和大写字母的新密码')

                if request.user.verify_password(form.old_password):
                    request.user.password_hash = User.make_password(form.new_password)
                    request.user.token_expired = 0
                    request.user.save()
                    return json_response()
                else:
                    return json_response(error='原密码错误，请重新输入')
            if form.nickname is not None:
                request.user.nickname = form.nickname
            request.user.save()
        return json_response(error=error)


def login(request):
    form, error = JsonParser(
        Argument('username', help='请输入用户名'),
        Argument('password', help='请输入密码'),
        Argument('type', required=False)
    ).parse(request.body)
    if error is None:
        handle_response = partial(handle_login_record, request, form.username, form.type)
        user = User.objects.filter(username=form.username, type=form.type, is_deleted=False).first()
        if user and not user.is_active:
            return handle_response(error="账户已被系统禁用")
        if user and user.verify_password(form.password):
            return handle_user_info(handle_response, request, user)

        value = cache.get_or_set(form.username, 0, 86400)
        if value >= 3:
            if user and user.is_active:
                user.is_active = False
                user.save()
            return handle_response(error='账户已被系统禁用')
        cache.set(form.username, value + 1, 86400)
        return handle_response(error="用户名或密码错误，连续多次错误账户将会被禁用")
    return json_response(error=error)


def handle_login_record(request, username, login_type, error=None):
    x_real_ip = get_request_real_ip(request.headers)
    user_agent = user_agents.parse(request.headers.get('User-Agent'))
    History.objects.create(
        username=username,
        type=login_type or 'default',
        ip=x_real_ip,
        agent=user_agent,
        is_success=False if error else True,
        message=error
    )
    if error:
        return json_response(error=error)


def handle_user_info(handle_response, request, user):
    cache.delete(user.username)
    handle_response()
    x_real_ip = get_request_real_ip(request.headers)
    token_isvalid = user.access_token and len(user.access_token) == 32 and user.token_expired >= time.time()
    user.access_token = user.access_token if token_isvalid else uuid.uuid4().hex
    user.token_expired = time.time() + settings.TOKEN_TTL
    user.last_login = human_datetime()
    user.last_ip = x_real_ip
    user.save()
    verify_ip = AppSetting.get_default('verify_ip', True)
    return json_response({
        'id': user.id,
        'access_token': user.access_token,
        'nickname': user.nickname,
        'has_real_ip': x_real_ip and ipaddress.ip_address(x_real_ip).is_global if verify_ip else True,
    })


def logout(request):
    request.user.token_expired = 0
    request.user.save()
    return json_response()
