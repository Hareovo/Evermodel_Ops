-- ============================================================================
-- Evermodel Ops — 数据库初始化（建库 + 账号 + 字符集）
--
-- 执行时机：MySQL / MariaDB 已能连上之后，且**在 `manage.py updatedb` 之前**。
-- 幂等，可重复执行。
--
-- 用法（容器内执行）：
--     docker exec -i spug-mysql mysql -uroot -pevermodel_ops < db/init.sql
-- 用法（宿主机 mysql 客户端）：
--     mysql -h127.0.0.1 -P3306 -uroot -pevermodel_ops < db/init.sql
--
-- 通常不用手工跑这个文件 —— `db/init.sh` 会把「建库 → 建表 → 建管理员 → 写默认设置」
-- 串起来一次做完，优先用那个。
--
-- ⚠️ 用根目录 `docker-compose.yaml` 启动 MariaDB 时，镜像的 entrypoint 在**首次初始化
--    数据卷**时就会按 MYSQL_DATABASE / MYSQL_ROOT_PASSWORD / MYSQL_ROOT_HOST 自动把库和
--    root@'%' 建好，那种场景下本文件是多余的（重复执行无害）。
--    它主要服务于：已有实例、手工安装、重置数据卷后重建。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 业务库
--    字符集必须是 utf8mb4：平台会存中文主机备注、脚本内容、告警消息
--    （注意 utf8mb4_unicode_ci 而不是 utf8mb4_general_ci，排序更符合中文习惯）
-- ---------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `evermodel_ops`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. 账号：root / evermodel_ops
--
--    为什么需要 root@'%'：
--      后端与数据库往往不在同一个网络命名空间里（后端跑宿主机、库在容器），
--      经 docker 端口映射连进来时来源 IP 是网桥网关（如 172.20.0.1），
--      不匹配 root@'localhost'，会被拒。所以显式放行 root@'%'。
--
--    ⚠️ 「用户名 root + 密码 evermodel_ops」是初始化默认值，**生产环境务必改强密码**，
--       并同步修改 backend/evermodel_ops/overrides.py（或 EVERMODEL_MYSQL_PASSWORD 环境变量）。
-- ---------------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'evermodel_ops';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
-- 账号已存在时，把密码也同步成本脚本约定的值
ALTER USER 'root'@'%' IDENTIFIED BY 'evermodel_ops';
FLUSH PRIVILEGES;

-- 若实例的 root@'localhost' 用的是 unix_socket 插件认证（部分 MariaDB 默认如此），
-- 不要动它，否则本机 socket 登录会失效。需要对齐密码时再手工执行下面这行：
-- ALTER USER 'root'@'localhost' IDENTIFIED BY 'evermodel_ops';

-- ---------------------------------------------------------------------------
-- 3. 自检输出
-- ---------------------------------------------------------------------------
SELECT SCHEMA_NAME               AS `已建库`,
       DEFAULT_CHARACTER_SET_NAME AS `字符集`,
       DEFAULT_COLLATION_NAME     AS `排序规则`
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'evermodel_ops';

SELECT User AS `账号`, Host AS `允许来源`, plugin AS `认证插件`
FROM mysql.user
WHERE User = 'root';

SELECT '建库完成，接着执行 db/init.sh（或手工跑 manage.py updatedb）' AS `下一步`;
