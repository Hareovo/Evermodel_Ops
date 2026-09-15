# 部署脚手架（deploy/）

这里放**怎么把平台跑起来**的东西。应用本身的代码在 `backend/` 与 `frontend/`，
数据层的容器定义在仓库根的 `docker-compose.yaml`，数据库初始化在 `db/`。

```
deploy/
├── supervisor/     生产形态：后端 5 个进程的托管（supervisor + systemd）+ 各服务启停命令
├── nginx/          容器内 nginx 站点配置（前端静态文件 + /api 反向代理）
└── local/          本机开发形态：Windows + Docker Desktop 的数据层与启动脚本
```

| 目录 | 解决什么问题 | 入口文档 |
|---|---|---|
| `supervisor/` | 后端不是单进程，是 5 个常驻进程；谁拉起它们、挂了怎么办、日志写哪、单个怎么重启 | [`supervisor/README.md`](supervisor/README.md) |
| `nginx/` | nginx 反代规则：`/api` 剥前缀转 gunicorn、`/api/ws/` 转 daphne、SPA 回退 index.html | [`nginx/evermodel_ops.conf`](nginx/evermodel_ops.conf) |
| `local/` | 在本机 Windows 上开发调试时的快捷启动（数据层 13306、后端 `runserver` 热重载、三个 job 进程） | [`local/README.md`](local/README.md) |

## 一、最短路径

```bash
# ① 数据层与网关（仓库根）
cp .env.example .env          # 生产环境改密码
docker compose up -d

# ② 数据库初始化（建库 / 建表 / 建管理员 / 默认设置）
bash db/init.sh

# ③ 后端 5 个进程 + systemd 守护
sudo bash deploy/supervisor/install.sh

# ④ 前端产物（开发机构建后上传，见 frontend/BUILD.md）
#    解压到 frontend/build —— nginx 容器挂载的就是这个目录
```

装完自检：

```bash
supervisorctl -c /etc/evermodel_ops/supervisord.conf status   # 5 个 RUNNING
ss -lntp | grep -E ':9001|:9002'                              # 两个端口在听
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/    # 200
```

## 二、进程拓扑

```
systemd  evermodel_ops.service          ← 守护 supervisord 本体
  └── supervisord -n                    ← 拉起/监控/重启下面 5 个
        ├── evermodel_ops-api           gunicorn  :9001   REST API
        ├── evermodel_ops-ws            daphne    :9002   WebSocket
        ├── evermodel_ops-worker        批量执行 / 任务计划 / 监控 的执行器
        ├── evermodel_ops-monitor       监控检测
        └── evermodel_ops-scheduler     任务计划调度

nginx:80 ──┬── /api/ws/  ──> :9002
           ├── /api/     ──> :9001
           └── 其余      ──> frontend/build
```

> ⚠️ 少起 `worker` / `monitor` / `scheduler` 的后果是「平台看着正常、功能不工作」，
> 对照表见 `supervisor/README.md` §三。

## 三、其他

- 本机 Windows 开发环境的脚手架在 `deploy/local/`（端口 13306、后端 `runserver` 热重载），
  与这里是同一套栈的两种形态，**不要同时启动**（容器名与端口相同）。
- 早先的 `deploy-ubuntu/` 已移除：容器定义并入根 `docker-compose.yaml`，库初始化并入 `db/`，
  supervisor 与 nginx 部分并入本目录。
