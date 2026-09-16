-- ============================================================================
-- Evermodel Ops — 数据库初始化（建库 + 账号 + 字符集）
--
-- 执行时机：MySQL / MariaDB 已能连上之后，且**在 `manage.py updatedb` 之前**。
-- 幂等，可重复执行。
--
-- 用法（容器内执行）：
--     docker exec -i spug-mysql mysql -uroot -pevermodel_ops < deploy/db/init.sql
-- 用法（宿主机 mysql 客户端）：
--     mysql -h127.0.0.1 -P3306 -uroot -pevermodel_ops < deploy/db/init.sql
--
-- 本目录只有 SQL、没有脚本：初始化按 README.md 第一节的四步手工执行
-- （① 建库 → ② 建表 → ③ 建管理员 → ④ 写默认设置）。
--
-- ⚠️ 用 `deploy/docker-compose.yaml` 启动 MariaDB 时，镜像的 entrypoint 在**首次初始化
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
--    Compose 首次初始化已按 MYSQL_ROOT_PASSWORD 创建 root@'%'.
--    已有实例请先确认账号，再用管理员连接执行 ALTER USER 设置部署密码。
-- ---------------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'root'@'%';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
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

SELECT '建库完成，接着手工建表：manage.py updatedb（见 deploy/db/README.md）' AS `下一步`;
