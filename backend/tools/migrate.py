import django
import os
import re
import shutil
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "evermodel_ops.settings")
django.setup()

from django.conf import settings


class Version:
    def __init__(self, version):
        parts = re.sub(r'[^0-9.]', '', version).strip('.').split('.')
        self.version = tuple(int(part or 0) for part in parts)

    def __lt__(self, other):
        if not isinstance(other, Version):
            raise TypeError('required type Version')
        return self.version < other.version


if __name__ == '__main__':
    old_version = Version(sys.argv[1])
    if old_version < Version('v3.0.2'):
        old_path = os.path.join(settings.BASE_DIR, 'repos')
        new_path = os.path.join(settings.REPOS_DIR)
        if not os.path.exists(new_path):
            print('执行 v3.0.1-beta.8 repos目录迁移')
            shutil.move(old_path, new_path)
            task = subprocess.Popen(f'cd {settings.BASE_DIR} && git checkout -- repos', shell=True)
            if task.wait() != 0:
                print('repos目录迁移失败，请联系官方人员')
