# Evermodel Ops

轻量级、无 Agent 的自动化运维平台。

主机纳管、批量执行、任务计划、监控告警、文件分发、Web 终端 —— 一套 Web 界面即可完成，
**不需要在被管机器上安装任何 Agent**，只要 SSH 可达。

- **部署形态**：Ubuntu + Docker（数据层）+ supervisor / systemd（后端 5 进程）+ nginx
- **没有一键脚本**：部署步骤全部在 [`deploy/`](deploy/) 下逐条写明，拷贝粘贴即可执行
- **本文件只做地图**：具体命令一律在子文档里，不在多处各写一遍

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
| 后端 | Python 3.13 · Django 4.2 · Django Channels 4 |
| 任务队列 | Redis · 自研轻量队列（不依赖 Celery） |
| 前端 | React 16 · Ant Design 4 · `react-scripts` 3.4.3 + react-app-rewired |
| 数据库 | MariaDB 10.8（兼容 MySQL）· utf8mb4 |
| 进程与网关 | supervisor（5 个后端进程）+ systemd（守护 supervisor）+ nginx |

> **REST 与 WebSocket 是两个端口**：gunicorn 服务 `:9001` 的 REST API，daphne 服务 `:9002` 的 WebSocket。
> 两者是同一个 ASGI 应用（`backend/evermodel_ops/asgi.py`），但部署上分开跑，各自可独立重启。
>
> **前端是 CRA 3**（`react-scripts` 3.4.3），**不支持 `BUILD_PATH`** —— 站点根目录固定为
> `frontend/build`，发布包另放 `frontend/dist`。别试图把构建输出改到 `dist`，会白折腾。

## 文档索引

| 我想… | 看这里 |
|---|---|
| 部署到服务器（从零到能登录） | [`deploy/README.md`](deploy/README.md) —— 服务器依赖 + 四步主干 |
| 起数据层（MariaDB / Redis / nginx） | [`deploy/docker-compose.yaml`](deploy/docker-compose.yaml) |
| 初始化数据库、建管理员 | [`deploy/db/README.md`](deploy/db/README.md) |
| 托管后端 5 个进程 / 查某个服务的启停命令 | [`deploy/supervisor/README.md`](deploy/supervisor/README.md) |
| 改 nginx 反代规则 | [`deploy/nginx/evermodel_ops.conf`](deploy/nginx/evermodel_ops.conf) |
| 打前端 / 后端发布包 | [`frontend/BUILD.md`](frontend/BUILD.md) · [`backend/BUILD.md`](backend/BUILD.md) |
| 接通 Grafana 监控大屏 | 本文「监控大屏」 |
| 排查故障 | 本文「故障速查」· [`deploy/supervisor/README.md`](deploy/supervisor/README.md) §七 |

> `docs/` 目录（源码架构说明、本机开发手册、逐文件二开改动记录）是**本地文档，已在 `.gitignore` 中**，
> clone 下来看不到 —— 所以本 README 刻意不依赖它，上面每一条都指向仓库内的文件。

## 目录结构

```
evermodel_ops/
├── backend/                    Django 后端（BUILD.md = 打包说明，产出 dist/*.tar.gz）
│   ├── apps/                   业务模块：host 主机 · exec 批量执行与分发 · schedule 任务计划
│   │                           monitor 监控检测 · alarm 告警中心 · file 文件管理
│   │                           account 账号 · setting 系统设置 / 接口文档 / 监控大屏
│   ├── consumer/               WebSocket 消费者（Web 终端、执行实时输出）
│   ├── libs/                   公共库（SSH 通道、告警通知、中间件、解析器）
│   ├── evermodel_ops/          Django 工程配置（settings.py · asgi.py · overrides.py.example）
│   ├── tools/                  start-*.sh（5 个启动包装，被 supervisor 调用）· build_release.py · migrate.py
│   ├── logs/ repos/ storage/   运行期目录（不入库；⚠️ logs/ 必须存在，否则 5 个进程起不来）
│   └── dist/                   后端发布包产出（不入库）
├── frontend/                   React 前端（BUILD.md = 打包说明，产出 dist/*.tar.gz）
│   ├── src/  public/  scripts/ 源码与构建入口（scripts/run.js 是跨平台构建入口）
│   ├── config-overrides.js     webpack 定制（含 Workbox 摘除补丁，勿删）
│   ├── build/                  构建产物 = nginx 站点根（不入库）
│   └── dist/                   前端发布包产出（不入库）
├── deploy/                     部署资产 —— 只有配置与文档，没有脚本
│   ├── README.md               部署总览 + 服务器依赖 + 四步主干
│   ├── docker-compose.yaml     数据层与网关：MariaDB / Redis / nginx
│   ├── db/                     数据库初始化 SQL + 四步命令说明
│   ├── nginx/                  容器内 nginx 站点配置
│   └── supervisor/             后端 5 进程托管（supervisor + systemd）+ 逐服务启停命令
├── LICENSE                     AGPL-3.0
└── README.md
```

