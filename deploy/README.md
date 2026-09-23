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

## 脚本一览（9 个，按资源分类）

```
deploy/
├── install.sh          ★ 首次一键部署
├── update.sh           ★ git pull 后一键更新
├── status.sh           ★ 状态总览
│
├── middleware.sh       中间件管理: {start|stop|status|logs} [mysql|redis|nginx]
├── backend.sh          后端管理:   {install|build|start|stop|restart|status|logs|update} [api|ws|worker|monitor|scheduler|all]
├── frontend.sh         前端管理:   {install|build|start|stop|update|status}
│
├── middleware/         中间件资产
│   ├── docker-compose.yaml
│   └── nginx/evermodel_ops.conf
│
├── backend/supervisor/ 5 进程 supervisor/systemd 配置（被 backend.sh install 安装）
│   ├── supervisord.conf
│   ├── evermodel_ops.conf        5 个 [program:*]（含 __APP_DIR__ 占位符）
│   ├── evermodel_ops.service     systemd 单元
│   ├── install.sh                安装到 /etc/evermodel_ops/（由 backend.sh install 调用）
│   ├── manage.sh                 （保留）单服务底层实现
│   └── start-supervisord.sh      systemd ExecStart 包装
│
├── db/
│   ├── init.sh                   数据库幂等初始化入口
│   ├── init.sql                  建库/授权/字符集
│   └── init.defaults.sql         平台默认设置
│
└── local/                        本地开发用
```

## 数据库初始化策略（幂等）

所有数据库变更收敛在 `deploy/db/init.sh` 一个入口，规则：

- **存在就跳过，不存在就创建**
- 每次有数据库更新（新表 / 新字段 / 新初始数据），往 `init.sh` 或 `backend/tools/init_instance.py` 追加一段幂等逻辑
- 重复执行不破坏现有数据（依赖 Django migrations 与 `get_or_create`）

`init.sh` 当前做的事（按顺序，全部幂等）：

1. `python manage.py updatedb` → `makemigrations + migrate`，已执行的迁移自动跳过
2. 补齐缺失的平台默认设置（`INSERT IGNORE` / `ON DUPLICATE KEY`）
3. 不存在 `admin` 时创建超级管理员（已存在则跳过且不改密码）

> **以后的写法**：发布新版本需要动数据库时，直接往 `init.sh` 末尾追加幂等逻辑，
> 运维跑一遍 `./deploy/update.sh` 即对齐到最新状态。

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
sudo EVERMODEL_ADMIN_PASSWORD='你的管理员密码' ./deploy/install.sh
```

流程：启动中间件 → 安装后端（venv/依赖/supervisor+systemd）→ 数据库幂等初始化 → 前端 install+build → 状态确认。

完成后浏览器访问 `http://SERVER/`，用 `admin` + 你设置的密码登录。

## 四、日常更新（git pull 后一键）

```bash
cd /opt/evermodel_ops
./deploy/update.sh
```

流程：`git pull --ff-only` → 后端（依赖 → 数据库 → 重启 5 进程）→ 前端（依赖 → 构建）→ 状态确认。

浏览器 **Ctrl+F5** 强刷查看前端最新版本（chunk 文件名带 hash，不会读到旧缓存）。

## 五、分类操作

