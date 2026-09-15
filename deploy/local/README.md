# 本机开发形态（Windows + Docker Desktop）

数据层跑在 Docker 里，后端跑在宿主机 venv 里 —— 改 Python 代码热重载即时生效，方便二开调试。
生产形态（supervisor + systemd 托管 5 进程）见 `../supervisor/README.md`。

```
浏览器 ──> nginx 容器（:80）
             ├── /api/ws/  ──> host.docker.internal:8000   Django dev server
             ├── /api/     ──> host.docker.internal:8000   （HTTP 与 WS 同一进程同一端口）
             └── 其余      ──> frontend/build 静态文件

宿主机  backend/venv
          ├── 终端 1   manage.py runserver 0.0.0.0:8000   后端（HTTP + WebSocket）
          ├── 终端 2   manage.py runworker
          ├── 终端 3   manage.py runmonitor
          └── 终端 4   manage.py runscheduler
```

> 本目录**只放配置、不放脚本** —— 启动命令在下方「启动」一节，逐条照抄即可。
> 原 `start-*.bat` 启动器与 `grafana-allow-embed.sh` 已移除，改为手工执行。

## 端口与凭据

| 容器 | 端口 | 说明 |
|---|---|---|
| spug-mysql | 13306 → 3306 | 库 `spug`，`root / spug.cc`（业务账号 `spug / spug.cc`） |
| spug-redis | 6379 | 业务数据在 **DB 1**，DB 0 是 channels |
| spug-nginx | 80 | 入口 |

> 宿主机 3306 通常被别的服务占着，所以这里映射 **13306**。
> 口令写在 `.env`（不入库），首次使用从 `.env.example` 复制一份。

## 启动（每天开机后）

四个终端窗口，各跑一条命令。

```bash
# ① 数据层 —— 在本目录执行
cd D:\Code\evermodel_ops\deploy\local
docker compose up -d

# ② 后端：HTTP + WebSocket（终端 1）
cd D:\Code\evermodel_ops\backend
./venv/Scripts/python.exe manage.py runserver 0.0.0.0:8000

# ③ 异步三进程（终端 2 / 3 / 4，各一条，别漏）
cd D:\Code\evermodel_ops\backend
./venv/Scripts/python.exe manage.py runworker
./venv/Scripts/python.exe manage.py runmonitor
./venv/Scripts/python.exe manage.py runscheduler
```

浏览器打开 <http://127.0.0.1/>（走 nginx 80 入口，不要直接访问 8000），登录后落地 `/host`。

⚠️ **只跑 ② 不跑 ③ = 页面能建任务但永远不执行、不告警。** 三个进程都不在后端进程里。
`runserver` 自带热重载，改 Python 代码无需手动重启；但**改被多个进程读取的配置（如告警署名）
要连同 ③ 的三个进程一起重启**。完整排查手法见本地 `docs/LOCAL_DEV_GUIDE.md` 第五节（该目录不入库）。

## ⚠️ 不要与 deploy/docker-compose.yaml 同时启动

两者是同一套栈的两种形态，**容器名与端口完全相同**，同时起会冲突：

| | `deploy/docker-compose.yaml`（标准 / 生产形态） | 本目录（本机开发形态） |
|---|---|---|
| compose 项目名 | `evermodel_ops` | `spug-dev` |
| mysql 库 | `evermodel_ops` | `spug` |
| mysql 端口 | 3306（可用 `.env` 改） | 13306 |
| nginx 反代到 | 9001 / 9002（supervisor 托管的 gunicorn / daphne） | 8000（`manage.py runserver`） |

> 项目名（`name:`）**不要改** —— 数据卷名由它决定（`spug-dev_mysql_data`），改了会挂不上已有数据。

## 文件说明

| 文件 | 用途 |
|---|---|
| `docker-compose.yml` | 本机数据层：mysql + redis + nginx |
| `nginx.conf` | 容器 nginx 站点配置，反代到宿主机 8000 |
| `local-settings.sql` | 本地用到的运行期配置项 |
| `.env` / `.env.example` | 数据库口令（`.env` 不入库） |

## 相关文档

- 生产部署总览：`deploy/README.md`
- 生产进程托管与逐服务启停命令：`deploy/supervisor/README.md`

> 另有本地文档（**不入库，clone 看不到**）：`docs/LOCAL_DEV_GUIDE.md`（启动顺序、健康检查、故障速查）、
> `docs/FILE_CHANGES.md`（二开改动全清单）、`docs/ARCHITECTURE_UNDERSTANDING.md`（源码分层）。
