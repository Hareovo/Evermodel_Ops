# 部署(deploy/)

Evermodel Ops 的完整部署入口:中间件(MariaDB / Redis / nginx)由 Docker Compose 提供,后端 5 个进程由 supervisor + systemd 托管(宿主机 venv 运行),前端由 nginx 容器挂载 `frontend/build`。

```
浏览器 ── :80 ── nginx 容器 (evermodel-nginx)
                     ├── /        → frontend/build(前端静态产物)
                     ├── /api/    → 宿主机 gunicorn :9001(REST API)
                     └── /api/ws/ → 宿主机 daphne   :9002(WebSocket)

宿主机
  ├── backend/venv  → 5 个后端进程(supervisor + systemd 托管)
  └── deploy/data/  → MySQL / Redis 数据(项目内目录,.gitignore 已排除)

Docker Compose (deploy/docker-compose.yaml)
  ├── evermodel-mysql  MariaDB 10.8  127.0.0.1:3306
  ├── evermodel-redis  Redis 7       127.0.0.1:6379
  └── evermodel-nginx  nginx         :80
```

## 目录结构

```
deploy/
├── README.md              本文件(唯一部署文档)
├── docker-compose.yaml    中间件:MariaDB / Redis / nginx(免 .env 直接可用)
├── init.sh                一次初始化:建表 + 默认设置 + 管理员
├── run.sh                 常用操作入口:middleware / init / backend / frontend / status
├── db/
│   ├── init.sql           建库 / 授权(root@'%')/ 字符集(幂等)
│   └── init.defaults.sql  平台默认设置(关闭「访问IP校验」弹窗,幂等)
├── nginx/
│   └── evermodel_ops.conf 容器内 nginx 站点配置(静态文件 + /api 反代)
└── supervisor/
    ├── supervisord.conf      supervisord 主配置(安装到 /etc/evermodel_ops/)
    ├── evermodel_ops.conf    5 个 [program:*] 定义(含 __APP_DIR__ 占位符)
    ├── evermodel_ops.service systemd 单元,守护 supervisord 本体
    ├── install.sh            一键安装:路径替换 + 环境文件 + systemd + 启动
    ├── manage.sh             单服务启停:manage.sh restart api
    └── start-supervisord.sh  systemd ExecStart 包装(加载 environment 后启动)
```

> `deploy/db/*.sql` 与 `deploy/supervisor/*.conf|*.service` 是运行所需文件,初始化与安装都有脚本入口,一般不需要手工执行 SQL 或逐条复制配置。

---

## 一、服务器依赖

目标:Ubuntu 20.04 / 22.04 / 24.04(x86_64)。

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-dev gcc pkg-config \
  default-libmysqlclient-dev libssl-dev supervisor docker.io \
  sshpass rsync sshfs iputils-ping curl
