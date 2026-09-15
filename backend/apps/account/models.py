# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.db import models
from libs import ModelMixin
from django.contrib.auth.hashers import make_password, check_password


class User(models.Model, ModelMixin):
    username = models.CharField(max_length=100)
    nickname = models.CharField(max_length=100)
    password_hash = models.CharField(max_length=100)  # hashed password
    type = models.CharField(max_length=20, default='default')
    is_supper = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    access_token = models.CharField(max_length=32)
    token_expired = models.IntegerField(null=True)
    last_login = models.CharField(max_length=20)
    last_ip = models.CharField(max_length=50)
    wx_token = models.CharField(max_length=50, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def make_password(password):
        return make_password(password, hasher='pbkdf2_sha256')

    def verify_password(self, password):
        return check_password(password, self.password_hash)

    def __repr__(self):
        return '<User %r>' % self.username

    class Meta:
        db_table = 'users'
        ordering = ('-id',)


class History(models.Model, ModelMixin):
    username = models.CharField(max_length=100, null=True)
    type = models.CharField(max_length=20, default='default')
    ip = models.CharField(max_length=50)
    agent = models.CharField(max_length=255, null=True)
    message = models.CharField(max_length=255, null=True)
    is_success = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'login_histories'
        ordering = ('-id',)
