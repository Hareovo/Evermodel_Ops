# Evermodel Ops 部署指南（Ubuntu）

目标系统 Ubuntu 20.04 / 22.04 / 24.04（x86_64）。按本文顺序执行，通常 15 分钟可完成。

架构：

```
浏览器 ── :80 ── nginx 容器 (evermodel-nginx)
                     ├── /        → frontend/build（前端静态产物）
                     ├── /api/    → 宿主机 gunicorn :9001（REST API）
                     └── /api/ws/ → 宿主机 daphne   :9002（WebSocket）

宿主机
  ├── backend/venv  → 5 个后端进程（supervisor + systemd 托管）
  └── deploy/data/  → MySQL 数据、Redis 数据（项目内目录，.gitignore 已排除）

Docker Compose (deploy/docker-compose.yaml)
  ├── evermodel-mysql  MariaDB 10.8  127.0.0.1:3306
  ├── evermodel-redis  Redis 7       127.0.0.1:6379
  └── evermodel-nginx  nginx         80
```

## 〇、系统依赖

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-dev gcc pkg-config \
  default-libmysqlclient-dev libssl-dev supervisor docker.io \
  sshpass rsync sshfs iputils-ping curl
sudo systemctl enable --now docker
```

> `python3-dev / gcc / default-libmysqlclient-dev` 用于编译 `mysqlclient`；`sshpass / rsync / sshfs` 与主机纳管、文件分发有关。

## 一、获取项目

```bash
sudo mkdir -p /opt
cd /opt
git clone https://github.com/Hareovo/Evermodel_Ops.git
cd /opt/evermodel_ops
```

> 仓库内 shell 脚本已带执行位（100755），clone 后无需再 `chmod +x`。若之前手动 `chmod` 过导致 `git pull` 报「local changes would be overwritten」，先执行 `git checkout -- .` 再 pull。

## 二、启动中间件（MariaDB / Redis / nginx）

```bash
cd /opt/evermodel_ops
docker compose -f deploy/docker-compose.yaml up -d
docker compose -f deploy/docker-compose.yaml ps
```

确认三个容器 `Up (healthy)`：

```text
evermodel-mysql   Up (healthy)
evermodel-redis   Up (healthy)
evermodel-nginx   Up
```

> 数据保存在 `deploy/data/mysql` 与 `deploy/data/redis`（已 `.gitignore`），备份这两目录或执行 `mysqldump` 即可。

## 三、创建 Python 环境并安装依赖

```bash
cd /opt/evermodel_ops/backend
python3 -m venv venv
. venv/bin/activate
pip install -r requirements.txt
```

国内源加速：`pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`

## 四、配置 `overrides.py`

```bash
cd /opt/evermodel_ops/backend
cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py
```

`overrides.py` 已经是一份可直接使用的完整模板，默认值即连接本地 Compose 中间件：

| 项 | 默认值 | 说明 |
|---|---|---|
| `EVERMODEL_MYSQL_HOST/PORT` | `127.0.0.1` / `3306` | Compose 映射地址 |
| `EVERMODEL_MYSQL_DB` | `evermodel_ops` | 数据库名 |
| `EVERMODEL_MYSQL_USER` | `root` | |
| `EVERMODEL_MYSQL_PASSWORD` | `evermodel_ops` | ⚠️ 生产必须修改并同步三处 |
| `EVERMODEL_REDIS_HOST/PORT` | `127.0.0.1` / `6379` | |
| `EVERMODEL_SECRET_KEY` | 开发默认值 | ⚠️ 生产必须改为强随机值 |
| `EVERMODEL_ALLOWED_HOSTS` | `*` | ⚠️ 生产收窄为具体域名/IP，**不设会导致登录 400** |
| `EVERMODEL_GRAFANA_URL` | 空 | 仅启用监控大屏时设置 |

密码同步三处：`overrides.py` / `deploy/init.sh` 的 `EVERMODEL_MYSQL_PASSWORD` / `/etc/evermodel_ops/environment`。

## 五、初始化数据库、默认设置和管理员

在**项目根目录**执行：

```bash
cd /opt/evermodel_ops

