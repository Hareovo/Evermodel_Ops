# Evermodel Ops 部署指南（Ubuntu）

本文档提供一套在 **Ubuntu 20.04 / 22.04 / 24.04** 上从零部署 Evermodel Ops 的完整步骤，可直接复制粘贴执行。

## 架构

```
浏览器
  │ :80
  ▼
nginx 容器 (evermodel-nginx)
  ├── /        → frontend/build（前端静态产物）
  ├── /api/    → 宿主机 gunicorn :9001 (REST API)
  └── /api/ws/ → 宿主机 daphne   :9002 (WebSocket)

宿主机
  ├── backend/venv  → 5 个后端进程（supervisor 托管）
  └── deploy/data/  → MySQL 数据、Redis 数据（项目内目录，不入库）

Docker Compose (deploy/docker-compose.yaml)
  ├── evermodel-mysql  MariaDB 10.8  127.0.0.1:3306
  ├── evermodel-redis  Redis 7       127.0.0.1:6379
  └── evermodel-nginx  nginx         :80
```

## 一、安装系统依赖

服务器先安装编译 Python 依赖、Supervisor 和 Docker：

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-dev gcc pkg-config \
  default-libmysqlclient-dev libssl-dev supervisor docker.io \
  sshpass rsync sshfs iputils-ping curl
sudo systemctl enable --now docker
```

> `python3-dev / gcc / default-libmysqlclient-dev` 用于编译 `mysqlclient`；
> `sshpass / rsync / sshfs` 与主机纳管 / 文件分发有关，按需安装。

## 二、存放项目

将项目放到 `/opt/evermodel_ops`（可用 git clone 或 scp 上传）：

```bash
sudo mkdir -p /opt
cd /opt
# git clone 或上传源码后进入
cd /opt/evermodel_ops
```

## 三、启动中间件（MariaDB / Redis / nginx）

```bash
cd /opt/evermodel_ops
docker compose -f deploy/docker-compose.yaml up -d
docker compose -f deploy/docker-compose.yaml ps
```

确认三个容器均为 Up/healthy：

```text
evermodel-mysql   Up (healthy)
evermodel-redis   Up (healthy)
evermodel-nginx   Up
```

> 数据保存在 `deploy/data/mysql` 和 `deploy/data/redis`，已加入 `.gitignore`。
> 备份时备份这两个目录（或执行 `mysqldump`）。

## 四、创建 Python 环境并安装后端依赖

```bash
cd /opt/evermodel_ops/backend
python3 -m venv venv
. venv/bin/activate
pip install -r requirements.txt
```

> 如需国内镜像加速：
> ```bash
> pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
> ```

## 五、配置 `overrides.py`

复制示例并确认数据库、Redis、密钥等配置：

```bash
cd /opt/evermodel_ops/backend
cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py
```

`overrides.py` 中需要根据实际环境确认的项：

| 配置 | 默认 | 说明 |
|---|---|---|
| `EVERMODEL_MYSQL_HOST` | `127.0.0.1` | Compose 中 MySQL 映射地址 |
| `EVERMODEL_MYSQL_PORT` | `3306` | |
| `EVERMODEL_MYSQL_DB` | `evermodel_ops` | 数据库名 |
| `EVERMODEL_MYSQL_USER` | `root` | |
| `EVERMODEL_MYSQL_PASSWORD` | `evermodel_ops` | ⚠️ 生产必须修改并同步 |
| `EVERMODEL_REDIS_HOST` | `127.0.0.1` | |
| `EVERMODEL_REDIS_PORT` | `6379` | |
| `EVERMODEL_SECRET_KEY` | （示例值） | ⚠️ 生产必须改为强随机值 |
| `EVERMODEL_ALLOWED_HOSTS` | `*` | 生产建议收窄为具体域名/IP |
| `EVERMODEL_GRAFANA_URL` | 空 | 仅启用监控大屏时设置 |

## 六、初始化数据库、默认设置和管理员

在**项目根目录**执行：

```bash
cd /opt/evermodel_ops

