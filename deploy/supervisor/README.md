# 后端 5 进程托管（supervisor + systemd）

Evermodel Ops 的后端**不是单个进程**，而是 **5 个常驻进程**。少起任何一个，都会出现
「平台能打开但功能不工作」的假象。本目录就是这 5 个进程的托管配置。

---

## 一、目录内容

| 文件 | 安装到 | 作用 |
|---|---|---|
| `supervisord.conf` | `/etc/evermodel_ops/supervisord.conf` | supervisord 主配置（unix socket、日志、include conf.d） |
| `evermodel_ops.conf` | `/etc/evermodel_ops/conf.d/evermodel_ops.conf` | 5 个 `[program:*]` 定义（含 `__APP_DIR__` 占位符） |
| `evermodel_ops.service` | `/etc/systemd/system/evermodel_ops.service` | systemd 单元，守护 supervisord 本体 |

**层级关系**：

```
systemd  evermodel_ops.service          ← 守护「supervisord 本体」，挂了 5 秒后重拉
  └── supervisord -n                    ← 前台运行，负责拉起/监控/重启下面 5 个
        ├── evermodel_ops-api           gunicorn  :9001
        ├── evermodel_ops-ws            daphne    :9002
        ├── evermodel_ops-worker        runworker
        ├── evermodel_ops-monitor       runmonitor
        └── evermodel_ops-scheduler     runscheduler
```

为什么不让 systemd 直接管 5 个进程：这 5 个进程共享同一套 venv、同一批环境变量与
运行目录，用 supervisor 统一管理后，**加/减进程、看日志、批量重启**都是一句话的事
（`supervisorctl update` / `restart all`）。systemd 只负责「supervisord 不许死」。

## 二、安装（手工，5 步）

本目录**只有配置文件、没有安装脚本** —— 按下面步骤逐条执行即可，全部可复制粘贴。
下文用 `APP_DIR` 代表部署路径，按实际改（例句取 `/data/evermodel_ops`）。

```bash
APP_DIR=/data/evermodel_ops

# ① 装 supervisor（已装可跳过）
sudo apt update && sudo apt install -y supervisor

# ② 建运行目录 —— ⚠️ 必须做，理由见下方
sudo mkdir -p "$APP_DIR/backend/logs"
sudo mkdir -p /etc/evermodel_ops/conf.d /var/log/evermodel_ops

# ③ 装主配置与程序定义（把 __APP_DIR__ 占位符换成实际路径）
sudo install -m 0644 "$APP_DIR/deploy/supervisor/supervisord.conf" \
  /etc/evermodel_ops/supervisord.conf
sed "s|__APP_DIR__|$APP_DIR|g" "$APP_DIR/deploy/supervisor/evermodel_ops.conf" \
  | sudo tee /etc/evermodel_ops/conf.d/evermodel_ops.conf > /dev/null

# ④ 装 systemd 单元
sudo install -m 0644 "$APP_DIR/deploy/supervisor/evermodel_ops.service" \
  /etc/systemd/system/evermodel_ops.service
sudo systemctl daemon-reload

# ⑤ 开机自启并立刻拉起
sudo systemctl enable --now evermodel_ops
```

确认起来：

```bash
sudo systemctl status evermodel_ops --no-pager
supervisorctl -c /etc/evermodel_ops/supervisord.conf status    # 期望 5 个 RUNNING
```

> ⚠️ **`backend/logs` 目录必须存在**（第 ② 步别省）。它不在仓库里 —— 运行期目录，
> `logs/*` 被 gitignore、只保留 `.gitkeep`；而 5 个 `stdout_logfile` 都指向它。
> 目录缺失时 supervisor 打不开日志文件，5 个进程会**全部** `ERROR (spawn error)`。

> 改过 `evermodel_ops.conf`（增删进程、改日志路径）后：`sudo systemctl reload evermodel_ops`。

### 方式 B：用发行版自带的 supervisor.service

不想引入额外的 systemd 单元时，Ubuntu 的 `supervisor` 包自带 `supervisor.service`
（开机自启 + 守护），把程序配置丢进它的 `conf.d` 即可：

