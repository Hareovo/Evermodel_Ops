# 后端构建与打包（backend/）

Python 3 + Django 4.2 + Django Channels（WebSocket）+ MySQL + Redis。

---

## 〇、先说清楚：为什么后端没有 `jar`

`.jar` 是 JVM 的产物，本项目是 **Python / Django** 工程，语言运行时不同，产不出也不该产出 jar。
与 `jar` 对等的东西在本项目是 **发布包 `tar.gz`**：

| Java 生态 | 本项目对应物 |
|---|---|
| `mvn package` → `target/app.jar` | `python tools/build_release.py` → `dist/evermodel_ops-v4.0.1.tar.gz` |
| `java -jar app.jar` | supervisor 起 5 个进程（`deploy/supervisor/`） |
| `application.yml` / 环境变量 | `evermodel_ops/overrides.py` + `EVERMODEL_*` 环境变量 |
| Flyway / Liquibase 迁移 | `python manage.py updatedb`（Django migrate） |

所以本文件讲的是**发布包 tar.gz 的构建与部署**。前端对应物见 `frontend/BUILD.md`（产出 `dist/*.tar.gz`），
两边版本号同一个来源（`EVERMODEL_VERSION`），产物命名对称。

## 一、环境要求

| 项目 | 要求 |
|---|---|
| Python | **3.8 及以上**（推荐 3.13，本机开发用 3.13.12） |
| MySQL | 5.7 / 8.0 或 MariaDB 10.4+ |
| Redis | 5.0+ |
| 编译工具 | `gcc` `pkg-config` `default-libmysqlclient-dev` `libssl-dev`（`mysqlclient` 需要编译） |

Ubuntu / Debian：

```bash
sudo apt install -y python3 python3-venv python3-dev gcc pkg-config \
    default-libmysqlclient-dev libssl-dev
```

## 二、安装依赖

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 三、配置

后端**没有硬编码数据库地址**，运行期配置来自 `evermodel_ops/overrides.py`
（由 `settings.py` 末尾 `from evermodel_ops.overrides import *` 加载，优先级最高）。

该文件不入库（含各环境明文密码），首次部署从示例复制：

```bash
cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py
```

默认值（可在 `overrides.py` 里改，或用同名环境变量覆盖）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `EVERMODEL_MYSQL_HOST` | `127.0.0.1` | |
| `EVERMODEL_MYSQL_PORT` | `3306` | 本地 Docker 映射常为 `13306` |
| `EVERMODEL_MYSQL_DB` | `evermodel_ops` | 库名 |
| `EVERMODEL_MYSQL_USER` | `root` | |
| `EVERMODEL_MYSQL_PASSWORD` | `evermodel_ops` | **生产必须改** |
| `EVERMODEL_REDIS_HOST` / `PORT` | `127.0.0.1` / `6379` | |
| `EVERMODEL_SECRET_KEY` | 无（落到代码里的开发用默认值） | **生产必须注入** |
| `EVERMODEL_GRAFANA_URL` | 空 | 也可在「系统设置 / 监控大屏」界面里配 |

## 四、初始化数据库

见 [`deploy/db/README.md`](../deploy/db/README.md)（含「建库」那一步，这里只列后两步）。一句话版：

```bash
cd backend && source venv/bin/activate
python manage.py updatedb                              # 建表（等价 migrate）
python manage.py user add -u admin -p evermodel_ops -n 管理员 -s   # 建管理员
```

## 五、开发运行

```bash
cd backend
./venv/Scripts/python.exe manage.py runserver 0.0.0.0:8000     # Windows
# 或（Linux / macOS）
python manage.py runserver 0.0.0.0:8000
```

> ⚠️ `runserver` **只提供 API 与 WebSocket**。批量执行 / 任务计划 / 监控检测
> 分别由 `runworker` / `runscheduler` / `runmonitor` 三个独立进程执行，
> 光跑 `runserver` 会「能建任务但不执行」，详见 `deploy/supervisor/README.md`。

## 六、打包发布（dist）

```bash
cd backend
python tools/build_release.py
```

产出：

```
backend/dist/
├── evermodel_ops-v4.0.1.tar.gz
└── evermodel_ops-v4.0.1.tar.gz.sha256
```

常用参数：

```bash
python tools/build_release.py --list               # 只列出会被打进包的文件
VERSION=v4.0.2 python tools/build_release.py       # 指定版本号
python tools/build_release.py --include-overrides  # 连带本地 overrides.py 一起打（含明文密码，慎用）
```

- **版本号来源**：`VERSION` 环境变量 → `evermodel_ops/settings.py` 的 `EVERMODEL_VERSION`。
- **归档结构**：**不带 `backend/` 前缀**，解压出来 `manage.py` 就在根目录。
- **默认排除**：`venv/`（跨平台不可复用）、`__pycache__/`、`*.pyc`、`logs/*`（只留 `.gitkeep`）、
  `repos/*`、`storage/transfer/*`、`dist/`、`db.sqlite3`、`*.log`、以及 **`evermodel_ops/overrides.py`**。