sudo systemctl enable --now docker
```

> `python3-dev / gcc / default-libmysqlclient-dev` 用于编译 `mysqlclient`;`sshpass / rsync / sshfs` 与主机纳管、文件分发有关。

## 二、获取项目

```bash
sudo mkdir -p /opt
cd /opt
git clone https://github.com/Hareovo/Evermodel_Ops.git
cd /opt/evermodel_ops
```

> 仓库内 shell 脚本已带执行位,clone 后无需 `chmod +x`。若之前手动 `chmod` 导致 `git pull` 报 local changes,先 `git checkout -- .` 再 pull。

## 三、启动中间件

```bash
cd /opt/evermodel_ops
docker compose -f deploy/docker-compose.yaml up -d
docker compose -f deploy/docker-compose.yaml ps   # 期望 mysql/redis healthy
```

数据保存在 `deploy/data/mysql` 与 `deploy/data/redis`;备份这两目录或 `mysqldump` 即可。

## 四、后端环境与配置

```bash
cd /opt/evermodel_ops/backend
python3 -m venv venv
. venv/bin/activate
pip install -r requirements.txt
cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py
```

`overrides.py` 是完整模板,默认即连接本机 Compose 中间件,需确认/修改的项:

| 项 | 默认 | 说明 |
|---|---|---|
| `EVERMODEL_MYSQL_HOST/PORT` | `127.0.0.1` / `3306` | Compose 映射地址 |
| `EVERMODEL_MYSQL_DB/USER` | `evermodel_ops` / `root` | |
| `EVERMODEL_MYSQL_PASSWORD` | `evermodel_ops` | ⚠️ 生产必须修改,并同步三处 |
| `EVERMODEL_REDIS_HOST/PORT` | `127.0.0.1` / `6379` | |
| `EVERMODEL_SECRET_KEY` | 开发默认值 | ⚠️ 生产必须改为强随机值 |
| `EVERMODEL_ALLOWED_HOSTS` | `*` | ⚠️ 生产收窄为具体域名/IP,否则登录 400 |
| `EVERMODEL_GRAFANA_URL` | 空 | 仅启用监控大屏时设置 |

密码需同步三处:`overrides.py` / `deploy/init.sh` 的 `EVERMODEL_MYSQL_PASSWORD` / `/etc/evermodel_ops/environment`。

## 五、初始化(建表 + 默认设置 + 管理员)

在项目根目录执行:

```bash
cd /opt/evermodel_ops
export EVERMODEL_MYSQL_PASSWORD=evermodel_ops
export EVERMODEL_ADMIN_PASSWORD='请设置管理员密码'
./deploy/init.sh
```

脚本会:校验连接 MySQL → `manage.py updatedb` 建表 → 补齐缺失设置 → 不存在 `admin` 时创建超级管理员。**幂等**,重复执行不覆盖已有设置与密码。手工初始化见「十、备用:手工初始化」。

## 六、托管后端 5 进程

```bash
cd /opt/evermodel_ops
sudo ./deploy/supervisor/install.sh /opt/evermodel_ops
```

首次运行生成 `/etc/evermodel_ops/environment`(权限 600)。**必须先编辑**它再启动服务:

```bash
sudo vim /etc/evermodel_ops/environment
```

至少改这两行(数据库密码与 `overrides.py`/`init.sh` 一致):

```ini
EVERMODEL_MYSQL_PASSWORD=evermodel_ops
EVERMODEL_SECRET_KEY=CHANGE_ME_SECRET_KEY
EVERMODEL_ALLOWED_HOSTS=127.0.0.1,你的域名或IP
```

> `EVERMODEL_ALLOWED_HOSTS` 必须包含实际访问地址,否则浏览器登录报 **400**。

改完后:

```bash
sudo systemctl restart evermodel_ops
sudo supervisorctl -c /etc/evermodel_ops/supervisord.conf status
```

期望 5 个进程全部 `RUNNING`:

```text
evermodel_ops-api         RUNNING   gunicorn  :9001  REST API
evermodel_ops-ws          RUNNING   daphne    :9002  WebSocket
evermodel_ops-worker      RUNNING   runworker        批量执行/分发/监控执行器
evermodel_ops-monitor     RUNNING   runmonitor       监控检测
evermodel_ops-scheduler   RUNNING   runscheduler     任务计划调度
```

> install.sh 会把 `__APP_DIR__` 替换到 program 配置与 systemd 单元;若 supervisord 起不来,脚本会打印 `systemctl status` + `journalctl` 诊断。

## 七、部署前端

`frontend/build` 是 nginx 容器挂载的站点根。在开发机构建:

```bash
cd frontend
npm install
npm run dist
```

把发布包上传到服务器并解压:

```bash
mkdir -p /opt/evermodel_ops/frontend/build
# 上传 frontend/dist 产物到 /opt/evermodel_ops/frontend/build/
test -f /opt/evermodel_ops/frontend/build/index.html && echo OK
```

> 更新前端只需覆盖 `frontend/build`,无需重启进程。

## 八、验证

```bash
# 5 个后端进程 RUNNING
sudo supervisorctl -c /etc/evermodel_ops/supervisord.conf status