```bash
# ---- 中间件 ----
./deploy/middleware.sh start                    # 启动
./deploy/middleware.sh stop                     # 停止（不删数据）
./deploy/middleware.sh status                   # 状态
./deploy/middleware.sh logs mysql               # 跟踪日志

# ---- 后端 ----
sudo ./deploy/backend.sh install                # 首次安装（venv + supervisor + systemd）
./deploy/backend.sh build                       # 装/更新 Python 依赖
./deploy/backend.sh start                       # 启动 5 个进程
./deploy/backend.sh stop                        # 停止
./deploy/backend.sh restart                     # 重启全部
./deploy/backend.sh restart api                 # 重启单个（api/ws/worker/monitor/scheduler）
./deploy/backend.sh status                      # 状态
./deploy/backend.sh logs api                    # 跟踪 api 日志
./deploy/backend.sh update                      # 更新: build + 数据库 + 重启

# ---- 前端 ----
./deploy/frontend.sh install                    # 装/同步 Node 依赖
./deploy/frontend.sh build                      # 构建 → frontend/build/
./deploy/frontend.sh start                      # 确保中间件在跑 + reload nginx
./deploy/frontend.sh stop                       # 停 nginx（API 反代一并断）
./deploy/frontend.sh update                     # install + build

# ---- 数据库 ----
EVERMODEL_MYSQL_PASSWORD=evermodel_ops ./deploy/db/init.sh     # 幂等，可重复执行
```

## 六、回滚

```bash
cd /opt/evermodel_ops
git log --oneline -10                # 找到上一个可用 commit
git reset --hard <commit>
./deploy/update.sh
```

> 若新版本包含**数据库结构变更**，回滚前先确认旧代码兼容新表结构；
> 不兼容时先恢复数据库备份再回滚代码。

## 七、数据库备份 / 改密

```bash
# 备份
docker exec evermodel-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql

# 平台管理员密码
cd backend && . venv/bin/activate
python manage.py user reset -u admin -p '新强密码'

# 数据库密码（改后同步 overrides.py 与 /etc/evermodel_ops/environment，再重启后端）
docker exec -it evermodel-mysql mysql -uroot -p -e \
  "ALTER USER 'root'@'%' IDENTIFIED BY '新强密码'; FLUSH PRIVILEGES;"
```

> 平台有防爆破：同一账号连续 3 次密码错误会被禁用。启用：`python manage.py user enable -u admin`。

## 八、常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面 502 | gunicorn / daphne 没起 | `./deploy/backend.sh status`；看 `backend/logs/api.log` |
| 5 个进程全 `FATAL` / `spawn error` | `backend/logs/` 不存在 | `sudo mkdir -p backend/logs && ./deploy/backend.sh restart` |
| 页面 404 / 空白 | 前端产物没构建 | `./deploy/frontend.sh build` |
| 接口 400 DisallowedHost | `ALLOWED_HOSTS` 没配 | 改 `backend/evermodel_ops/overrides.py` 后 `./deploy/backend.sh restart` |
| pip 装 mysqlclient 报 `mysql.h: No such file` | 缺编译依赖 | 装 `python3-dev gcc pkg-config default-libmysqlclient-dev libssl-dev` |
| 数据库连不上 | 容器没起 / 密码不一致 | `./deploy/middleware.sh status`；核对 `/etc/evermodel_ops/environment` |
| Web 终端连上几秒断开 | redis-py 8 默认 socket 超时 | 配置里的 `REDIS_POOL_KWARGS socket_timeout: None` 不要删（已内置） |
| 批量执行卡 `### Waiting for scheduling ...` | worker 没起 | `./deploy/backend.sh restart worker`，任务需重新提交 |
| 监控不执行 / 不告警 | monitor / scheduler 没起 | 同上；`redis-cli -n 1 llen evermodel_ops:monitor` 非 0 即征兆 |

## 九、备用：手工初始化

`deploy/db/init.sh` 不可用时，按序手工执行：

```bash
# 1 建库与账号（compose 已自动建库时跳过）
docker exec -i evermodel-mysql mysql -uroot -pevermodel_ops < deploy/db/init.sql

# 2 建表
cd backend && . venv/bin/activate
python manage.py updatedb

# 3 建管理员
python manage.py user add -u admin -p evermodel_ops -n 管理员 -s

# 4 平台默认设置（settings 表存在后执行）
docker exec -i evermodel-mysql mysql -uroot -pevermodel_ops evermodel_ops \
  < deploy/db/init.defaults.sql
```