> 另有 `docs/` 目录（源码架构说明、本机开发手册、逐文件二开改动记录），**已在 `.gitignore` 中、不入库**。

## 运行架构

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

数据层（Docker，见 deploy/docker-compose.yaml）
  ├── MariaDB   127.0.0.1:3306   库 evermodel_ops，账号 root / compose 中配置的初始值
  └── Redis     127.0.0.1:6379   业务队列 + WebSocket channel layer
```

配置集中在三处，别散着改：

| 关注点 | 位置 |
|---|---|
| 数据层与网关 | `deploy/docker-compose.yaml` |
| 后端运行期配置（库地址、密码、Grafana 地址） | `backend/evermodel_ops/overrides.py` 或 `EVERMODEL_*` 环境变量 |
| 进程托管与日志 | `deploy/supervisor/` |

## 部署到服务器

推荐部署结构:Docker Compose 运行 MariaDB、Redis、nginx;宿主机虚拟环境运行后端 5 个进程,由 supervisor + systemd 托管。Compose 不依赖 `.env` 文件,中间件数据保存在 `deploy/data/` 下。

> 📄 **完整逐步部署指南见 [`deploy/INSTALL.md`](deploy/INSTALL.md)**,含依赖安装、中间件、初始化、supervisor 一键托管、前端发布、验证与常见问题。以下为命令速览。

目标系统为 Ubuntu 20.04/22.04/24.04:

```bash
# 1. 安装依赖并进入项目
sudo apt update
sudo apt install -y python3 python3-venv python3-dev gcc pkg-config \
  default-libmysqlclient-dev libssl-dev supervisor docker.io \
  sshpass rsync sshfs iputils-ping curl
sudo systemctl enable --now docker
cd /opt
# 将项目上传或 clone 到 /opt/evermodel_ops
cd /opt/evermodel_ops

# 2. 启动 MariaDB、Redis、nginx(数据在 deploy/data/)
docker compose -f deploy/docker-compose.yaml up -d

# 3. 创建 Python 环境并安装后端依赖
cd backend
python3 -m venv venv
. venv/bin/activate
pip install -r requirements.txt
cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py

# 4. 初始化数据库、默认设置和管理员
cd /opt/evermodel_ops
export EVERMODEL_MYSQL_PASSWORD=evermodel_ops
export EVERMODEL_ADMIN_PASSWORD='请修改为管理员密码'
./deploy/init.sh

# 5. 一键安装 supervisor + systemd,托管 5 个后端进程
#    首次会生成 /etc/evermodel_ops/environment,须在其中填写真实密钥后再启动
sudo ./deploy/supervisor/install.sh /opt/evermodel_ops

# 6. 前端产物:开发机 npm run dist 后上传解压到 frontend/build/
```

**装完自检**（三条都要通过）：

```bash
supervisorctl -c /etc/evermodel_ops/supervisord.conf status   # 5 个进程全 RUNNING
ss -lntp | grep -E ':9001|:9002'                              # 两个端口都在听
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/    # 200（返回登录页）
```

然后浏览器打开 `http://SERVER/`，用 `admin` + 步骤 ② 设的密码登录，落地 `/host` 主机管理页。

### 日常更新

| 改了什么 | 怎么发布 |
|---|---|
| 前端 | 开发机 `cd frontend && npm run dist` → 上传解压覆盖 `frontend/build` → 浏览器 **Ctrl+F5**（chunk 名带哈希，不用重启任何进程） |
| 后端 | 开发机 `cd backend && python tools/build_release.py` → 上传解压覆盖 → `pip install -r requirements.txt` → 有表结构变更时 `manage.py updatedb` → `sudo systemctl restart evermodel_ops` |
| 进程配置 | 改 `deploy/supervisor/evermodel_ops.conf` 后同步到 `/etc/evermodel_ops/conf.d/` → `sudo systemctl reload evermodel_ops` |

备份数据库：

```bash
docker exec evermodel-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql
```