export EVERMODEL_MYSQL_PASSWORD=evermodel_ops
export EVERMODEL_ADMIN_PASSWORD='请修改为管理员密码'
./deploy/init.sh
```

初始化脚本会：

1. 校验后端连接的是 MySQL（`settings.py` 默认即 MySQL，与 Compose 一致）；
2. `manage.py updatedb` 建表/迁移；
3. 补齐 `KEYS_DEFAULT` 缺失项；
4. `admin` 不存在则创建超级管理员，已存在则跳过、不改密码。

> 幂等：重复执行不会覆盖已有设置或管理员密码。

## 六、一键安装 Supervisor 并托管后端

```bash
cd /opt/evermodel_ops
sudo ./deploy/supervisor/install.sh /opt/evermodel_ops
```

首次运行会生成 `/etc/evermodel_ops/environment`（权限 600）。**必须先编辑它**，否则业务进程连不上数据库/Redis，或残留 `CHANGE_ME`：

```bash
sudo vim /etc/evermodel_ops/environment
```

至少改这两行（数据库密码与 `overrides.py`/`init.sh` 保持一致）：

```ini
EVERMODEL_MYSQL_PASSWORD=evermodel_ops
EVERMODEL_SECRET_KEY=CHANGE_ME_SECRET_KEY
EVERMODEL_ALLOWED_HOSTS=127.0.0.1,你的域名或IP
```

> ⚠️ **`EVERMODEL_ALLOWED_HOSTS` 必须包含你实际访问的地址**（域名或服务器 IP）。只有 `127.0.0.1` 时，浏览器通过域名/IP 访问登录会报 **400 Bad Request**。不确定时先用 `*`，上线前再收窄。

改完后重启并确认 5 个进程 `RUNNING`：

```bash
sudo systemctl restart evermodel_ops
sudo supervisorctl -c /etc/evermodel_ops/supervisord.conf status
```

```text
evermodel_ops-api         RUNNING
evermodel_ops-ws          RUNNING
evermodel_ops-worker      RUNNING
evermodel_ops-monitor     RUNNING
evermodel_ops-scheduler   RUNNING
```

> install.sh 会把 `__APP_DIR__` 占位符同时替换到 program 配置与 systemd 单元；若 supervisord 起不来，脚本会等待 unix socket 并打印 `systemctl status` + `journalctl` 诊断。

## 七、部署前端

`frontend/build` 是 nginx 容器挂载的站点根目录。在开发机构建：

```bash
cd frontend
npm install
python -m pip 2>/dev/null || true
npm run dist
```

把发布包上传到服务器并解压：

```bash
mkdir -p /opt/evermodel_ops/frontend/build
# 将开发机 frontend/dist 下的产物上传到 /opt/evermodel_ops/frontend/build/
test -f /opt/evermodel_ops/frontend/build/index.html && echo OK
```

> 更新前端只需替换 `frontend/build` 内容，无需重启进程。

## 八、验证

```bash
# 1. 5 个进程 RUNNING
sudo supervisorctl -c /etc/evermodel_ops/supervisord.conf status

# 2. 两个端口在听
ss -lntp | grep -E ':9001|:9002'

# 3. 首页 200
curl -s -o /dev/null -w 'home %{http_code}\n' http://127.0.0.1/

# 4. 登录接口 200
curl -s -o /dev/null -w 'api  %{http_code}\n' http://127.0.0.1/api/account/login/
```

浏览器打开 `http://服务器IP/`，用 `admin` + 第五步设置的管理员密码登录。

> 若页面报 **400 Bad Request**：`ALLOWED_HOSTS` 未包含访问地址，按第六步改 `environment` 后 `sudo systemctl restart evermodel_ops`。

## 九、日常运维

```bash
# 中间件
docker compose -f deploy/docker-compose.yaml ps
docker compose -f deploy/docker-compose.yaml logs -f mysql
docker compose -f deploy/docker-compose.yaml down        # 停止（不删数据）

# 后端（manage.sh 支持 api/ws/worker/monitor/scheduler/all）
./deploy/supervisor/manage.sh status
./deploy/supervisor/manage.sh restart api
./deploy/supervisor/manage.sh logs ws

# 统一入口
./deploy/run.sh status
./deploy/run.sh middleware ps

# 更新后端代码后重启
sudo systemctl restart evermodel_ops
```

数据库备份：

```bash
docker exec evermodel-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql
```

## 十、常见问题

| 现象 | 处理 |
|---|---|
| `init.sh` 报 `No module named 'evermodel_ops'` | 在项目根目录执行；确认已 pull 最新代码（`sys.path` 已修正） |
| `init.sh` 报 `MySQL is required` | `settings.py` 默认已走 MySQL；确认 `overrides.py` 未写死 SQLite |
| `sudo: ./deploy/...sh: command not found` | 仓库脚本已带执行位；升级前若本地 `chmod` 过，先 `git checkout -- .` 再 pull |
| `git pull` 报 local changes would be overwritten | 服务器上对脚本 `chmod` 过；执行 `git checkout -- .` 后重新 pull |
| install.sh 报 `FileNotFoundError: supervisor/xmlrpc.py` | supervisord 未启动；新版本会打印 `systemctl status` + `journalctl` 诊断，按输出排查 |
| 5 个进程 `FATAL` / `spawn error` | `backend/logs` 目录必须存在；检查 `/etc/evermodel_ops/environment` 密码与 redis 配置 |
| 页面 400 登录失败 | `ALLOWED_HOSTS` 未含访问域名/IP，改为 `*` 或加入真实地址后重启 |
| 页面 502 | api/ws 没起，或 nginx 容器访问不到宿主机 9001/9002 |
| 页面 404 / 空白 | `frontend/build/index.html` 不存在；上传前端产物 |
| 数据库连不上 | 核对 `overrides.py`、`/etc/evermodel_ops/environment`、`init.sh` 三处密码一致 |
| Paramiko `TripleDES` 弃用警告 | 仅为告警，不影响运行 |