- **自带校验**：脚本用标准库 `tarfile` 打包（不依赖外部 `tar`，规避 Git Bash tar 的漏归档问题），
  并核对「归档条目数 == 磁盘文件数」，不一致直接中止。

## 七、部署

```bash
# 上传
scp dist/evermodel_ops-v4.0.1.tar.gz user@server:/tmp/

# 服务器：解压到后端根目录（覆盖旧代码）
sudo mkdir -p /data/evermodel_ops/backend
sudo tar xzf /tmp/evermodel_ops-v4.0.1.tar.gz -C /data/evermodel_ops/backend

# 首次：装依赖 + 补配置 + 建日志目录
cd /data/evermodel_ops/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp evermodel_ops/overrides.py.example evermodel_ops/overrides.py && vim evermodel_ops/overrides.py
mkdir -p logs

# 建表 + 管理员
python manage.py updatedb
python manage.py user add -u admin -p evermodel_ops -n 管理员 -s

# 托管（5 个进程 + systemd 守护）—— 完整 5 步见 deploy/supervisor/README.md 第二节
APP_DIR=/data/evermodel_ops
sudo apt install -y supervisor
sudo mkdir -p "$APP_DIR/backend/logs" /etc/evermodel_ops/conf.d /var/log/evermodel_ops
sudo install -m 0644 "$APP_DIR/deploy/supervisor/supervisord.conf" /etc/evermodel_ops/supervisord.conf
sed "s|__APP_DIR__|$APP_DIR|g" "$APP_DIR/deploy/supervisor/evermodel_ops.conf" \
  | sudo tee /etc/evermodel_ops/conf.d/evermodel_ops.conf > /dev/null
sudo install -m 0644 "$APP_DIR/deploy/supervisor/evermodel_ops.service" \
  /etc/systemd/system/evermodel_ops.service
sudo systemctl daemon-reload && sudo systemctl enable --now evermodel_ops
```

**更新代码**：重新打包 → 解压覆盖 → `sudo supervisorctl restart all`。
（⚠️ `worker` / `scheduler` 启动时会清空对应 Redis 队列，重启后堆积的任务要**重新提交一次**。）

> ⚠️ **发布包只含 `backend/`**。`deploy/`（compose、db 初始化 SQL、nginx 配置、supervisor 配置）
> 是**仓库级**部署资产，不在这两个编译产物里 ——
> 服务器上要么 `git clone` 拿全，要么把 `deploy/` 一并上传到 `/data/evermodel_ops/`。

## 八、常见问题

**① `mysql.h: No such file or directory` / `mysqlclient` 装不上**

缺编译依赖，装 `default-libmysqlclient-dev` 与 `pkg-config`；Debian 系还要 `gcc`。

**② `django.db.utils.OperationalError: (2002/1045)`**

连不上库或密码错。检查 `overrides.py` 里的 `HOST/PORT/USER/PASSWORD`，
以及 `EVERMODEL_MYSQL_*` 环境变量是否把它覆盖了（环境变量优先级更高）。

**③ 改了多文件后 `runserver` 热重载不恢复**

Django 的自动重载在连续多次改写文件时会自己死掉且不重启。确认端口没监听就手动重启进程。

**④ `KeyError` when `AppSetting.set()`**

运行期可写的配置项必须在 `apps/setting/models.py` 的 `KEYS_DEFAULT` 里登记过，
不在清单里的键 `set()` 会直接抛 `KeyError`。新增配置项记得同步进 `KEYS_DEFAULT`。

**⑤ WebSocket / Web 终端连上几秒就断**

`settings.py` 与 `overrides.py` **两处**的 Redis 客户端配置都必须保留
`socket_timeout: None`（redis-py 8 默认 5s 会打断所有阻塞读）。改 Redis 配置时两处别漏。

---

## 附：目录约定

```
backend/
├── BUILD.md              本文件：构建与打包说明
├── manage.py             Django 入口
├── requirements.txt      依赖
├── apps/                 业务模块（account / host / exec / schedule / monitor / alarm / setting）
├── consumer/             WebSocket 消费者
├── libs/                 公共库（SSH、通知、中间件）
├── tools/                运维脚本
│   ├── start-*.sh        5 个服务的启动命令（由 supervisor 调用）
│   ├── build_release.py  打发布包
│   └── migrate.py        版本升级时的数据迁移
├── evermodel_ops/        Django 工程配置
│   ├── settings.py       基础配置
│   ├── overrides.py      运行期覆盖（不入库，含密码）
│   └── overrides.py.example
├── logs/                 运行日志（supervisor 写入，不入库）
├── repos/                运行期仓库缓存（不入库）
├── storage/transfer/     运行期分发临时文件（不入库）
└── dist/                 发布包（不入库）
```
