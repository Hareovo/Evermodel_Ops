# Evermodel Ops

轻量级、无 Agent 的自动化运维平台。

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
| 进程管理 | supervisor（5 个后端进程）+ systemd（守护 supervisor）+ nginx |

## 目录结构

```
evermodel_ops/
├── backend/                    Django 后端
│   ├── BUILD.md                后端构建与打包说明（产出 dist/*.tar.gz）
│   ├── apps/                   业务模块
│   │   ├── account/            账号
│   │   ├── host/               主机管理
│   │   ├── exec/               批量执行、文件分发
│   │   ├── schedule/           任务计划
│   │   ├── monitor/            监控检测
│   │   ├── alarm/              告警中心
│   │   ├── file/               文件管理
│   │   └── setting/            系统设置、接口文档、监控大屏
│   ├── consumer/               WebSocket 消费者（Web 终端、实时输出）
│   ├── libs/                   公共库（SSH 通道、告警通知、中间件）
│   ├── evermodel_ops/          Django 工程配置（settings.py / overrides.py）
│   ├── tools/                  后端自带脚本
│   │   ├── start-*.sh          5 个服务的启动命令（由 supervisor 调用）
│   │   ├── build_release.py    打后端发布包
│   │   └── migrate.py          版本升级时的数据迁移
│   ├── logs/  repos/  storage/ 运行期目录（不入库；logs 必须存在，否则进程起不来）
│   └── dist/                   后端发布包产出（不入库）
├── frontend/                   React 前端
│   ├── BUILD.md                前端构建与打包说明（产出 dist/*.tar.gz）
│   ├── src/  public/  scripts/ 源码与构建入口
│   ├── config-overrides.js     webpack 定制（含 Workbox 摘除补丁，勿删）
│   ├── build/                  构建产物 = nginx 站点根（不入库）
│   └── dist/                   前端发布包产出（不入库）
├── deploy/                     部署脚手架
│   ├── supervisor/             生产形态：后端 5 进程托管（supervisor + systemd）+ 启停命令文档
│   ├── nginx/                  容器内 nginx 站点配置
│   └── local/                  本机开发形态：Windows 数据层 + 启动脚本
├── db/                         数据库初始化（建库 / 建表 / 建管理员 / 默认设置）
├── docker-compose.yaml         数据层与网关（mysql / redis / nginx）
├── .env.example                compose 环境变量示例
└── README.md
```

### 先看哪个文档

| 要做什么 | 看哪里 |
|---|---|
| 起数据层（MySQL / Redis / Nginx） | 本文件「部署到 Linux 服务器」§2；配置在 `docker-compose.yaml` + `.env.example` |
| 初始化数据库、建管理员 | [`db/README.md`](db/README.md) |
| 构建前端、打前端发布包 | [`frontend/BUILD.md`](frontend/BUILD.md) |
| 构建后端、打后端发布包 | [`backend/BUILD.md`](backend/BUILD.md) |
| 托管后端 5 个进程、查各服务启停命令 | [`deploy/supervisor/README.md`](deploy/supervisor/README.md) |
| 改 nginx 反代规则 | [`deploy/nginx/evermodel_ops.conf`](deploy/nginx/evermodel_ops.conf) |
| 在本机 Windows 上开发调试 | [`deploy/local/README.md`](deploy/local/README.md) + [`docs/LOCAL_DEV_GUIDE.md`](docs/LOCAL_DEV_GUIDE.md) |

---

## 部署到 Linux 服务器

> 目标系统：Ubuntu 20.04 / 22.04 / 24.04（x86_64），其余发行版步骤同理。
> `deploy/supervisor/` 里的配置用 `__APP_DIR__` 占位符，`install.sh` 会替换成实际部署路径，
> 所以部署目录可以自选（本文档以 `/data/evermodel_ops` 为例）。

### 部署架构

```
浏览器
  │
  ▼
nginx:80 ──┬── /api/ws/ ──> 127.0.0.1:9002  daphne     WebSocket（Web 终端、执行实时输出）
           ├── /api/    ──> 127.0.0.1:9001  gunicorn   REST API
           └── 其余      ──> frontend/build           前端静态文件

systemd: evermodel_ops.service                 ← 守护 supervisor 本体（挂了自动重拉）
  └── supervisord（5 个后端进程，均在 backend/venv 内运行）
        ├── evermodel_ops-api         gunicorn :9001
        ├── evermodel_ops-ws          daphne   :9002
        ├── evermodel_ops-worker      批量执行 / 任务计划 / 监控的执行器
        ├── evermodel_ops-monitor     监控检测
        └── evermodel_ops-scheduler   任务计划调度

数据层（Docker，见根目录 docker-compose.yaml）
  ├── MariaDB   127.0.0.1:3306   库 evermodel_ops，账号 root / evermodel_ops（初始值）
  └── Redis     127.0.0.1:6379   业务队列 + WebSocket channel layer
```

