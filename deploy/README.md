# 部署（deploy/）

平台部署所需的一切都在这个目录里 —— **只有配置和文档，没有脚本**，全部手工执行。

```
deploy/
├── docker-compose.yaml        数据层与网关：MariaDB + Redis + nginx（标准形态）
├── db/                        数据库初始化
│   ├── init.sql               建库 + 建/授权账号 + 字符集
│   ├── init.defaults.sql      平台默认设置（建表之后执行）
│   └── README.md              四步初始化命令 + 故障速查
├── nginx/
│   └── evermodel_ops.conf     容器内 nginx 站点配置（静态文件 + /api 反向代理）
├── supervisor/                后端 5 个进程托管（supervisor + systemd）
│   ├── supervisord.conf       supervisord 主配置
│   ├── evermodel_ops.conf     5 个 [program:*] 定义（含 __APP_DIR__ 占位符）
│   ├── evermodel_ops.service  systemd 单元，守护 supervisord 本体
│   └── README.md              逐服务启停命令 + 自检 + 故障速查
└── README.md                  本文件
```

| 组成 | 解决什么问题 | 入口文档 |
|---|---|---|
| `docker-compose.yaml` | 数据层与网关一次起好：MariaDB 10.8、Redis 7、nginx | 本文件 §一 |
| `db/` | 库是空的 —— 建库、建表、建管理员、写默认设置 | [`db/README.md`](db/README.md) |
| `nginx/` | 反代规则：`/api` 剥前缀转 gunicorn、`/api/ws/` 转 daphne、SPA 回退 index.html | [`nginx/evermodel_ops.conf`](nginx/evermodel_ops.conf) |
| `supervisor/` | 后端不是单进程，是 5 个常驻进程；谁拉起它们、挂了怎么办、日志写哪、单个怎么重启 | [`supervisor/README.md`](supervisor/README.md) |

---

## 〇、服务器依赖（只装一次）

目标系统 Ubuntu 20.04 / 22.04 / 24.04（x86_64），其余发行版包名同理。

```bash
sudo apt update
# python 编译环境（mysqlclient 需要编译）+ supervisor + 主机管理 / 监控依赖
sudo apt install -y python3 python3-venv python3-dev gcc pkg-config \
    default-libmysqlclient-dev libssl-dev \
    supervisor nginx git curl \
    sshpass rsync sshfs iputils-ping net-tools procps
```

| 包 | 少了会怎样 |
|---|---|
| `python3-dev` `gcc` `pkg-config` `default-libmysqlclient-dev` `libssl-dev` | 编译 `mysqlclient` 报 `mysql.h: No such file` |
| `sshpass` `rsync` `sshfs` | 主机管理、文件分发功能不可用 |
| `iputils-ping` | Ping 类监控检测不可用 |

Node **不需要**装在服务器上（前端在开发机打包后上传，见步骤 ④）。

装 Docker（跑数据库与 Redis 用，已有实例可跳过）：

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
```

## 一、部署顺序（4 步）

以 `/data/evermodel_ops` 为例。每步的完整命令在对应文档里，这里只给主干。

```bash
APP_DIR=/data/evermodel_ops

# ① 数据层与网关 —— MariaDB / Redis / nginx
cd $APP_DIR/deploy
docker compose up -d

# ② 数据库初始化 —— 建库 → 建表 → 建管理员 → 写默认设置
#    四条命令见 deploy/db/README.md 第一节

# ③ 后端 5 个进程 + systemd 守护
#    五条命令见 deploy/supervisor/README.md 第二节

# ④ 前端产物 —— 开发机 npm run dist 后上传
#    解压到 $APP_DIR/frontend/build，nginx 容器挂载的就是这个目录
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
> 对照表见 [`supervisor/README.md`](supervisor/README.md) §三。

## 三、为什么这里没有一键脚本

本目录刻意**只放配置、不放 shell 脚本**：部署是低频、需要边看边判断的操作，
一条条手工执行才能看清每一步在动什么；脚本反而会把「失败在哪一步」藏起来。
所以原来的 `deploy/supervisor/install.sh` 与 `db/init.sh` 已移除 ——
对应步骤改成文档里可**直接复制粘贴**的命令序列（见各自的 README）。

> 例外：`backend/tools/start-*.sh`（5 个）不是部署脚本，而是**进程启动包装** ——
> supervisor 的 `command` 指向它们，里面只做 `cd backend && source venv/bin/activate`
> 再 `exec` 真正的程序，属于应用代码，故留在 `backend/`。

## 四、与仓库其他部分的关系

| 部分 | 位置 |
|---|---|
| 应用代码 | `backend/`（Django）、`frontend/`（React） |
| 部署资产（本目录） | `deploy/` |
| 架构说明与二开改动记录 | 本地 `docs/` 目录（**已在 `.gitignore` 中，不入库**） |
