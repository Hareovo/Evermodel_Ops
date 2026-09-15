# Evermodel Ops

轻量级、无 Agent 的自动化运维平台，基于 Spug 二次开发。

主机纳管、批量执行、任务计划、监控告警、文件分发、Web 终端 —— 一套 Web 界面即可完成，
**不需要在被管机器上安装任何 Agent**，只要 SSH 可达。

---

## 功能特性

| 模块 | 说明 |
|---|---|
| **主机管理** | SSH 密钥 / 密码认证、主机分组、批量导入导出、从云厂商同步主机 |
| **批量执行** | 在多台主机上并行执行命令或脚本，支持脚本模板与参数化、实时输出与历史记录 |
| **任务计划** | 类 cron 调度，支持间隔 / 定时 / 周期任务，执行记录可追溯 |
| **监控中心** | 站点、端口、进程、自定义脚本四类检测，支持告警抑制与恢复通知 |
| **告警中心** | 钉钉 / 飞书 / 企业微信 / 邮件多通道推送，支持告警分组与联系人管理 |
| **文件分发** | 批量上传文件到多台主机，支持覆盖策略与传输记录 |
| **Web 终端** | 浏览器内 SSH 终端（xterm.js），支持在线文件管理 |
| **接口文档** | `/apidocs` 自动生成全量 API 文档，可直接在线调试 |
| **监控大屏** | `/grafana` 内嵌 Grafana 看板，无需跳转 |

## 技术栈

| 层次 | 选型 |
|---|---|
| 后端 | Python 3.13 / Django 4.2 / Django Channels（daphne，HTTP 与 WebSocket 同端口） |
| 任务队列 | Redis —— 自研轻量队列，不依赖 Celery |
| 前端 | React 18 / Ant Design 4 / react-app-rewired |
| 数据库 | MariaDB 10.8（兼容 MySQL） |
| 过程管理 | supervisor（5 个后端进程）+ nginx |

## 目录结构

```
evermodel_ops/
├── backend/                Django 后端
│   ├── apps/               业务模块
│   │   ├── host/           主机管理
│   │   ├── exec/           批量执行、文件分发
│   │   ├── schedule/       任务计划
│   │   ├── monitor/        监控检测
│   │   ├── alarm/          告警中心
│   │   ├── file/           文件管理
│   │   ├── setting/        系统设置、接口文档、Grafana 大屏
│   │   └── account/        账号
│   ├── consumer/           WebSocket 消费者（Web 终端、实时输出）
│   ├── libs/               公共库（SSH 通道、告警通知、参数解析）
│   ├── tools/              部署脚本（supervisor 配置、gunicorn / daphne 启动脚本）
│   └── evermodel_ops/      Django 工程配置
└── frontend/               React 前端
```

---

## 部署到 Linux 服务器

> 目标系统：Ubuntu 20.04 / 22.04 / 24.04（x86_64），其余发行版步骤同理。
> 后端的 supervisor 配置与启动脚本路径**写死了 `/data/evermodel_ops`**，请按此目录部署。

### 部署架构

```
浏览器 ──> nginx（宿主机，:80）
             ├── /api/ws/  ──> 127.0.0.1:9002  daphne      WebSocket（Web 终端、实时输出）
             ├── /api/     ──> 127.0.0.1:9001  gunicorn    REST API
             └── 其余      ──> /data/evermodel_ops/frontend/build   前端静态文件

supervisor 托管 5 个后端进程（均在 backend/venv 内运行）
  ├── evermodel_ops-api         gunicorn :9001
  ├── evermodel_ops-ws          daphne   :9002
  ├── evermodel_ops-worker      批量执行 / 任务计划 / 监控 的执行器
  ├── evermodel_ops-monitor     监控检测
  └── evermodel_ops-scheduler   任务计划调度

数据层（Docker 或已有实例）
  ├── MariaDB   127.0.0.1:3306
  └── Redis     127.0.0.1:6379
```

### 1. 环境准备

```bash
sudo apt update
# python 编译环境（mysqlclient 需要编译）+ supervisor + 主机管理/监控依赖
sudo apt install -y python3 python3-venv python3-dev gcc pkg-config \
    default-libmysqlclient-dev libssl-dev \
    supervisor nginx git curl \
    sshpass rsync sshfs iputils-ping net-tools procps
```

> - `gcc / pkg-config / default-libmysqlclient-dev / libssl-dev`：编译 mysqlclient，缺了会报 `mysql.h: No such file`
> - `sshpass / rsync / sshfs / iputils-ping`：主机管理、文件分发、Ping 监控要用