配置全部集中在三处，别散着改：

| 关注点 | 位置 |
|---|---|
| 数据层与网关 | `docker-compose.yaml` + `.env` |
| 后端运行期配置（库地址、密码、Grafana 地址） | `backend/evermodel_ops/overrides.py` 或 `EVERMODEL_*` 环境变量 |
| 进程托管与日志 | `deploy/supervisor/` |

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

仓库根目录的 **`docker-compose.yaml`** 就是数据层与网关的单文件定义（mysql / redis / nginx），
复制一份环境变量文件后直接起，不需要手抄配置：

```bash
cd /data/evermodel_ops
cp .env.example .env      # ⚠️ 生产环境务必改 EVERMODEL_MYSQL_ROOT_PASSWORD
docker compose up -d

# 等数据库就绪（首次初始化数据卷需要十几秒）
until docker exec spug-mysql mysqladmin ping -h 127.0.0.1 -uroot -pevermodel_ops --silent; do sleep 2; done
echo "mysql ready"
docker compose ps
```

| 服务 | 容器名 | 端口 | 说明 |
|---|---|---|---|
| MariaDB 10.8 | `spug-mysql` | 3306（可用 `.env` 改） | 库 `evermodel_ops`，账号 `root` / `evermodel_ops` |
| Redis 7 | `spug-redis` | 6379 | 业务队列 + channel layer，AOF 持久化，别关 |
| nginx | `spug-nginx` | 80 | 前端静态文件 + `/api` 反代到宿主机 9001 / 9002 |

**接着初始化数据库**（建表、建管理员、写默认设置）：

```bash
bash db/init.sh
```

细节与排查见 [`db/README.md`](db/README.md)。

> - 数据持久化在 named volume（`mysql_data` / `redis_data`），重建容器不丢数据。
> - **改 `.env` 里的密码对已存在的数据卷无效**（镜像只在首次初始化数据卷时读这些变量）；
>   换密码要么 `docker compose down -v` 重建，要么在库里 `ALTER USER`，见 `db/README.md` §5。
> - 别和 `deploy/local/docker-compose.yml` 同时启动 —— 容器名与端口相同，是同一套栈的两种形态。

### 3. 部署后端

**打后端发布包**（完整说明见 [`backend/BUILD.md`](backend/BUILD.md)）：

```bash
# 开发机
cd backend
python tools/build_release.py
# -> backend/dist/evermodel_ops-v4.0.1.tar.gz（附 .sha256）
```

脚本会自动排除 `venv / __pycache__ / logs / repos / storage / overrides.py`，
并核对「归档条目数 == 磁盘文件数」，不一致直接中止。

```bash
scp dist/evermodel_ops-v4.0.1.tar.gz user@SERVER:/tmp/
```