### 故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面 502 | gunicorn / daphne 没起 | `supervisorctl -c /etc/evermodel_ops/supervisord.conf status`；看 `logs/api.log` |
| 5 个进程全 `FATAL` / `spawn error` | **最常见**：`backend/logs/` 不存在（`stdout_logfile` 打不开），该目录不入库 | `sudo mkdir -p /data/evermodel_ops/backend/logs && sudo systemctl restart evermodel_ops` |
| 页面 404 / 空白 | 前端产物没上传到位 | 确认 `frontend/build/index.html` 存在 |
| 接口 400 DisallowedHost | `ALLOWED_HOSTS` 没配 / Host 未透传 | 改 `overrides.py`；确认 nginx 有 `proxy_set_header Host $host` |
| 接口 401，但用登录接口探又是 200 | 探了需要鉴权的接口 | `/account/login/` 在免鉴权白名单里，探活用它 |
| pip 装 mysqlclient 报 `mysql.h: No such file` | 缺编译依赖 | 装 `python3-dev gcc pkg-config default-libmysqlclient-dev libssl-dev` |
| 数据库连不上 | 容器没起 / 密码不一致 | `cd deploy && docker compose ps`；核对 supervisor 环境变量与 `overrides.py` |
| Web 终端连上几秒断开 | redis-py 8 默认 socket 超时 | 配置里的 `REDIS_POOL_KWARGS socket_timeout: None` 不要删（已内置） |
| 批量执行卡 `### Waiting for scheduling ...` | worker 没起（**不是脚本问题**） | `supervisorctl -c /etc/evermodel_ops/supervisord.conf restart evermodel_ops-worker`，任务需重新提交 |
| 监控不执行 / 不告警 | monitor / scheduler 没起 | 同上；`redis-cli -n 1 llen spug:monitor` 非 0 即征兆。完整排查见 [`deploy/supervisor/README.md`](deploy/supervisor/README.md) §七 |

## 监控大屏（内嵌 Grafana）

菜单里的「监控大屏」用 iframe 把 Grafana 看板嵌进 `/grafana` 页面。**平台侧开箱可用**，
只需在 Grafana 那台机器上放行两件事，否则必然踩到这两种现象：

| 现象 | 原因 | 要改的开关 |
|---|---|---|
| iframe 一片空白 | Grafana 发了 `X-Frame-Options: deny` | `allow_embedding = true` |
| iframe 里弹出 Grafana 自己的登录页 | 匿名访问没开，iframe 带不上登录态 | `[auth.anonymous] enabled = true` |

### 方法一：环境变量（推荐，容器重建也保留）

给 Grafana 的 compose 服务补三行，然后**重建容器**：

```yaml
  grafana:
    image: grafana/grafana:13.2.1
    environment:                                # ← 新增这三行
      - GF_SECURITY_ALLOW_EMBEDDING=true        # 允许被 iframe 嵌套
      - GF_AUTH_ANONYMOUS_ENABLED=true          # 开启匿名访问
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer       # 匿名角色：只读
```

```bash
docker compose up -d grafana        # ⚠️ 必须 up -d 重建，docker restart 无效
```

> **为什么 `restart` 没用**：环境变量是容器**创建**时写进去的，`restart` 只重启进程、读的还是旧配置。
> 数据不会丢 —— 看板 / 用户 / 数据源都在挂载卷里，重建只是换了个容器壳。
> 不放心可先备份：`cp -a ./grafana-data ./grafana-data.bak-$(date +%F)`。

裸 `docker run` 时：`docker rm -f <容器名>` 后带这三个 `-e` 重新 `docker run`，
**端口与 `-v` 挂载必须原样带上**，否则数据会丢。

### 方法二：改 grafana.ini（不想动容器时）

编辑**宿主机挂载进去的那个** ini，改完 `docker restart <容器名>` 即可（改的是挂载文件，重启就生效）：

```ini
[security]
allow_embedding = true

[auth.anonymous]
enabled = true
org_name = Main Org.
org_role = Viewer
```

查实际路径（`docker inspect` 那条命令输出为空 = ini 只在容器里，那就要进容器改）：

```bash
docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/grafana/grafana.ini"}}{{.Source}}{{end}}{{end}}' <容器名>
```

> ⚠️ 三个坑：
> 1. **环境变量优先于 ini** —— 容器里若已有 `GF_AUTH_ANONYMOUS_ENABLED=false`，改 ini 不生效，得改那个变量；
> 2. **别重复写同名 section** —— Grafana 用的 go-ini 遇到两个 `[auth.anonymous]` 会**直接启动失败**，末尾已有就改它；
> 3. **别改错文件** —— 真正生效的是 `/etc/grafana/grafana.ini`，`/usr/share/grafana/conf/defaults.ini` 是模板，改了没用。

