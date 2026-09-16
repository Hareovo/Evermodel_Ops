# 数据库初始化（deploy/db/）

Evermodel Ops 的数据库初始化。**默认库 `evermodel_ops`，账号 `root`，密码 `evermodel_ops`**。

| 文件 | 作用 | 执行时机 |
|---|---|---|
| `init.sql` | 建库 + 建/授权账号 + 字符集 | 实例可连之后、建表之前 |
| `init.defaults.sql` | 平台默认设置（关闭「访问IP校验」弹窗） | **建表之后**（`settings` 表此时才存在） |
| `README.md` | 本文件 | — |

> 本目录**只有 SQL、没有脚本** —— 初始化按下面四步手工执行即可。
> 平台没有独立的 schema 文件：表结构由 Django 迁移生成，`manage.py updatedb` 会先
> `makemigrations` 再 `migrate`。所以「初始化」= 建库 + 建表 + 建管理员 + 写默认设置。

---

## 一、初始化（四步）

下面的命令都在**仓库根目录**执行。

### ① 建库与账号

```bash
# 数据库跑在 compose 容器里（推荐）
docker exec -i evermodel-mysql mysql -uroot -pevermodel_ops < deploy/db/init.sql

# 数据库在别的机器 / 用本机 mysql 客户端
mysql -h127.0.0.1 -P3306 -uroot -pevermodel_ops < deploy/db/init.sql
```

### ② 建表

```bash
cd backend
source venv/bin/activate          # Windows: .\venv\Scripts\activate

EVERMODEL_MYSQL_DB=evermodel_ops \
EVERMODEL_MYSQL_USER=root \
EVERMODEL_MYSQL_PASSWORD=evermodel_ops \
python manage.py updatedb
```

> 库地址/账号/密码也可以写进 `evermodel_ops/overrides.py`，之后就不必每次导环境变量。

### ③ 建管理员

```bash
python manage.py user add -u admin -p evermodel_ops -n 管理员 -s   # -s = 超级管理员
```

若提示「已存在」（账号建过），改用重置密码：

```bash
python manage.py user reset -u admin -p evermodel_ops
```

### ④ 平台默认设置

```bash
docker exec -i evermodel-mysql mysql -uroot -pevermodel_ops evermodel_ops < deploy/db/init.defaults.sql
```

### 之后

```bash
# 起后端 5 个进程：见 deploy/supervisor/README.md
# 部署前端产物： 见 frontend/BUILD.md
```

浏览器打开 `http://<服务器地址>/`，用 `admin / evermodel_ops` 登录，**登录后第一件事是改密码**。

---

## 二、账号与凭据约定

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
# 改数据库密码（同时要改 overrides.py 或环境变量，并重启后端 5 个进程）
docker exec -it evermodel-mysql mysql -uroot -p -e \
  "ALTER USER 'root'@'%' IDENTIFIED BY '新强密码'; FLUSH PRIVILEGES;"

# 改平台管理员密码
cd backend && python manage.py user reset -u admin -p '新强密码'
```

### 权限说明

本平台**已整体删除权限体系**（角色 / 凭据 / 菜单授权相关模块都在二开时移除了），
能登录的账号都是完整管理员。所以这里只需要一个管理账号，不用考虑角色分配。

### 关于登录失败

平台有防爆破：**同一账号连续 3 次密码错误会把该账号 `is_active` 置为 False（禁用）**。
被禁用后即使密码正确也登不进，用命令启用：

```bash
cd backend && python manage.py user enable -u admin
```

> 做「登录失败」这类测试时，请用**不存在的用户名**，别拿真账号去撞。

---

## 三、为什么要放行 `root@'%'`

后端和数据库常常不在同一个网络命名空间里（后端在宿主机、库在容器）。
此时经 Docker 端口映射连进来的来源 IP 是**网桥网关**（如 `172.20.0.1`），
不匹配 `root@'localhost'`，会被拒绝。

所以 `init.sql` 显式创建并授权 `root@'%'`；用 `deploy/docker-compose.yaml` 启动时，
`MYSQL_ROOT_HOST: '%'` 也会让镜像的 entrypoint 做同样的事。

---

## 四、重置数据库（⚠️ 会清空全部数据）

```bash
# ① 备份（先做这个！）
docker exec evermodel-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evermodel_ops' \
  > evermodel_ops-$(date +%F).sql

# ② 重建：删数据卷后重新拉起容器（数据卷名带 compose 项目前缀）
cd deploy && docker compose down -v        # -v 会删除 mysql_data / redis_data
docker compose up -d

# ③ 重新初始化：回到本文件第一节的四步
```

> ⚠️ 改容器环境变量（`MYSQL_ROOT_PASSWORD` 等）对**已存在的数据卷无效** ——
> 镜像的 entrypoint 只在首次初始化数据卷时读这些变量。要换账号密码，
> 要么按上面重置数据卷，要么手工执行 `ALTER USER` / `init.sql`。

---

## 五、故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| `Access denied for user 'root'@'172.x.x.x'` | 没有 `root@'%'` | 执行 `deploy/db/init.sql`（或给容器加 `MYSQL_ROOT_HOST: '%'` 后重建卷） |
| `Unknown database 'evermodel_ops'` | 库没建 | 执行 `deploy/db/init.sql`；容器方式确认 compose 里 `MYSQL_DATABASE` 是 `evermodel_ops` |
| `updatedb` 报连接被拒 | `overrides.py` 里的地址/密码与实例不一致 | 核对 `backend/evermodel_ops/overrides.py`，或用 `EVERMODEL_MYSQL_*` 环境变量覆盖 |
| 中文变问号 / 排序不对 | 库或表的字符集不是 utf8mb4 | `ALTER DATABASE evermodel_ops CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`，表由 `updatedb` 重建 |
| `manage.py user add` 说「已存在」 | 账号已建过 | 用 `user reset -u admin -p <密码>` 改密码 |
| 登录弹「未能获取到访问者的真实IP」 | `verify_ip` 还是 true | 执行 `deploy/db/init.defaults.sql`，或在「系统设置」里关掉 |
| 登录说账号被禁用 | 连续 3 次失败触发防爆破 | `python manage.py user enable -u admin` |
