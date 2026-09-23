# Evermodel Ops

轻量级、无 Agent 的自动化运维平台。

主机纳管、批量执行、任务计划、监控告警、文件分发、Web 终端 —— 一套 Web 界面即可完成，
**不需要在被管机器上安装任何 Agent**，只要 SSH 可达。

---

## 功能特性

| 模块 | 说明 |
|---|---|
| **主机管理** | SSH 密钥 / 密码认证、主机分组、批量导入导出、从云厂商同步主机 |
| **批量执行** | 多台主机并行执行命令或脚本，支持模板与参数化、实时输出与历史记录 |
| **任务计划** | 类 cron 调度，支持间隔 / 定时 / 周期任务，执行记录可追溯 |
| **监控中心** | 站点、端口、进程、自定义脚本四类检测，支持告警抑制与恢复通知 |
| **告警中心** | 钉钉 / 飞书 / 企业微信 / 邮件多通道推送，支持告警分组与联系人 |
| **文件分发** | 批量上传文件到多台主机，支持覆盖策略与传输记录 |
| **Web 终端** | 浏览器内 SSH 终端（xterm.js），支持在线文件管理 |
| **接口文档** | `/apidocs` 自动生成全量 API 文档，可直接在线调试 |
| **监控大屏** | `/grafana` 内嵌 Grafana 看板，无需跳转 |

## 技术栈

| 层次 | 选型 |
|---|---|
| 后端 | Python 3.12/3.13 · Django 4.2 · Django Channels 4 |
| 任务队列 | Redis · 自研轻量队列（不依赖 Celery） |
| 前端 | React 16 · Ant Design 4 |
| 数据库 | MariaDB 10.8（兼容 MySQL）· utf8mb4 |
| 进程与网关 | supervisor + systemd + nginx |

## 快速开始

完整部署指南见 [`deploy/README.md`](deploy/README.md)。

**首次部署**（一条命令）：

```bash
sudo EVERMODEL_ADMIN_PASSWORD='你的管理员密码' ./deploy/install.sh
```

**日常更新**（git pull 后一条命令）：

```bash
./deploy/update.sh    # 后端: 依赖+数据库+重启 / 前端: 依赖+构建 / 状态确认
```

浏览器访问 `http://SERVER/`，用 `admin` + 部署时设置的密码登录。

## 目录结构

```
evermodel_ops/
├── backend/     Django 后端（5 个进程：api / ws / worker / monitor / scheduler）
├── frontend/    React 前端（Ant Design 4）
├── deploy/      部署脚本（install/update/status + middleware/backend/frontend.sh）与资产
└── docs/        本地文档（不入库）
```

## 文档索引

| 我想… | 看这里 |
|---|---|
| 从零部署到能登录 | `./deploy/install.sh`（详见 [`deploy/README.md`](deploy/README.md)） |
| 拉新代码后的更新启停 | `./deploy/update.sh` |
| 状态总览 / 单资源操作 | `./deploy/status.sh` · `middleware.sh` · `backend.sh` · `frontend.sh` |
| 改 nginx 反代规则 | [`deploy/middleware/nginx/evermodel_ops.conf`](deploy/middleware/nginx/evermodel_ops.conf) |
| 改后端运行参数（数据库、Grafana 等） | `backend/evermodel_ops/overrides.py` |
| 改进程托管配置 | `deploy/backend/supervisor/` |
| 改中间件配置 | `deploy/middleware/docker-compose.yaml` |

## 许可

[AGPL-3.0](LICENSE)
