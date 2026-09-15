# 前端构建与打包（frontend/）

React 16 + `react-app-rewired` 3.x（底层 `react-scripts` 3.4.3）+ antd 4 + MobX。

---

## 一、环境要求

| 项目 | 要求 |
|---|---|
| Node.js | **18 / 20 / 22**（推荐 22）。需 >= 17，见下方「为什么必须加 `--openssl-legacy-provider`」 |
| npm | 随 Node 自带即可 |
| 磁盘 | 约 1 GB（`node_modules` 很大） |

> 构建脚本已内置跨平台处理（`scripts/run.js`），**Windows CMD / PowerShell / Git Bash / Linux 均可直接 `npm run build`**，不需要手工写环境变量前缀。

## 二、安装依赖

```bash
cd frontend
npm install          # 首次或依赖有变动时
```

> 使用 `npm ci`（严格按 `package-lock.json` 安装）时不要再改 `package.json` 的 `name` / `version`，
> 否则会报 lockfile 不同步。本项目没有动这两个字段。

## 三、开发调试

```bash
npm start            # http://localhost:3000，热更新
```

接口默认走 `src/setupProxy.js` 里的代理转发到后端（本地开发时后端在 `:8000`）。
若走 Nginx 容器（`docker-compose.yaml` 里的 nginx），则直接访问 <http://127.0.0.1/>。

## 四、构建

```bash
npm run build
```

产物输出到 **`frontend/build/`**，这就是**前端站点根目录**（nginx 的 `root` 指到它）。

| 产物 | 说明 |
|---|---|
| `build/index.html` | 单页应用入口，里面以 `<script>` 引用了带内容哈希的 chunk |
| `build/static/js/main.<hash>.chunk.js` | 主包。**改了代码哈希就会变，必须整体替换，不能只覆盖单个文件** |
| `build/static/js/*.chunk.js` + `*.LICENSE.txt` | 分包与第三方库 |
| `build/static/css/main.<hash>.css` | 样式 |
| `build/resource/` | 静态资源（含换过的 logo） |
| `build/index.html` 引用哪个 chunk，就以它为准 | 更新时务必连 `index.html` 一起替换 |

> `build/` 不入库（见 `frontend/.gitignore` 与仓库根 `.gitignore`）。

## 五、打包发布（dist）

```bash
npm run dist            # 先构建，再打包
npm run dist:only       # 复用已有 build/，只打包（构建很慢时可省一次）
```

产出：

```
frontend/dist/
├── evermodel_ops-frontend-v4.0.1.tar.gz
└── evermodel_ops-frontend-v4.0.1.tar.gz.sha256
```

- **版本号来源**：`VERSION` 环境变量 → 后端 `EVERMODEL_VERSION`（`backend/evermodel_ops/settings.py`）→ `frontend/package.json`。
  默认与后端发布包同版本，两边不会各写一份对不上。需要临时指定：

  ```bash
  VERSION=v4.0.2 npm run dist
  ```

- **归档结构**：`tar -C build .`，即**归档内不带 `build/` 这层前缀**，解压出来 `index.html` 就在根目录，直接对上 nginx 的 `root`。
- **自带校验**：脚本会核对「归档条目数 == 磁盘文件数」，不一致直接中止并报错，防止 tar 静默漏归档把残缺产物带到线上；同时生成 `.sha256`。

## 六、部署

**Nginx 容器方式**（推荐）：把解包结果直接写进宿主机挂载目录。

```bash
# 上传
scp dist/evermodel_ops-frontend-v4.0.1.tar.gz user@server:/tmp/

# 服务器解压到前端站点根目录（覆盖旧产物）
sudo mkdir -p /data/evermodel_ops/frontend/build
sudo tar xzf /tmp/evermodel_ops-frontend-v4.0.1.tar.gz -C /data/evermodel_ops/frontend/build
sudo chown -R www-data:www-data /data/evermodel_ops/frontend/build   # 按实际 nginx 运行用户调整
```

**校验和比对**（可选但推荐）：

```bash
sha256sum -c evermodel_ops-frontend-v4.0.1.tar.gz.sha256
```

更新前端**不需要重启任何后端进程**，浏览器 **Ctrl+F5** 强刷即可（chunk 名带哈希，强刷能立刻拿到新包）。

## 七、常见问题

**① `error:0308010C:digital envelope routines::unsupported`**

Node 17+ 默认禁用了 OpenSSL 3 的 legacy provider，而 webpack 4 用它算 md4 哈希。
`npm run build` 已自动判断 Node 大版本并追加 `--openssl-legacy-provider`，正常不会遇到。
若绕过 npm 直接调 `react-app-rewired`，就得自己加：

```bash
node --openssl-legacy-provider node_modules/react-app-rewired/scripts/build.js
```

**② 构建报 `Unable to generate service worker from template. 'assignWith is not defined'`**

CRA 默认的 Workbox 插件与当前 npm 源里被改坏的 `lodash.template` 冲突。
`config-overrides.js` 里已经写好了 `removeWorkboxServiceWorker()` 把这个插件摘掉 ——
**不要把这个补丁加回来**，加回来构建必失败。

**③ 页面还是旧版本**

- 产物替换后必须整体替换（`index.html` + `static/`），只覆盖部分文件会出现新旧 chunk 混用；
- 浏览器缓存：Ctrl+F5；
- Nginx 缓存：确认 `index.html` 没被设成长期缓存（本项目 nginx 配置为不缓存 html）。

**④ `npm ci` 报 lockfile 不同步**

说明 `package.json` 被改过（`name` / `version` / 依赖增删）。用 `npm install` 让 npm 自己修，
或把改动同步进 `package-lock.json` 后一起提交。

---

## 附：目录约定

```
frontend/
├── BUILD.md              本文件：构建与打包说明
├── package.json          npm 脚本与依赖
├── config-overrides.js   react-app-rewired 的 webpack 定制（含 Workbox 摘除补丁，勿删）
├── scripts/
│   ├── run.js            跨平台构建/开发入口（npm start / build / test 都走它）
│   └── make-dist.js      打发布包
├── public/               静态模板（index.html、favicon、logo、manifest）
├── src/                  源码
├── build/                构建产物 = 站点根（不入库）
└── dist/                 发布包（不入库）
```