```bash
# 服务器：解压到后端根目录（归档内不带 backend/ 前缀）
sudo mkdir -p /data/evermodel_ops/backend
sudo tar xzf /tmp/evermodel_ops-v4.0.1.tar.gz -C /data/evermodel_ops/backend
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

### 4. 进程托管（supervisor + systemd）

后端不是单个进程，而是 **1 个 REST API + 1 个 WebSocket + 3 个异步执行器 = 5 个常驻进程**。
托管方式：**supervisor 管 5 个进程，systemd 守护 supervisord 本体**，
配置全在 [`deploy/supervisor/`](deploy/supervisor/)。

```bash
sudo bash /data/evermodel_ops/deploy/supervisor/install.sh
```

脚本会：装 supervisor 包 → 建 `backend/logs` → 把配置里的 `__APP_DIR__` 占位符替换成
实际部署路径 → 装 systemd 单元 → `systemctl enable --now evermodel_ops` → 打印 5 个进程状态。

| supervisor 程序 | 实际执行的命令 | 作用 |
|---|---|---|
| `evermodel_ops-api` | `gunicorn -b 127.0.0.1:9001 -w 2 --threads 8 --access-logfile - evermodel_ops.wsgi` | REST API |
| `evermodel_ops-ws` | `daphne -p 9002 evermodel_ops.asgi:application` | WebSocket（主机终端、执行实时输出） |
| `evermodel_ops-worker` | `python manage.py runworker` | 批量执行 / 任务计划 / 监控的执行器 |
| `evermodel_ops-monitor` | `python manage.py runmonitor` | 监控检测 |
| `evermodel_ops-scheduler` | `python manage.py runscheduler` | 任务计划调度 |

```bash
# 常用
supervisorctl -c /etc/evermodel_ops/supervisord.conf status
sudo systemctl restart evermodel_ops            # 重启整组
sudo systemctl reload  evermodel_ops            # 改过程序配置后让它生效
```

> ⚠️ **只跑 `api` 不跑另外 4 个** → 平台打得开，但批量执行会卡在
> `Waiting for scheduling`、监控与任务计划完全不执行。
> ⚠️ `worker` / `scheduler` 启动时会清空对应 Redis 队列（防旧任务乱跑），
> 重启后堆积的任务需要**重新提交一次**。

**每个服务的启停命令、systemd 层命令、安装后自检、故障速查** →
[`deploy/supervisor/README.md`](deploy/supervisor/README.md)

### 5. 前端构建与 Nginx

**构建前端**（完整说明见 [`frontend/BUILD.md`](frontend/BUILD.md)）：

```bash
# 方式 A（推荐）：开发机构建后上传，服务器无需装 Node
cd frontend
npm install
npm run dist
# -> frontend/dist/evermodel_ops-frontend-v4.0.1.tar.gz（附 .sha256）
scp dist/evermodel_ops-frontend-v4.0.1.tar.gz user@SERVER:/tmp/
```

```bash
# 服务器：解压到 nginx 站点根目录（= frontend/build）
sudo mkdir -p /data/evermodel_ops/frontend/build
sudo tar xzf /tmp/evermodel_ops-frontend-v4.0.1.tar.gz -C /data/evermodel_ops/frontend/build
```

> 方式 B：服务器上装 Node 22
> （`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`）
> 后 `npm ci && npm run dist`。

**配置 Nginx** —— 反代规则已经写好在 [`deploy/nginx/evermodel_ops.conf`](deploy/nginx/evermodel_ops.conf)：

- 用根目录 compose 里的 **nginx 容器**：该文件已被挂载进容器，**不用另外配**。
- 用**宿主机 nginx**：把它复制到 `/etc/nginx/sites-available/evermodel_ops.conf`，改两处 ——
  `host.docker.internal` → `127.0.0.1`，`root /usr/share/nginx/html` →
  `root /data/evermodel_ops/frontend/build` —— 然后：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/evermodel_ops.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> 自己写反代时有两个必须记住的点：
> 1. `/api/` 要**剥掉 `/api` 前缀**（`rewrite ^/api(.*) $1 break;`）再转给 gunicorn；
> 2. 必须**透传 `Host` 与 `X-Real-IP`** —— 前者不过 Django 的 `ALLOWED_HOSTS` 会返回 400，
>    后者是 WebSocket 鉴权的一环；WebSocket 还要转发 `Upgrade` / `Connection` 两个头并把读超时放宽。

### 6. 验证

| 检查 | 命令 / 操作 | 期望 |
|---|---|---|
| 数据层 | `docker compose ps` | mysql / redis Up |
| 进程 | `supervisorctl -c /etc/evermodel_ops/supervisord.conf status` | 5 个进程全为 `RUNNING` |
| 静态页面 | `curl -I http://127.0.0.1/` | 200（返回登录页 HTML） |
| 反向代理 | `curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1/api/account/login/` | 200（登录接口免鉴权，说明已到后端） |
| 登录 | 浏览器 `http://SERVER/` → admin / 刚设的密码 | 落地 `/host` 主机管理页 |
| Web 终端 | 主机列表点「终端」 | 连上不自动断 |
| 监控 | 建一个监控项 | `latest_run_time` 有值、告警渠道能收到通知 |
| 批量执行 | 提交一个脚本 | 输出正常，不卡 `### Waiting for scheduling ...` |

### 7. 日常运维

**更新前端**：开发机 `cd frontend && npm run dist` → 上传解压覆盖 `/data/evermodel_ops/frontend/build`
→ 浏览器 **Ctrl+F5**（chunk 名带哈希，不需要重启任何进程）。

**更新后端**：开发机 `cd backend && python tools/build_release.py` → 上传解压覆盖
→ `source venv/bin/activate && pip install -r requirements.txt`
→ 有表结构变更时 `python manage.py updatedb` → `sudo systemctl restart evermodel_ops`。

**备份数据库**：

```bash
docker exec spug-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql
```

**常用命令**：

```bash
supervisorctl -c /etc/evermodel_ops/supervisord.conf status
sudo systemctl status evermodel_ops
docker compose ps
docker logs --tail 50 spug-mysql
tail -f /data/evermodel_ops/backend/logs/api.log
```

**三个异步队列（排查「提交了不动」）**：

```bash
redis-cli -n 1 llen spug:exec:worker      # 非 0 = worker 没消费
redis-cli -n 1 llen spug:monitor          # 非 0 = monitor 没消费
redis-cli -n 1 llen spug:schedule         # 非 0 = scheduler 没消费
```

