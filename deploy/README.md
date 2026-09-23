# 部署（deploy/）

Evermodel Ops 的部署入口。

## 部署形态：1 + 1 + 5

- **1 个前端**：React 静态产物，由 nginx 容器挂载 `frontend/build` 伺服
- **1 个后端代码库**：Django 工程，宿主机 `backend/venv` 内运行
- **5 个后端服务进程**：由 supervisor + systemd 托管

```
浏览器 ── :80 ── nginx 容器 (evermodel-nginx)
                     ├── /        → frontend/build        （前端静态产物）
                     ├── /api/    → 宿主机 gunicorn :9001 （REST API）
                     └── /api/ws/ → 宿主机 daphne   :9002 （WebSocket）

宿主机
  ├── backend/venv  → 5 个后端进程（supervisor + systemd 托管）
  │     ├── evermodel_ops-api        gunicorn :9001   REST API
  │     ├── evermodel_ops-ws         daphne   :9002   WebSocket
  │     ├── evermodel_ops-worker     批量执行 / 任务计划 / 监控的执行器
  │     ├── evermodel_ops-monitor    监控检测
  │     └── evermodel_ops-scheduler  任务计划调度
  └── deploy/data/  → MySQL / Redis 数据（项目内目录，.gitignore 已排除）

Docker Compose（deploy/middleware/docker-compose.yaml）
  ├── evermodel-mysql  MariaDB 10.8  127.0.0.1:3306
  ├── evermodel-redis  Redis 7       127.0.0.1:6379
  └── evermodel-nginx  nginx         :80
```

## 目录结构

```
deploy/
├── README.md                       本文件
├── install.sh                      ★ 首次一键部署（顶层入口）
├── update.sh                       ★ git pull 后一键更新（顶层入口）
├── status.sh                       ★ 状态总览（顶层入口）
├── run.sh                          兼容旧版的统一入口（薄壳，转发到新脚本）
├── init.sh                         兼容保留（薄壳，转发到 db/init.sh）
│
├── middleware/                     中间件（MariaDB / Redis / nginx）
│   ├── docker-compose.yaml
│   ├── start.sh / stop.sh / status.sh / logs.sh
│   └── nginx/evermodel_ops.conf
│
├── backend/                        后端（1 个代码库 + 5 个进程）
│   ├── install.sh                  首次安装：venv + 依赖 + supervisor + systemd
│   ├── build.sh                    装/更新 Python 依赖
│   ├── start.sh / stop.sh / restart.sh / status.sh / logs.sh
│   ├── update.sh                   更新流程：build + 数据库对齐 + 重启
│   └── supervisor/                 5 个进程的 supervisor 配置
│       ├── supervisord.conf
│       ├── evermodel_ops.conf      5 个 [program:*] 定义（含 __APP_DIR__ 占位符）
│       ├── evermodel_ops.service   systemd 单元
│       ├── install.sh              安装到 /etc/evermodel_ops/（被 backend/install.sh 调用）
│       ├── manage.sh               单服务启停底层实现
│       └── start-supervisord.sh    systemd ExecStart 包装
│
├── frontend/                       前端
│   ├── install.sh                  装 Node 依赖（npm ci）
│   ├── build.sh                    构建（npm run build → frontend/build/）
│   ├── start.sh                    启动（确保 nginx 在跑 + reload）
│   ├── stop.sh                     停止（停 nginx 容器）
│   └── update.sh                   更新流程：install + build
│
├── db/                             数据库初始化（幂等）
│   ├── init.sh                     幂等入口：updatedb + 默认设置 + admin
│   ├── init.sql                    建库 / 授权 / 字符集（首次启动 MySQL 容器时执行）
│   └── init.defaults.sql           平台默认设置（INSERT IGNORE / ON DUPLICATE KEY）
│
└── local/                          本地开发用（保留）
```

## 数据库初始化策略（幂等）

所有数据库变更都收敛在 `deploy/db/init.sh` 一个入口，规则：