```bash
APP_DIR=/data/evermodel_ops
sudo mkdir -p "$APP_DIR/backend/logs"
sed "s|__APP_DIR__|$APP_DIR|g" "$APP_DIR/deploy/supervisor/evermodel_ops.conf" \
  | sudo tee /etc/supervisor/conf.d/evermodel_ops.conf > /dev/null
sudo systemctl enable --now supervisor
sudo supervisorctl reread && sudo supervisorctl update
```

⚠️ 两种方式**不要同时用**，会起两个 supervisord 抢 9001/9002 端口。

---

## 三、5 个服务一览

| supervisor 程序名 | 端口 | 实际执行的命令 | 作用 | 日志 |
|---|---|---|---|---|
| `evermodel_ops-api` | 9001 | `gunicorn -b 127.0.0.1:9001 -w 2 --threads 8 --access-logfile - evermodel_ops.wsgi` | REST API | `logs/api.log` |
| `evermodel_ops-ws` | 9002 | `daphne -p 9002 evermodel_ops.asgi:application` | WebSocket：主机终端、执行实时输出 | `logs/ws.log` |
| `evermodel_ops-worker` | — | `python manage.py runworker` | 批量执行 / 文件分发 / 任务计划 / 监控检测 的**执行器** | `logs/worker.log` |
| `evermodel_ops-monitor` | — | `python manage.py runmonitor` | 监控检测（Ping / 端口 / 进程 / 脚本 / 站点） | `logs/monitor.log` |
| `evermodel_ops-scheduler` | — | `python manage.py runscheduler` | 任务计划调度（Cron 触发） | `logs/scheduler.log` |

命令本体在 `backend/tools/start-*.sh` 里（脚本自己会 `cd` 到 `backend/`
并 `source venv/bin/activate`）。

### 少起进程的症状对照

| 少了谁 | 表现为 |
|---|---|
| `api` | 除登录接口外的**全部**接口 502（nginx 连不上上游 gunicorn） |
| `ws` | 主机终端打不开、批量执行看不到实时输出 |
| `worker` | **批量执行一直停在 `### Waiting for scheduling ...`**；任务计划/监控即使被调度也不执行 |
| `monitor` | 监控项 `latest_run_time` 永远是 NULL，从不检测、从不告警 |
| `scheduler` | 任务计划到点不触发（页面能建、到点不动） |

---

## 四、每个服务的启停命令

下面两种写法等价：
`-c /etc/evermodel_ops/supervisord.conf` 是**必须**的（supervisord 自定制的 socket 路径），
建议先设个别名省事：

```bash
alias evs='supervisorctl -c /etc/evermodel_ops/supervisord.conf'
```

### 4.0 通用速查（写死 5 个名字的全量命令）

```bash
SC=/etc/evermodel_ops/supervisord.conf

# 状态
supervisorctl -c $SC status

# 全部启动 / 停止 / 重启
supervisorctl -c $SC start all
supervisorctl -c $SC stop all
supervisorctl -c $SC restart all

# 改过 evermodel_ops.conf 之后让它生效（按需增删进程，不重启 supervisord 本体）
supervisorctl -c $SC reread && supervisorctl -c $SC update
```

### 4.1 `evermodel_ops-api`（REST API，gunicorn :9001）

```bash
# 启动 / 停止 / 重启
supervisorctl -c /etc/evermodel_ops/supervisord.conf start   evermodel_ops-api
supervisorctl -c /etc/evermodel_ops/supervisord.conf stop    evermodel_ops-api
supervisorctl -c /etc/evermodel_ops/supervisord.conf restart evermodel_ops-api

# 看状态与实时日志
supervisorctl -c /etc/evermodel_ops/supervisord.conf status evermodel_ops-api
supervisorctl -c /etc/evermodel_ops/supervisord.conf tail -f evermodel_ops-api    # Ctrl+C 退出

# 直接看日志文件（50MB 轮转，保留 5 份）
tail -f /data/evermodel_ops/backend/logs/api.log

# 探活（登录接口免鉴权，期望 200）
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9001/account/login/
```

> 改了后端 **Python 代码**：`api` 需要重启才生效（生产不开热重载）。
> **改告警署名一类被多个进程读取的配置时，`api` + `worker` + `monitor` 三个都要重启。**