安装 Docker（用于跑数据库与 Redis，已有实例可跳过）：

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
```

### 2. 数据层（MariaDB / Redis）

```bash
sudo mkdir -p /data/evermodel_ops/db
cd /data/evermodel_ops/db
```

新建 `docker-compose.yml`：

```yaml
services:
  mysql:
    image: mariadb:10.8
    container_name: spug-mysql
    restart: unless-stopped
    ports:
      - "127.0.0.1:3306:3306"
    environment:
      MYSQL_DATABASE: evermodel
      MYSQL_USER: evermodel
      MYSQL_PASSWORD: ${EVERMODEL_MYSQL_PASSWORD:?请在 .env 中填写密码}
      MYSQL_ROOT_PASSWORD: ${EVERMODEL_MYSQL_ROOT_PASSWORD:?请在 .env 中填写密码}
      TZ: Asia/Shanghai
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    container_name: spug-redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

新建 `.env`（**不要提交到版本库**），填写强密码：

```bash
cat > .env <<'EOF'
EVERMODEL_MYSQL_PASSWORD=change-me
EVERMODEL_MYSQL_ROOT_PASSWORD=change-me
EOF
chmod 600 .env
sudo docker compose up -d
```

等待数据库就绪（首次初始化需要十几秒）：

```bash
until sudo docker exec spug-mysql mysqladmin ping -h 127.0.0.1 -uroot -p"$EVERMODEL_MYSQL_ROOT_PASSWORD" --silent; do sleep 2; done; echo "mysql ready"
sudo docker compose ps
```

> 数据持久化在 named volume（`mysql_data` / `redis_data`），重建容器不丢数据。

### 3. 部署后端

**上传代码**（排除 venv / repos / logs / storage —— venv 不能跨平台复用）：

```bash
# 开发机
tar czf evermodel_ops-backend.tar.gz \
    --exclude='backend/venv' --exclude='backend/repos' --exclude='backend/logs' \
    --exclude='backend/storage' --exclude='backend/__pycache__' backend
scp evermodel_ops-backend.tar.gz user@SERVER:/tmp/
```

```bash
# 服务器
sudo mkdir -p /data/evermodel_ops
sudo tar xzf /tmp/evermodel_ops-backend.tar.gz -C /data/evermodel_ops
```

**建 venv 装依赖**：

```bash
cd /data/evermodel_ops/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -i https://mirrors.aliyun.com/pypi/simple/
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
```

**生产配置** —— 复制模板并修改 `backend/evermodel_ops/overrides.py`：

```bash
cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py
```

```python
DEBUG = False
ALLOWED_HOSTS = ['你的域名或服务器IP']
MYSQL_HOST = '127.0.0.1'
MYSQL_PORT = 3306
MYSQL_PASSWORD = '与 db/.env 中一致的强密码'
REDIS_HOST = '127.0.0.1'
REDIS_PORT = 6379
GRAFANA_URL = 'http://你的grafana地址:3000'   # 不用监控大屏可留空
```

> 该文件**不入库**，按部署环境单独生成。也可改用 `EVERMODEL_*` 环境变量注入，见下文「配置」。

**初始化数据库 + 建管理员**：

```bash
cd /data/evermodel_ops/backend && source venv/bin/activate
python manage.py updatedb                                       # 建表
python manage.py user add -u admin -p '你的密码' -n 管理员 -s    # -s = 超级管理员
```

### 4. 进程托管（supervisor）

仓库自带的 `backend/tools/supervisor-evermodel.ini` 路径已写死 `/data/evermodel_ops`，直接启用：

```bash
sudo cp /data/evermodel_ops/backend/tools/supervisor-evermodel.ini \
        /etc/supervisor/conf.d/evermodel_ops.conf
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl status
```

期望五个进程全部 `RUNNING`。日志在 `/data/evermodel_ops/backend/logs/`。

> ⚠️ `worker` / `scheduler` 启动时会清空对应 Redis 队列（防止旧任务乱跑），
> 因此重启后需要**重新提交一次**堆积的任务。

### 5. 前端构建与 Nginx

**构建前端**（两种方式任选）：

```bash
# 方式 A（推荐）：开发机构建后上传，服务器无需装 Node
cd frontend
NODE_OPTIONS=--openssl-legacy-provider GENERATE_SOURCEMAP=false CI=false \
  node node_modules/react-app-rewired/bin/index.js build
tar czf evermodel_ops-frontend-build.tar.gz -C build .
scp evermodel_ops-frontend-build.tar.gz user@SERVER:/tmp/
```

