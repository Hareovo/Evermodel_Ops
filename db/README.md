# 数据库初始化（db/）

Evermodel Ops 的数据库初始化。**默认库 `evermodel_ops`，账号 `root`，密码 `evermodel_ops`**。

| 文件 | 作用 | 执行时机 |
|---|---|---|
| `init.sh` | 一键编排（下面四个步骤串起来） | /**推荐入口** |
| `init.sql` | 建库 + 建/授权账号 + 字符集 | 实例可连之后、建表之前 |
| `init.defaults.sql` | 平台默认设置（关闭「访问IP校验」弹窗） | **建表之后**（`settings` 表此时才存在） |
| `README.md` | 本文件 | — |

> 平台没有独立的 schema 文件 —— 表结构由 Django 迁移生成，`manage.py updatedb`
> 会先 `makemigrations` 再 `migrate`。所以「初始化」= 建库 + 建表 + 建管理员 + 写默认设置。

---

## 一、一键初始化（推荐）

```bash
bash db/init.sh
```

脚本会依次完成：

1. **建库与账号** —— 执行 `init.sql`
2. **建表** —— `python manage.py updatedb`
3. **建管理员** —— `user add -u admin -p evermodel_ops -n 管理员 -s`（已存在则改为重置密码）
4. **写默认设置** —— 执行 `init.defaults.sql`

它自己能探测环境：容器 `spug-mysql` 在跑就经容器里的 `mysql` 客户端执行 SQL，
否则回退到本机 `mysql` 命令；Python 优先用 `backend/venv`。

### 常用参数

```bash
bash db/init.sh --container spug-mysql        # 指定容器名
bash db/init.sh --no-container                # 强制用本机 mysql 客户端
bash db/init.sh --host 10.0.0.5 --port 3306   # 数据库在别的机器
bash db/init.sh --db-pass '强密码' --admin-pass '强密码'
bash db/init.sh --admin-user ops --admin-nick 运维管理员
bash db/init.sh --no-defaults                 # 不写平台默认设置
bash db/init.sh --help                        # 全部参数
```

> `--host` / `--port` 是**后端所在机器看到的地址**（Django 用它连库）；
> 执行 SQL 走 `--container` 时是在容器内用 socket 连，不受这两个参数影响。

### 之后

```bash
sudo bash deploy/supervisor/install.sh        # 起后端 5 个进程
```

然后按 `frontend/BUILD.md` 部署前端产物，浏览器打开 `http://<服务器地址>/`，
用 `admin / evermodel_ops` 登录，**登录后第一件事是改密码**。

---

## 二、分步执行（排查或定制时用）

```bash
# ① 建库与账号
docker exec -i spug-mysql mysql -uroot -pevermodel_ops < db/init.sql
#   或本机客户端：
mysql -h127.0.0.1 -P3306 -uroot -pevermodel_ops < db/init.sql

# ② 建表
cd backend && source venv/bin/activate
EVERMODEL_MYSQL_DB=evermodel_ops EVERMODEL_MYSQL_USER=root \
EVERMODEL_MYSQL_PASSWORD=evermodel_ops python manage.py updatedb

# ③ 建管理员（-s = 超级管理员）
python manage.py user add -u admin -p evermodel_ops -n 管理员 -s

# ④ 平台默认设置
docker exec -i spug-mysql mysql -uroot -pevermodel_ops evermodel_ops < db/init.defaults.sql
```

---

## 三、账号与凭据约定

| 项目 | 默认值 | 备注 |
|---|---|---|
| 库名 | `evermodel_ops` | 由 `EVERMODEL_MYSQL_DB` 覆盖 |
| 数据库账号 | `root` | 由 `EVERMODEL_MYSQL_USER` 覆盖 |
| 数据库密码 | `evermodel_ops` | 由 `EVERMODEL_MYSQL_PASSWORD` 覆盖，**生产必须改** |
| 数据量字符集 | `utf8mb4` / `utf8mb4_unicode_ci` | 会存中文备注与脚本内容 |
| 平台管理员 | `admin` | `manage.py user add` 创建，`-s` 为超级管理员 |
| 平台管理员密码 | `evermodel_ops` | **登录后立刻改** |

⚠️ **默认凭据只是初始值，不是安全值。** 数据库与平台两处密码相互独立：

```bash
# 改数据库密码（同时改 overrides.py 或环境变量）
bash db/init.sh --db-pass '新强密码'

# 改平台管理员密码
cd backend && ./venv/Scripts/python.exe manage.py user reset -u admin -p '新强密码'
```

### 权限说明

本平台**已整体删除权限体系**（角色 / 凭据 / 菜单授权相关模块都在二开时移除了），
能登录的账号都是完整管理员。所以这里只需要一个管理账号，不用考虑角色分配。

### 关于登录失败

平台有防爆破：**同一账号连续 3 次密码错误会把该账号 `is_active` 置为 False（禁用）**。
被禁用后即使密码正确也登不进，用命令启用：

```bash
cd backend && ./venv/Scripts/python.exe manage.py user enable -u admin
```

> 做「登录失败」这类测试时，请用**不存在的用户名**，别拿真账号去撞。

---

## 四、为什么要放行 `root@'%'`

后端和数据库常常不在同一个网络命名空间里（后端在宿主机、库在容器）。
此时经 Docker 端口映射连进来的来源 IP 是**网桥网关**（如 `172.20.0.1`），
不匹配 `root@'localhost'`，会被拒绝。

所以 `init.sql` 显式创建并授权 `root@'%'`；用根目录 `docker-compose.yaml` 启动时，
`MYSQL_ROOT_HOST: '%'` 也会让镜像的 entrypoint 做同样的事。

---

## 五、重置数据库（⚠️ 会清空全部数据）

```bash
# ① 备份（先做这个！）
docker exec spug-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql

# ② 重建：删数据卷后重新拉起容器（数据卷名带 compose 项目前缀）
cd .. && docker compose down -v        # -v 会删除 mysql_data / redis_data
docker compose up -d

# ③ 重新初始化
bash db/init.sh
```

> ⚠️ 改容器环境变量（`MYSQL_ROOT_PASSWORD` 等）对**已存在的数据卷无效** ——
> 镜像的 entrypoint 只在首次初始化数据卷时读这些变量。要换账号密码，
> 要么按上面重置数据卷，要么手工执行 `ALTER USER` / `db/init.sql`。

---

## 六、故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| `Access denied for user 'root'@'172.x.x.x'` | 没有 `root@'%'` | 执行 `db/init.sql`（或给容器加 `MYSQL_ROOT_HOST: '%'` 后重建卷） |
| `Unknown database 'evermodel_ops'` | 库没建 | 执行 `db/init.sql`；容器方式确认 `.env` 里 `MYSQL_DATABASE` 是 `evermodel_ops` |
| `updatedb` 报连接被拒 | `overrides.py` 里的地址/密码与实例不一致 | 核对 `backend/evermodel_ops/overrides.py`；或按 `db/init.sh` 用环境变量覆盖 |
| 中文变问号 / 排序不对 | 库或表的字符集不是 utf8mb4 | `ALTER DATABASE evermodel_ops CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`，表由 `updatedb` 重建 |
| `manage.py user add` 说「已存在」 | 账号已建过 | 用 `user reset -u admin -p <密码>` 改密码，或 `init.sh` 会自动处理 |
| 登录弹「未能获取到访问者的真实IP」 | `verify_ip` 还是 true | 执行 `db/init.defaults.sql`，或在「系统设置」里关掉 |
| 登录说账号被禁用 | 连续 3 次失败触发防爆破 | `manage.py user enable -u admin` |