### 4.2 `evermodel_ops-ws`（WebSocket，daphne :9002）

```bash
supervisorctl -c /etc/evermodel_ops/supervisord.conf start   evermodel_ops-ws
supervisorctl -c /etc/evermodel_ops/supervisord.conf stop    evermodel_ops-ws
supervisorctl -c /etc/evermodel_ops/supervisord.conf restart evermodel_ops-ws

supervisorctl -c /etc/evermodel_ops/supervisord.conf status evermodel_ops-ws
supervisorctl -c /etc/evermodel_ops/supervisord.conf tail -f evermodel_ops-ws
tail -f /data/evermodel_ops/backend/logs/ws.log
```

> WebSocket 鉴权 token 走 **query 参数 `x-token`**（不是 `X-Token` 请求头），
> 且会校验 `X-Real-IP`。nginx 必须透传这两个头，否则 Web 终端连不上。
>
> 若出现「Web 终端连上约 5 秒自动断开」，先查 Redis 客户端配置里的
> `socket_timeout: None` 有没有被改掉（`settings.py` 与 `overrides.py` **两处**都要保留）。

### 4.3 `evermodel_ops-worker`（执行器）

```bash
supervisorctl -c /etc/evermodel_ops/supervisord.conf start   evermodel_ops-worker
supervisorctl -c /etc/evermodel_ops/supervisord.conf stop    evermodel_ops-worker
supervisorctl -c /etc/evermodel_ops/supervisord.conf restart evermodel_ops-worker

supervisorctl -c /etc/evermodel_ops/supervisord.conf status evermodel_ops-worker
supervisorctl -c /etc/evermodel_ops/supervisord.conf tail -f evermodel_ops-worker
tail -f /data/evermodel_ops/backend/logs/worker.log
```

> ⚠️ **`worker` 启动时会清空它消费的 Redis 队列**（防止旧任务乱跑），
> 所以重启后堆积的批量执行/分发任务会**被丢弃**，需要在页面上**重新提交一次**。
>
> 「批量执行停在 `Waiting for scheduling`」= 这个进程没起来，
> 不是脚本问题。查队列堆积情况：
>
> ```bash
> redis-cli -n 1 llen spug:exec:worker
> redis-cli -n 1 llen spug:schedule:worker
> redis-cli -n 1 llen spug:monitor:worker
> ```
>
> ⚠️ 查业务队列必须加 `-n 1`（DB 0 只有 channels 用的 `spug:channel:*`）。

### 4.4 `evermodel_ops-monitor`（监控检测）

```bash
supervisorctl -c /etc/evermodel_ops/supervisord.conf start   evermodel_ops-monitor
supervisorctl -c /etc/evermodel_ops/supervisord.conf stop    evermodel_ops-monitor
supervisorctl -c /etc/evermodel_ops/supervisord.conf restart evermodel_ops-monitor

supervisorctl -c /etc/evermodel_ops/supervisord.conf status evermodel_ops-monitor
supervisorctl -c /etc/evermodel_ops/supervisord.conf tail -f evermodel_ops-monitor
tail -f /data/evermodel_ops/backend/logs/monitor.log
```

> 判定它到底有没有在工作，看数据而不是看进程：
>
> ```bash
> # latest_run_time 为 NULL = 一次都没跑过
> mysql -uroot -p -e "select id, name, latest_run_time from evermodel_ops.monitor_detection limit 10"
> # Redis 里没有 spug:det:<id> 说明检测没被调度
> redis-cli -n 1 keys 'spug:det:*'
> ```
>
> 钉钉/飞书告警是否送达：`notifies` 表**没有**新增 `title = '通知发送失败'` 即视为成功
> （成功分支不落库）。

### 4.5 `evermodel_ops-scheduler`（任务计划调度）

```bash
supervisorctl -c /etc/evermodel_ops/supervisord.conf start   evermodel_ops-scheduler
supervisorctl -c /etc/evermodel_ops/supervisord.conf stop    evermodel_ops-scheduler
supervisorctl -c /etc/evermodel_ops/supervisord.conf restart evermodel_ops-scheduler

supervisorctl -c /etc/evermodel_ops/supervisord.conf status evermodel_ops-scheduler
supervisorctl -c /etc/evermodel_ops/supervisord.conf tail -f evermodel_ops-scheduler
tail -f /data/evermodel_ops/backend/logs/scheduler.log
```