```bash
# 服务器：解压到 nginx 站点根目录
sudo mkdir -p /data/evermodel_ops/frontend/build
sudo tar xzf /tmp/evermodel_ops-frontend-build.tar.gz -C /data/evermodel_ops/frontend/build
```

> 方式 B：服务器上装 Node 22（`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`）
> 后执行 `npm ci` 与同样的 build 命令。

**配置 Nginx** —— 新建 `/etc/nginx/sites-available/evermodel_ops.conf`：

```nginx
server {
    listen       80 default_server;
    server_name  _;                 # 有域名就填域名
    root         /data/evermodel_ops/frontend/build;
    client_max_body_size 100m;

    gzip  on;
    gzip_min_length  1k;
    gzip_buffers     4 16k;
    gzip_http_version 1.1;
    gzip_comp_level  7;
    gzip_types       text/plain text/css text/javascript application/javascript application/json;
    gzip_vary on;

    # WebSocket：主机在线终端 / 批量执行输出，长连接，读超时放宽
    location ^~ /api/ws/ {
        rewrite ^/api(.*) $1 break;
        proxy_pass http://127.0.0.1:9002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }

    # REST API，nginx 剥掉 /api 前缀
    location ^~ /api/ {
        rewrite ^/api(.*) $1 break;
        proxy_pass http://127.0.0.1:9001;
        proxy_read_timeout 300s;
        proxy_redirect off;
        # 必须透传原始 Host，否则 Django 的 ALLOWED_HOSTS 校验会返回 400
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 前端单页应用，回退到 index.html
    location / {
        try_files $uri /index.html;
    }
}
```

启用并重载：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/evermodel_ops.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. 验证

| 检查 | 命令 / 操作 | 期望 |
|---|---|---|
| 数据层 | `docker compose ps` | mysql / redis Up |
| 进程 | `sudo supervisorctl status` | 5 个进程全为 `RUNNING` |
| 静态页面 | `curl -I http://127.0.0.1/` | 200（返回登录页 HTML） |
| 反向代理 | `curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1/api/host/` | 401（未带 token，说明已到后端） |
| 登录 | 浏览器 `http://SERVER/` → admin / 刚设的密码 | 落地 `/host` 主机管理页 |
| Web 终端 | 主机列表点「终端」 | 连上不自动断 |
| 监控 | 建一个监控项 | `latest_run_time` 有值、告警渠道能收到通知 |
| 批量执行 | 提交一个脚本 | 输出正常，不卡 `### Waiting for scheduling ...` |

### 7. 日常运维

**更新前端**：开发机构建 → 上传解压覆盖 `/data/evermodel_ops/frontend/build` → 浏览器 Ctrl+F5（无需重启进程）。

**更新后端**：上传代码（排除 venv）→ `source venv/bin/activate && pip install -r requirements.txt`
→ 有表变更时 `python manage.py updatedb` → `sudo supervisorctl restart all`。

**备份数据库**：

```bash
sudo docker exec spug-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" spug' > spug-$(date +%F).sql
```

**常用命令**：

```bash
sudo supervisorctl status
sudo docker logs --tail 50 spug-mysql
tail -f /data/evermodel_ops/backend/logs/api.log
```

### 8. 故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面 502 | gunicorn / daphne 没起 | `supervisorctl status`；看 `logs/api.log` |
| 页面 404 / 空白 | 前端产物没上传到位 | 确认 `/data/evermodel_ops/frontend/build/index.html` 存在 |
| 接口 400 DisallowedHost | `ALLOWED_HOSTS` 没配 / Host 未透传 | 改 `overrides.py`；确认 nginx `proxy_set_header Host $host` |
| pip 装 mysqlclient 报 `mysql.h: No such file` | 缺编译依赖 | 装 `gcc pkg-config default-libmysqlclient-dev libssl-dev python3-dev` |
| 数据库连不上 | 容器没起 / 密码不一致 | `docker compose ps`；核对 `overrides.py` 与 `.env` 密码 |
| Web 终端连上几秒断开 | redis-py 8 默认 socket 超时 | 配置里的 `REDIS_POOL_KWARGS socket_timeout: None` 不要删（已内置） |
| 批量执行卡 `Waiting for scheduling` | worker 没起 | `supervisorctl restart evermodel_ops-worker`，任务需重新提交 |
| 监控不执行 / 不告警 | monitor / scheduler 没起 | 同上；`redis-cli -n 1 llen spug:monitor` 非 0 即征兆 |

---

## 监控大屏（内嵌 Grafana）

