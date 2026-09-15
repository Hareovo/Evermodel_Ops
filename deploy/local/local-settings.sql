-- 本地开发环境的默认设置，重置数据库后执行一次即可。
-- 用法：
--   docker exec -i spug-mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD spug < local-settings.sql

-- 关闭「访问IP校验」(verify_ip)
--   本机访问时，请求来源经 Docker Desktop 端口转发后必然是本机回环/内网地址
--   （实测恒为网桥网关 172.20.0.1），而判据是 ipaddress.is_global()——必须公网地址才算
--   「真实 IP」。所以本地环境下该检查永远不可能通过，每次登录都会弹
--   「未能获取到访问者的真实IP」警告。Evermodel Ops 官方对纯内网部署的建议就是关闭该特性。
--   注意：verify_ip 只控制这个弹窗，不参与任何鉴权逻辑。
insert into `settings` (`key`, `value`) values ('verify_ip', 'false')
on duplicate key update `value` = 'false';

-- 「登录IP绑定」(bind_ip) 保持默认开启，它是真正的鉴权开关，不要在这里关闭。
