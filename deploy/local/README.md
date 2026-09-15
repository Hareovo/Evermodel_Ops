# 本机开发形态（Windows + Docker Desktop）

数据层跑在 Docker 里，后端跑在宿主机 venv 里 —— 改 Python 代码热重载即时生效，方便二开调试。
生产形态（supervisor + systemd 托管 5 进程）见 `../supervisor/README.md`。

```
浏览器 ──> nginx 容器（:80）
             ├── /api/ws/  ──> host.docker.internal:8000   Django dev server
             ├── /api/     ──> host.docker.internal:8000   （HTTP 与 WS 同一进程同一端口）
             └── 其余      ──> frontend/build 静态文件

宿主机
  └── backend   venv
                ├── start-backend.bat   后端（runserver 0.0.0.0:8000，含 WebSocket）
                └── start-jobs.bat      worker / scheduler / monitor 三个窗口
```

## 端口与凭据

| 容器 | 端口 | 说明 |
|---|---|---|
| spug-mysql | 13306 → 3306 | 库 `spug`，`root / spug.cc`（业务账号 `spug / spug.cc`） |
| spug-redis | 6379 | 业务数据在 **DB 1**，DB 0 是 channels |
| spug-nginx | 80 | 入口 |

> 宿主机 3306 通常被别的服务占着，所以这里映射 **13306**。
> 口令写在 `.env`（不入库），首次使用从 `.env.example` 复制一份。

## 启动（每天开机后）

```bat
:: 1. 数据层
cd /d D:\Code\evermodel_ops\deploy\local
docker compose up -d

:: 2. 后端（双击，或手动执行）
start-backend.bat

:: 3. 异步三进程（双击，会开三个窗口）
start-jobs.bat
```

浏览器打开 <http://127.0.0.1/>（走 nginx 80 入口，不要直接访问 8000），登录后落地 `/host`。

⚠️ **只跑第 2 步 = 页面能建任务但永远不执行、不告警。** 三个进程都不在后端进程里。
排查手法见 `docs/LOCAL_DEV_GUIDE.md` 第五节。

## ⚠️ 不要与根目录的 docker-compose.yaml 同时启动

两者是同一套栈的两种形态，**容器名与端口完全相同**，同时起会冲突：

| | 根 `docker-compose.yaml`（标准 / 生产形态） | 本目录（本机开发形态） |
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
| `start-backend.bat` | 启动 Django dev server |
| `start-jobs.bat` | 一次开三个窗口：worker / scheduler / monitor |
| `start-worker.bat` / `start-scheduler.bat` / `start-monitor.bat` | 单进程启动，被 `start-jobs.bat` 调用 |
| `local-settings.sql` | 本地用到的运行期配置项 |
| `grafana-allow-embed.sh` | 给外部 Grafana 打开 `allow_embedding` + 匿名访问（监控大屏 iframe 用） |
| `.env` / `.env.example` | 数据库口令（`.env` 不入库） |

## 相关文档

- 本地操作手册（启动顺序、健康检查、故障速查）：`docs/LOCAL_DEV_GUIDE.md`
- 二开改动全清单（改过哪些文件、为什么）：`docs/FILE_CHANGES.md`
- 生产部署总览：`deploy/README.md`
- 生产进程托管与逐服务启停命令：`deploy/supervisor/README.md`