菜单里的「监控大屏」用 iframe 把 Grafana 看板嵌进 `/grafana` 页面。**平台侧开箱可用**，
只需在 Grafana 那台机器上放行两件事，否则必然踩到这两种现象：

| 现象 | 原因 | 要改的开关 |
|---|---|---|
| iframe 一片空白 | Grafana 发了 `X-Frame-Options: deny` | `allow_embedding = true` |
| iframe 里弹出 Grafana 自己的登录页 | 匿名访问没开，iframe 带不上登录态 | `[auth.anonymous] enabled = true` |

### 1. 平台侧填 Grafana 地址

登录平台 →「系统设置」→ 填写 Grafana 地址（如 `http://<grafana-host>:3000`）。
也可用环境变量 `EVERMODEL_GRAFANA_URL` 做首次部署，界面上保存后以界面为准。

### 2. Grafana 侧放行（Docker 部署，推荐用环境变量）

给 Grafana 的 compose 服务补三个环境变量：

```yaml
  grafana:
    image: grafana/grafana:13.2.1
    container_name: grafana
    ports:
      - "3000:3000"
    environment:                                # ← 新增这三行
      - GF_SECURITY_ALLOW_EMBEDDING=true        # 允许被 iframe 嵌套
      - GF_AUTH_ANONYMOUS_ENABLED=true          # 开启匿名访问
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer       # 匿名角色：只读
    volumes:
      - ./grafana-data:/var/lib/grafana
```

改完**必须重建容器**，`docker restart` 无效 —— 环境变量是容器**创建**时写进去的，
`restart` 只是重启进程，读的还是旧配置：

```bash
docker compose up -d grafana        # 检测到 environment 变更会自动 Recreated
```

数据不会丢：看板 / 用户 / 数据源都在 `./grafana-data`，重建只是换了个容器壳。
不放心可以先备份 `cp -a ./grafana-data ./grafana-data.bak-$(date +%F)`。

若不用 compose（裸 `docker run`）：`docker rm -f <容器名>` 后带 `-e GF_*` 三个参数重新 `docker run`，
**端口与 `-v` 挂载必须原样带上**，否则数据会丢。

### 3. 验证

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://<grafana-host>:3000/api/search?type=dash-db   # 期望 200（改前 401）
curl -s -I http://<grafana-host>:3000/login | grep -i x-frame-options                        # 期望无输出（改前 deny）
```

两条都符合后刷新平台页面，大屏顶部的黄色告警会消失，看板直接显示。

### 4. 备选：改 grafana.ini

不想动 compose 时，编辑**宿主机挂载进去的那个** `grafana.ini`
（用 `docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/grafana/grafana.ini"}}{{.Source}}{{end}}{{end}}' <容器名>` 查实际路径）：

```ini
[security]
allow_embedding = true

[auth.anonymous]
enabled = true
org_name = Main Org.
org_role = Viewer
```

改完 `docker restart <容器名>` 即可（改的是挂载文件，重启就生效）。

> ⚠️ 三个坑：
> 1. **环境变量优先于 ini** —— 容器里若已有 `GF_AUTH_ANONYMOUS_ENABLED=false`，改 ini 不生效，得改那个变量；
> 2. **别重复写同名 section** —— Grafana 用的 go-ini 遇到两个 `[auth.anonymous]` 会**直接启动失败**，末尾已有就改它；
> 3. **别改错文件** —— 真正生效的是 `/etc/grafana/grafana.ini`，`/usr/share/grafana/conf/defaults.ini` 是模板，改了没用。

---

## 配置

运行期配置的唯一入口是 `backend/apps/setting/models.py` 中的 `KEYS_DEFAULT`：
不在此字典里的键调用 `set()` 会抛 `KeyError`。Web 界面「系统设置」页操作的就是它。

生产环境必须通过环境变量或本地 `overrides.py` 注入密钥，**不要写死在代码里**：

| 环境变量 | 说明 |
|---|---|
| `EVERMODEL_SECRET_KEY` | Django SECRET_KEY，未设置时回退到仅供本地开发的默认值 |
| `EVERMODEL_MYSQL_PASSWORD` | 业务数据库账号密码 |
| `EVERMODEL_MYSQL_ROOT_PASSWORD` | 数据库 root 密码 |
| `EVERMODEL_MYSQL_HOST` / `_PORT` | 数据库地址与端口（默认 `127.0.0.1:3306`） |
| `EVERMODEL_REDIS_HOST` / `_PORT` | Redis 地址与端口（默认 `127.0.0.1:6379`） |
| `EVERMODEL_GRAFANA_URL` | Grafana 地址，用于监控大屏 |