- **存在就跳过，不存在就创建**
- 每次有数据库更新（新表 / 新字段 / 新初始数据），就**往 `init.sh` 或 `backend/tools/init_instance.py` 里追加一段幂等逻辑**
- 重复执行 `init.sh` 不会破坏现有数据 —— 它依赖 Django migrations 与业务侧的 `get_or_create`

`init.sh` 当前做的事（按顺序，全部幂等）：

1. 调用 `python manage.py updatedb` → 内部就是 `makemigrations + migrate`，Django 自带的 migrations 表会记录已跑过的迁移，**已执行的自动跳过**
2. 补齐缺失的平台默认设置（`deploy/db/init.defaults.sql`，`INSERT IGNORE` / `ON DUPLICATE KEY UPDATE`）
3. 不存在 `admin` 账号时创建超级管理员（已存在则跳过且不改密码）

> **以后的写法**：每次发布新版本需要动数据库时，**不要单独写迁移脚本让运维去找**，
> 直接在 `init.sh`（或它调用的 `tools/init_instance.py`）末尾追加一段幂等逻辑即可。
> 运维拉新代码后只要跑一遍 `./deploy/update.sh` 就会把数据库对齐到最新状态。

---

## 一、服务器依赖

目标：Ubuntu 20.04 / 22.04 / 24.04（x86_64）。

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-dev gcc pkg-config \
  default-libmysqlclient-dev libssl-dev supervisor docker.io \
  sshpass rsync sshfs iputils-ping curl git
sudo systemctl enable --now docker

# 前端构建需要 Node.js（>= 16），未装则：
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 二、获取项目

```bash
cd /opt
git clone <repo-url> evermodel_ops
cd evermodel_ops
```

## 三、首次部署（一键）

```bash
sudo EVERMODEL_MYSQL_PASSWORD=evermodel_ops \
     EVERMODEL_ADMIN_PASSWORD='你的管理员密码' \
     ./deploy/install.sh
```

`install.sh` 会按顺序执行：

1. 启动中间件（MariaDB / Redis / nginx）
2. 安装后端（venv / 依赖 / supervisor + systemd）
3. 初始化数据库（幂等，建表 + 默认设置 + admin）
4. 安装并构建前端

完成后浏览器访问 `http://SERVER/`，用 `admin` + 你设置的密码登录。

## 四、日常更新（git pull 后一键）

```bash
cd /opt/evermodel_ops
./deploy/update.sh
```

`update.sh` 会按顺序执行：

1. `git pull --ff-only`
2. 后端：装依赖 → 数据库对齐（幂等）→ 重启 5 个进程
3. 前端：装依赖（如有变化）→ 构建
4. 打印状态总览

浏览器 **Ctrl+F5** 强刷查看前端最新版本（chunk 文件名带 hash，不会读到旧缓存）。

## 五、状态总览

```bash
./deploy/status.sh
```

输出中间件状态、后端 5 进程状态、端口监听、前端可达性。

## 六、分类操作

### 中间件（MariaDB / Redis / nginx）

```bash
./deploy/middleware/start.sh     # 启动
./deploy/middleware/stop.sh      # 停止（不删数据）
./deploy/middleware/status.sh    # 状态
./deploy/middleware/logs.sh      # 跟踪日志（可跟服务名：mysql / redis / nginx）
```

### 后端（5 个进程）

```bash
./deploy/backend/install.sh              # 首次安装（venv + supervisor + systemd）
./deploy/backend/build.sh                # 装/更新 Python 依赖
./deploy/backend/start.sh                # 启动 5 个进程
./deploy/backend/stop.sh                 # 停止 5 个进程
./deploy/backend/restart.sh              # 重启 5 个进程
./deploy/backend/restart.sh api          # 重启单个进程（api/ws/worker/monitor/scheduler）
./deploy/backend/status.sh               # 状态
./deploy/backend/logs.sh api             # 跟踪 api 日志
./deploy/backend/update.sh               # 更新流程：build + 数据库对齐 + 重启
```

### 前端