### 验证

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://<grafana-host>:3000/api/search?type=dash-db  # 期望 200（改前 401）
curl -s -I http://<grafana-host>:3000/login | grep -i x-frame-options                       # 期望无输出（改前 deny）
```

两条都符合后刷新平台页面，大屏顶部的黄色告警会消失，看板直接显示。
还不行就按这个顺序查：**改错文件 → 环境变量压回去了 → 没真正重建 → 只改了容器内文件 →
前置 nginx 自己加了头 → 改的是另一台 Grafana**。
判定口诀：`/api/search` 返 200 **且**响应头无 `X-Frame-Options` = Grafana 侧已就绪。

平台侧地址在「系统设置 → 监控大屏」里填，也可用 `EVERMODEL_GRAFANA_URL` 做首次部署（界面保存后以界面为准）。

> ⚠️ **安全提示**：开启匿名访问 = **同一网段内任何人都能免登录查看 Grafana**，包括所有看板暴露的指标。
> 靠网络隔离兜底：Grafana 只监听内网、不对外暴露；需要公网访问时另配反向代理 + 认证。

### 已知现象：kiosk 署名条会压住面板标题

Grafana **12.4 起**，`?kiosk`（嵌入）模式会在**第一屏视口底部**叠一条白底的 `Powered by Grafana`
署名条（DOM 上 `data-testid="public-dashboard-footer"`）。iframe 高度（约 500px）远小于看板总高，
它正好停在中间某一排面板的标题处，把那排标题整条盖掉，看起来像「看板少了一行文字」。

官方开关：URL 上加 `hideLogo=1`（12.4+ 认这个参数，低版本忽略，因此无需判断版本）。
平台已在 `/grafana` 页面的 iframe URL 里带上，见 `frontend/src/pages/grafana/store.js`。

> 为什么不换 `?kiosk=tv`：它虽然没有署名条，但会把 Grafana 的完整导航
> （Dashboard 面包屑、搜索框、Sign in）一起放出来，不适合大屏。

## 配置

运行期配置的唯一入口是 `backend/apps/setting/models.py` 的 `KEYS_DEFAULT` ——
不在此字典里的键调用 `set()` 会抛 `KeyError`。Web 界面「系统设置」页操作的就是它。

**环境变量分两侧，别混在一起找**：

| 侧 | 定义位置 | 变量 |
|---|---|---|
| 容器侧（数据层与网关） | `deploy/docker-compose.yaml` | 端口与初始密码直接写在 compose；生产部署后按文档修改并同步后端环境 |
| 后端侧（5 个进程） | `backend/evermodel_ops/overrides.py`，或 supervisor 各 `[program:*]` 的 `environment=` 行 | 见下表 |

| 后端环境变量 | 说明 |
|---|---|
| `EVERMODEL_SECRET_KEY` | Django SECRET_KEY，未设置时回退到仅供本地开发的默认值 |
| `EVERMODEL_MYSQL_HOST` / `_PORT` | 数据库地址与端口，默认 `127.0.0.1:3306` |
| `EVERMODEL_MYSQL_DB` / `_USER` / `_PASSWORD` | 库名 / 账号 / 密码 |
| `EVERMODEL_REDIS_HOST` / `_PORT` | Redis 地址与端口，默认 `127.0.0.1:6379` |
| `EVERMODEL_GRAFANA_URL` | Grafana 地址，用于监控大屏 |
| `EVERMODEL_VERSION` | 版本号，打包时读取，用于发布包命名 |

> ⚠️ **数据库凭据的默认值不一致，第一次部署必须对齐**：
> `overrides.py.example` 里的兜底默认沿用了上游，是库 `spug` / 账号 `spug` / 密码 `change-me`；
> 而 `deploy/db/init.sql` 建的是库 `evermodel_ops`、账号 `root` / `evermodel_ops`。
> 所以二者必须显式对齐 —— 要么在 `overrides.py` 里写死，要么把
> `EVERMODEL_MYSQL_DB=evermodel_ops`、`EVERMODEL_MYSQL_USER=root`、`EVERMODEL_MYSQL_PASSWORD=...`
> 注入后端进程。**生产环境务必改掉 `evermodel_ops` 这个初始密码，不要写死在代码里。**