export EVERMODEL_MYSQL_PASSWORD=evermodel_ops
export EVERMODEL_ADMIN_PASSWORD='请修改为管理员密码'
./deploy/init.sh
```

脚本会：

1. 校验后端已连接 MySQL（非 SQLite）；
2. 执行 `manage.py updatedb` 建表/迁移；
3. 补齐缺失的设置项；
4. 若 `admin` 不存在则创建超级管理员，已存在则跳过密码重置。

> 如果你之前已经手工执行过 `manage.py updatedb` 或创建过 `admin`，重复执行 `init.sh` 不会有副作用。

## 七、一键安装 Supervisor 并托管后端 5 个进程

```bash
cd /opt/evermodel_ops

# 首次需给脚本加可执行权限(仓库里的 .sh 可能未带执行位)
chmod +x deploy/init.sh deploy/run.sh \
  deploy/supervisor/install.sh deploy/supervisor/manage.sh \
  deploy/supervisor/start-supervisord.sh \
  backend/tools/start-dev.sh backend/tools/start-api.sh \
  backend/tools/start-ws.sh backend/tools/start-worker.sh \
  backend/tools/start-monitor.sh backend/tools/start-scheduler.sh \
  frontend/start-dev.sh

sudo ./deploy/supervisor/install.sh /opt/evermodel_ops
```

首次安装会在 `/etc/evermodel_ops/environment` 生成配置模板。**必须先编辑该文件**填入真实密码/密钥，否则 5 个进程会连不上数据库/Redis：

```bash
sudo vim /etc/evermodel_ops/environment
```

至少修改:

```ini
EVERMODEL_MYSQL_PASSWORD=evermodel_ops
EVERMODEL_SECRET_KEY=CHANGE_ME_SECRET_KEY
EVERMODEL_ALLOWED_HOSTS=127.0.0.1,你的域名或IP
```

改完后重新加载并启动：

```bash
sudo systemctl restart evermodel_ops
sudo supervisorctl -c /etc/evermodel_ops/supervisord.conf status
```

期望 5 个进程全部 `RUNNING`：

```text
evermodel_ops-api         RUNNING
evermodel_ops-ws          RUNNING
evermodel_ops-worker      RUNNING
evermodel_ops-monitor     RUNNING
evermodel_ops-scheduler   RUNNING
```

## 八、部署前端

前端构建产物位于 `frontend/build`，nginx 容器直接挂载该目录。在开发机执行：

```bash
cd frontend
npm install
npm run dist
```

把发布包解压到服务器 `/opt/evermodel_ops/frontend/build`：

```bash
# 在服务器上
mkdir -p /opt/evermodel_ops/frontend/build
# 解压/上传前端产物到该目录，确认存在 index.html
test -f /opt/evermodel_ops/frontend/build/index.html && echo OK
```

> 更新前端只需重新构建并覆盖 `frontend/build`，无需重启进程。

## 九、验证

```bash
# 1. supervisor 5 个进程 RUNNING
sudo supervisorctl -c /etc/evermodel_ops/supervisord.conf status

# 2. 两个后端端口在听
ss -lntp | grep -E ':9001|:9002'

# 3. 登录页返回 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/

# 4. 登录接口（免鉴权）返回 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/api/account/login/
```

浏览器访问 `http://服务器IP/`，用 `admin` + 步骤六设置的管理员密码登录。

## 十、日常操作

```bash
# 中间件
docker compose -f deploy/docker-compose.yaml ps
docker compose -f deploy/docker-compose.yaml logs -f mysql
docker compose -f deploy/docker-compose.yaml down        # 停止（不删数据）

# 后端单服务
./deploy/supervisor/manage.sh status
./deploy/supervisor/manage.sh restart api
./deploy/supervisor/manage.sh logs ws

# 更新后端代码后重启
sudo systemctl restart evermodel_ops

# 数据库备份
docker exec evermodel-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql
```

## 十一、常见问题

| 现象 | 处理 |
|---|---|
| `init.sh` 报 `No module named 'evermodel_ops'` | 检查是否在项目根目录执行；脚本已修正 sys.path，确保 pull 最新代码 |
| 5 个进程是 `FATAL` / `spawn error` | `backend/logs` 目录必须存在；检查 `/etc/evermodel_ops/environment` 密码 |
| 页面 502 | api/ws 没起，或 nginx 容器无法访问宿主机 9001/9002 |
| 页面 404/空白 | `frontend/build/index.html` 不存在 |
| 数据库连不上 | 核对 `overrides.py` 与 `/etc/evermodel_ops/environment` 的密码是否一致 |