### 8. 故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面 502 | gunicorn / daphne 没起 | `supervisorctl -c /etc/evermodel_ops/supervisord.conf status`；看 `logs/api.log` |
| 5 个进程全 `FATAL` / `spawn error` | **最常见**：`backend/logs/` 不存在（`stdout_logfile` 打不开），该目录不入库 | `sudo mkdir -p /data/evermodel_ops/backend/logs && sudo systemctl restart evermodel_ops` |
| 页面 404 / 空白 | 前端产物没上传到位 | 确认 `/data/evermodel_ops/frontend/build/index.html` 存在 |
| 接口 400 DisallowedHost | `ALLOWED_HOSTS` 没配 / Host 未透传 | 改 `overrides.py`；确认 nginx `proxy_set_header Host $host` |
| pip 装 mysqlclient 报 `mysql.h: No such file` | 缺编译依赖 | 装 `gcc pkg-config default-libmysqlclient-dev libssl-dev python3-dev` |
| 数据库连不上 | 容器没起 / 密码不一致 | `docker compose ps`；核对 `overrides.py` 与 `.env` 密码 |
| Web 终端连上几秒断开 | redis-py 8 默认 socket 超时 | 配置里的 `REDIS_POOL_KWARGS socket_timeout: None` 不要删（已内置） |
| 批量执行卡 `Waiting for scheduling` | worker 没起（不是脚本问题） | `supervisorctl -c /etc/evermodel_ops/supervisord.conf restart evermodel_ops-worker`，任务需重新提交 |
| 监控不执行 / 不告警 | monitor / scheduler 没起 | 同上；`redis-cli -n 1 llen spug:monitor` 非 0 即征兆。完整排查见 `deploy/supervisor/README.md` |

---

## 监控大屏（内嵌 Grafana）

菜单里的「监控大屏」用 iframe 把 Grafana 看板嵌进 `/grafana` 页面。**平台侧开箱可用**，
只需在 Grafana 那台机器上放行两件事，否则必然踩到这两种现象：

| 现象 | 原因 | 要改的开关 |
|---|---|---|
| iframe 一片空白 | Grafana 发了 `X-Frame-Options: deny` | `allow_embedding = true` |
| iframe 里弹出 Grafana 自己的登录页 | 匿名访问没开，iframe 带不上登录态 | `[auth.anonymous] enabled = true` |
| 看板某一排面板只剩内容、**标题不见了**，且右下方多一行 `Powered by Grafana` | Grafana 12.4+ 在 kiosk（嵌入）模式下会叠一条署名条，白底正好压住该位置的面板标题 | 已由平台处理：iframe URL 里带官方开关 `hideLogo=1`（见 §5） |

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

### 5. 已知现象：kiosk 署名条会压住面板标题

Grafana **12.4 起**，`?kiosk`（嵌入）模式会在视口底部叠一条白底的 `Powered by Grafana` 署名条
（DOM 上是 `data-testid="public-dashboard-footer"`，链接带 `cnt=kiosk-dashboard`）。
它是**绝对定位在「第一屏视口底部」的浮层**，不是页脚 —— 因为 iframe 高度（约 500px）远小于看板总高，
它正好停在中间某一排面板的标题位置，把那排标题整条盖掉，看起来像「看板少了一行文字」。

官方开关：URL 上加 `hideLogo=1`（Grafana 12.4+ 认这个参数，低版本会忽略，因此无需判断版本）。
平台已经在 `/grafana` 页面的 iframe URL 里带上了，见 `frontend/src/pages/grafana/store.js`。

> 为什么不换 `?kiosk=tv`：实测 `kiosk=tv` 虽然没有署名条，但会把 Grafana 的完整导航
> （Dashboard 面包屑、搜索框、Sign in）一起放出来，不适合大屏。

---

## 配置

运行期配置的唯一入口是 `backend/apps/setting/models.py` 中的 `KEYS_DEFAULT`：
不在此字典里的键调用 `set()` 会抛 `KeyError`。Web 界面「系统设置」页操作的就是它。

生产环境必须通过环境变量或本地 `overrides.py` 注入密钥，**不要写死在代码里**：

| 环境变量 | 说明 |
|---|---|
| `EVERMODEL_SECRET_KEY` | Django SECRET_KEY，未设置时回退到仅供本地开发的默认值 |
| `EVERMODEL_MYSQL_DB` | 库名，默认 `evermodel_ops` |
| `EVERMODEL_MYSQL_USER` | 数据库账号，默认 `root` |
| `EVERMODEL_MYSQL_PASSWORD` | 数据库密码，默认 `evermodel_ops`（**生产必须改**） |
| `EVERMODEL_MYSQL_ROOT_PASSWORD` | 数据库 root 密码 |
| `EVERMODEL_MYSQL_HOST` / `_PORT` | 数据库地址与端口（默认 `127.0.0.1:3306`） |
| `EVERMODEL_REDIS_HOST` / `_PORT` | Redis 地址与端口（默认 `127.0.0.1:6379`） |
| `EVERMODEL_GRAFANA_URL` | Grafana 地址，用于监控大屏 |