```bash
./deploy/frontend/install.sh     # 装 Node 依赖（npm ci）
./deploy/frontend/build.sh       # 构建（npm run build → frontend/build/）
./deploy/frontend/start.sh       # 启动（确保 nginx 在跑 + reload）
./deploy/frontend/stop.sh        # 停止（停 nginx 容器）
./deploy/frontend/update.sh      # 更新流程：install + build
```

### 数据库

```bash
# 幂等：可重复执行
EVERMODEL_MYSQL_PASSWORD=evermodel_ops ./deploy/db/init.sh

# 首次部署时需要 admin 密码：
EVERMODEL_MYSQL_PASSWORD=evermodel_ops \
EVERMODEL_ADMIN_PASSWORD='你的密码' \
  ./deploy/db/init.sh
```

## 七、回滚

```bash
cd /opt/evermodel_ops
git log --oneline -10                            # 找到上一个可用 commit
git reset --hard <commit>
./deploy/update.sh                               # 重新走一遍更新流程
```

> **注意**：如果新版本包含**数据库结构变更**，回滚代码前必须先确认旧代码能否兼容新表结构。
> 不兼容时需要先恢复数据库备份再回滚代码。

## 八、数据库备份 / 改密

```bash
# 备份
docker exec evermodel-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql

# 平台管理员密码
cd backend && . venv/bin/activate
python manage.py user reset -u admin -p '新强密码'

# 数据库密码（改后同步 overrides.py / environment，再重启后端）
docker exec -it evermodel-mysql mysql -uroot -p -e \
  "ALTER USER 'root'@'%' IDENTIFIED BY '新强密码'; FLUSH PRIVILEGES;"
```

> 平台有防爆破：同一账号连续 3 次密码错误会被禁用。启用：`python manage.py user enable -u admin`。

## 九、常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面 502 | gunicorn / daphne 没起 | `./deploy/backend/status.sh`；看 `backend/logs/api.log` |
| 5 个进程全 `FATAL` / `spawn error` | `backend/logs/` 不存在 | `sudo mkdir -p /opt/evermodel_ops/backend/logs && ./deploy/backend/restart.sh` |
| 页面 404 / 空白 | 前端产物没构建 | `./deploy/frontend/build.sh` |
| 接口 400 DisallowedHost | `ALLOWED_HOSTS` 没配 / Host 未透传 | 改 `backend/evermodel_ops/overrides.py`；确认 nginx 有 `proxy_set_header Host $host` |
| 接口 401，但用登录接口探又是 200 | 探了需要鉴权的接口 | `/account/login/` 在免鉴权白名单里，探活用它 |
| pip 装 mysqlclient 报 `mysql.h: No such file` | 缺编译依赖 | 装 `python3-dev gcc pkg-config default-libmysqlclient-dev libssl-dev` |
| 数据库连不上 | 容器没起 / 密码不一致 | `./deploy/middleware/status.sh`；核对 supervisor 环境变量与 `overrides.py` |
| Web 终端连上几秒断开 | redis-py 8 默认 socket 超时 | 配置里的 `REDIS_POOL_KWARGS socket_timeout: None` 不要删（已内置） |
| 批量执行卡 `### Waiting for scheduling ...` | worker 没起 | `./deploy/backend/restart.sh worker`，任务需重新提交 |
| 监控不执行 / 不告警 | monitor / scheduler 没起 | 同上；`redis-cli -n 1 llen evermodel_ops:monitor` 非 0 即征兆 |

## 十、备用：手工初始化

`deploy/db/init.sh` 不可用时，可按序手工执行：

```bash
# 1 建库与账号（compose 已自动建库时跳过）
docker exec -i evermodel-mysql mysql -uroot -pevermodel_ops < deploy/db/init.sql

# 2 建表
cd backend && . venv/bin/activate
python manage.py updatedb

# 3 建管理员
python manage.py user add -u admin -p evermodel_ops -n 管理员 -s

# 4 平台默认设置（settings 表存在后执行）
cd /opt/evermodel_ops
docker exec -i evermodel-mysql mysql -uroot -pevermodel_ops evermodel_ops < deploy/db/init.defaults.sql
```