# 两个端口在听
ss -lntp | grep -E ':9001|:9002'

# 首页与登录接口 200
curl -s -o /dev/null -w 'home %{http_code}\n' http://127.0.0.1/
curl -s -o /dev/null -w 'api  %{http_code}\n' http://127.0.0.1/api/account/login/
```

浏览器打开 `http://服务器IP/`,用 `admin` + 第五步设置的管理员密码登录。

## 九、日常运维

```bash
# 统一入口
./deploy/run.sh status                # 中间件 + 后端状态
./deploy/run.sh middleware ps         # 中间件
./deploy/run.sh backend restart api   # 后端单服务

# 后端单服务启停 / 日志(manage.sh 支持 api/ws/worker/monitor/scheduler/all)
./deploy/supervisor/manage.sh status
./deploy/supervisor/manage.sh restart api
./deploy/supervisor/manage.sh logs ws

# 中间件
docker compose -f deploy/docker-compose.yaml ps
docker compose -f deploy/docker-compose.yaml logs -f mysql
docker compose -f deploy/docker-compose.yaml down        # 停止(不删数据)

# 更新后端代码后重启整组
sudo systemctl restart evermodel_ops
```

### 数据库备份/改密

```bash
# 备份
docker exec evermodel-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql

# 平台管理员密码
cd backend && python manage.py user reset -u admin -p '新强密码'

# 数据库密码(改后同步 overrides.py / environment,再重启后端)
docker exec -it evermodel-mysql mysql -uroot -p -e \
  "ALTER USER 'root'@'%' IDENTIFIED BY '新强密码'; FLUSH PRIVILEGES;"
```

> 平台有防爆破:同一账号连续 3 次密码错误会被禁用。启用:`python manage.py user enable -u admin`。

## 十、备用:手工初始化

`deploy/init.sh` 不可用时,可按序手工执行:

```bash
# 1 建库与账号(compose 已自动建库时跳过)
docker exec -i evermodel-mysql mysql -uroot -pevermodel_ops < deploy/db/init.sql

# 2 建表
cd backend && . venv/bin/activate
python manage.py updatedb

# 3 建管理员
python manage.py user add -u admin -p evermodel_ops -n 管理员 -s

# 4 平台默认设置(settings 表存在后执行)
cd /opt/evermodel_ops
docker exec -i evermodel-mysql mysql -uroot -pevermodel_ops evermodel_ops < deploy/db/init.defaults.sql
```

## 十一、常见问题

| 现象 | 处理 |
|---|---|
| `init.sh` 报 `No module named 'evermodel_ops'` | 在项目根目录执行;pull 最新代码 |
| `init.sh` 报 `MySQL is required` | 确认 `overrides.py` 未写死 SQLite |
| install.sh 报 `FileNotFoundError: supervisor/xmlrpc.py` | supervisord 未启动,脚本会打印 systemctl/journalctl 诊断 |
| 5 进程 `FATAL` / `spawn error` | `backend/logs` 目录必须存在;检查 `/etc/evermodel_ops/environment` 密码 |
| 页面/登录 400 | `EVERMODEL_ALLOWED_HOSTS` 未含访问地址,改为 `*` 或加真实地址后重启 |
| 页面 502 | api/ws 没起,或 nginx 容器访问不到宿主机 9001/9002 |
| 页面 404 / 空白 | `frontend/build/index.html` 不存在 |
| 数据库连不上 | 核对 `overrides.py`、`/etc/evermodel_ops/environment`、`init.sh` 三处密码一致 |
| 批量执行卡 `Waiting for scheduling` | worker 没起(不是脚本问题),重启 worker 后重新提交任务 |
| 监控不执行/不告警 | monitor/scheduler 没起;`redis-cli -n 1 keys 'evermodel_ops:det:*'` 排查 |
| 登录提示账号被禁用 | 防爆破触发:`python manage.py user enable -u admin` |