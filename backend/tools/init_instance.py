import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
from django.core.management import call_command


def main():
    parser = argparse.ArgumentParser(description='Initialize an Evermodel Ops instance')
    parser.add_argument('--admin-user', default='admin')
    # 密码可选：admin 已存在时不需要；admin 不存在时必须提供，否则无法创建
    parser.add_argument('--admin-password', default=None)
    parser.add_argument('--admin-name', default='Administrator')
    args = parser.parse_args()

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evermodel_ops.settings')
    django.setup()

    from django.conf import settings
    from apps.account.models import User
    from apps.setting.models import KEYS_DEFAULT, Setting

    if settings.DATABASES['default']['ENGINE'] != 'django.db.backends.mysql':
        raise RuntimeError('MySQL is required; check EVERMODEL_MYSQL_* configuration')

    call_command('updatedb')
    for key, value in KEYS_DEFAULT.items():
        Setting.objects.get_or_create(key=key, defaults={'value': json.dumps(value)})

    user = User.objects.filter(username=args.admin_user).first()
    if user:
        print(f'Administrator {args.admin_user!r} already exists; password unchanged')
    else:
        if not args.admin_password:
            raise RuntimeError(
                f'Administrator {args.admin_user!r} does not exist; '
                '--admin-password is required to create one'
            )
        User.objects.create(
            username=args.admin_user,
            password_hash=User.make_password(args.admin_password),
            nickname=args.admin_name,
            is_supper=True,
            is_active=True,
        )
        print(f'Created administrator {args.admin_user!r}')

    print('Instance initialization completed')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Initialization failed: {exc}', file=sys.stderr)
        raise