> ⚠️ 与 `worker` 同理：**`scheduler` 启动时会 `delete spug:schedule`**，
> 页面上增删改过的计划列表会被清掉，重启后以页面上的数据重新开始调度。
> 若「改完计划不生效」，确认进程在跑，再重启一次这个服务。

### 4.6 一次重启全部（推荐用于发布后）

```bash
sudo systemctl restart evermodel_ops
# 等价于 supervisorctl -c /etc/evermodel_ops/supervisord.conf restart all
```

---

## 五、systemd 层命令（守护 supervisord 本体）

```bash
sudo systemctl start   evermodel_ops      # 启动整组（拉起 supervisord，它再拉起 5 个）
sudo systemctl stop    evermodel_ops      # 停止整组（优雅停 5 个进程后再退 supervisord）
sudo systemctl restart evermodel_ops      # 重启整组
sudo systemctl reload  evermodel_ops      # 重新读取 conf.d 的程序定义（等价 reread + update）
sudo systemctl status  evermodel_ops      # 看 supervisord 本体状态
sudo systemctl enable  evermodel_ops      # 开机自启（安装时已执行）
sudo systemctl disable evermodel_ops      # 取消开机自启

journalctl -u evermodel_ops -n 100 --no-pager              # supervisord 本体的输出
journalctl -u evermodel_ops -f                             # 实时跟随
tail -f /var/log/evermodel_ops/supervisord.log             # supervisor 自己的日志
```

> 改完 `evermodel_ops.conf`（加进程、改日志路径等）：`sudo systemctl reload evermodel_ops`。
> 改完 `supervisord.conf`（socket、日志级别等）：`sudo systemctl restart evermodel_ops`。

## 六、安装后自检

```bash
# ① 5 个进程是否都 RUNNING
supervisorctl -c /etc/evermodel_ops/supervisord.conf status

# ② 两个端口在不在听
ss -lntp | grep -E ':9001|:9002'

# ③ 直连后端与经 nginx 各探一次（两边都应 200）
#    后端 200 + nginx 502  ⇒ nginx 到上游不通（多半是 9001 没在听）
#    两边都 401            ⇒ 探错接口了，换免鉴权的 /account/login/
curl -s -o /dev/null -w 'backend  %{http_code}\n' http://127.0.0.1:9001/account/login/
curl -s -o /dev/null -w 'nginx    %{http_code}\n' http://127.0.0.1/api/account/login/

# ④ 三个异步队列不该持续堆积（非 0 且不下降 = 对应进程没消费）
redis-cli -n 1 llen spug:exec:worker
redis-cli -n 1 llen spug:monitor
redis-cli -n 1 llen spug:schedule
```

期望：5 个 `RUNNING`、9001/9002 都在听、`backend 401` + `nginx 200`、三个队列接近 0。

## 七、故障速查

| 现象 | 原因与处理 |
|---|---|
| 5 个进程全是 `FATAL` / `ERROR (spawn error)` | **最常见**：`backend/logs/` 不存在或不可写 → `sudo mkdir -p /data/evermodel_ops/backend/logs` 后 `sudo systemctl restart evermodel_ops`。其次看 `supervisord.log` |
| 只有某一个反复 `BACKOFF` | 该进程自己的启动命令有问题：手动跑一次它的 `start-*.sh`，报错会直接打在屏幕上 |
| `supervisorctl: unix:///... refused connection` | supervisord 本体没在跑（`systemctl status evermodel_ops`），或 `-c` 指的配置不对 |
| `systemctl status` 显示 active 但 5 个进程是 `STOPPED` | `autostart` 被改成 false 了，或 `reread` 后没 `update` |
| 全部 RUNNING 但功能不工作 | 见 §三「少起进程的症状对照」，并按 §六 自检 |
| 改了配置不生效 | 程序定义改动用 `systemctl reload`；主配置改动用 `systemctl restart`；Python 代码改动要 `restart` |
| 9001/9002 被占用 | 同时跑了发行版 `supervisor.service`，或旧的手工 `runserver` 没杀干净：`ss -lntp \| grep 900` |

