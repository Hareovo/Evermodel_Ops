# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.db import connections
from django.conf import settings
from apps.account.models import History
from apps.alarm.models import Alarm
from apps.schedule.models import Task, History as TaskHistory
from apps.exec.models import ExecHistory, Transfer
from libs.utils import human_date
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path
import time
import shutil
import subprocess


def auto_run_by_day():
    try:
        date_30 = human_date(datetime.now() - timedelta(days=30))
        History.objects.filter(created_at__lt=date_30).delete()
        Alarm.objects.filter(created_at__lt=date_30).delete()

        timer = defaultdict(int)
        for item in ExecHistory.objects.all():
            if timer[item.user_id] >= 10:
                item.delete()
            else:
                timer[item.user_id] += 1

        timer = defaultdict(int)
        for item in Transfer.objects.all():
            if timer[item.user_id] >= 10:
                item.delete()
            else:
                timer[item.user_id] += 1

        for task in Task.objects.all():
            try:
                record = TaskHistory.objects.filter(task_id=task.id)[50]
                TaskHistory.objects.filter(task_id=task.id, id__lt=record.id).delete()
            except IndexError:
                pass

        timestamp = time.time() - 2 * 3600
        transfer_root = Path(settings.TRANSFER_DIR)
        if transfer_root.exists():
            for item in transfer_root.iterdir():
                if item.name != '.gitkeep':
                    if item.stat().st_mtime < timestamp and item.is_dir():
                        transfer_dir = item.resolve()
                        if transfer_root.resolve() not in transfer_dir.parents:
                            continue
                        subprocess.run(['umount', '-f', str(transfer_dir)], stdout=subprocess.DEVNULL,
                                       stderr=subprocess.DEVNULL)
                        shutil.rmtree(transfer_dir, ignore_errors=True)
    finally:
        connections.close_all()
