#!/usr/bin/env node
/**
 * Evermodel Ops — 前端发布包打包脚本
 *
 * 职责：把 CRA 的构建产物（frontend/build/）打成可直接上传服务器的发布包
 *       frontend/dist/evermodel_ops-frontend-v<版本>.tar.gz
 *
 * 用法（在 frontend/ 下）：
 *   node scripts/make-dist.js            # 先构建再打包
 *   node scripts/make-dist.js --no-build # 复用已有 build/，只打包
 *   VERSION=v9.9.9 node scripts/make-dist.js   # 指定版本号
 *
 * 为什么不用 react-scripts 的 BUILD_PATH：
 *   本项目锁的是 react-scripts 3.4.3（CRA 3），BUILD_PATH 是 CRA 4 才支持的环境变量，
 *   在 CRA 3 上会被静默忽略。所以这里保持 CRA 原生输出目录 build/ 不变
 *   （nginx 挂载的就是它，改目录名会连带改一堆部署配置），
 *   另用本脚本产出 dist/ 发布包，不碰站点根。
 */
'use strict';

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(FRONTEND_DIR, 'build');
const DIST_DIR = path.join(FRONTEND_DIR, 'dist');

const argv = process.argv.slice(2);
const skipBuild = argv.includes('--no-build');

const pkg = JSON.parse(fs.readFileSync(path.join(FRONTEND_DIR, 'package.json'), 'utf8'));

/**
 * 调用外部 tar 的统一封装。
 *
 * ⚠️ 一律用「相对 FRONTEND_DIR 的路径 + cwd」，不要传 `D:\Code\...` 这种绝对路径：
 *    Git Bash(MSYS) 会把参数里的盘符冒号当成远程主机（报 `Cannot connect to D: resolve failed`）。
 *    同时用 MSYS2_ARG_CONV_EXCL='*' 关掉 MSYS 的参数路径转换，双保险。
 */
function runTar(args) {
  return execFileSync('tar', args, {
    cwd: FRONTEND_DIR,
    encoding: 'utf8',
    env: { ...process.env, MSYS2_ARG_CONV_EXCL: '*', MSYS_NO_PATHCONV: '1' },
  });
}

/**
 * 发布包版本号 —— 与后端发布包保持同一个来源，避免两边各写一份对不上。
 * 优先级：VERSION 环境变量 > 后端 EVERMODEL_VERSION > frontend/package.json 的 version。
 */
function resolveVersion() {
  if (process.env.VERSION) return process.env.VERSION;
  const settings = path.resolve(FRONTEND_DIR, '..', 'backend', 'evermodel_ops', 'settings.py');
  try {
    const hit = fs
      .readFileSync(settings, 'utf8')
      .match(/EVERMODEL_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (hit) return hit[1];
  } catch (err) {
    /* 后端目录不存在（例如只单独拉取前端）时退回 package.json */
  }
  return pkg.version || '0.0.0';
}

const version = resolveVersion().replace(/^v/, '');
const artifact = `evermodel_ops-frontend-v${version}.tar.gz`;
const artifactPath = path.join(DIST_DIR, artifact);

function log(msg) {
  process.stdout.write(`[make-dist] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[make-dist] 错误：${msg}\n`);
  process.exit(1);
}

/** 递归收集文件相对路径（不依赖 Node 版本，自己走目录） */
function walk(dir, prefix) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walk(path.join(dir, entry.name), rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// ---------------------------------------------------------------------------
// 1. 构建
// ---------------------------------------------------------------------------
if (skipBuild) {
  log('跳过构建（--no-build），复用已有 build/');
} else {
  log('开始构建（npm run build）…');
  // shell: true —— npm 在 Windows 上是 npm.cmd，execFileSync 直调会 ENOENT
  execFileSync('npm', ['run', 'build'], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
    shell: true,
  });
}

if (!fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
  fail(`构建产物不完整：找不到 ${path.join(BUILD_DIR, 'index.html')}`);
}

// ---------------------------------------------------------------------------
// 2. 打包
// ---------------------------------------------------------------------------
const files = walk(BUILD_DIR, '');
if (files.length === 0) {
  fail(`${BUILD_DIR} 是空目录`);
}

fs.mkdirSync(DIST_DIR, { recursive: true });
if (fs.existsSync(artifactPath)) {
  fs.unlinkSync(artifactPath);
}

log(`打包 ${files.length} 个文件 -> dist/${artifact}`);
const relArtifact = `dist/${artifact}`;
const relBuild = 'build';
try {
  // -C build . —— 归档内不带 build/ 这层前缀，解压出来 index.html 就在根，
  // nginx 的 root 指过去即可用（与部署文档里的 tar xzf ... -C <站点根> 对应）。
  runTar(['-czf', relArtifact, '-C', relBuild, '.']);
} catch (err) {
  fail(`调用 tar 失败（Windows 需 10 1803+ 自带 tar，Git Bash 亦可）：${err.message}`);
}

// ---------------------------------------------------------------------------
// 3. 校验：归档条目数必须与磁盘文件数吻合
//    不校验的话，tar 静默漏归档会一路带到线上（Git Bash 的 tar 有前科）。
// ---------------------------------------------------------------------------
const listing = runTar(['-tzf', relArtifact])
  .split('\n')
  .map((x) => x.trim())
  .filter((x) => x && !x.endsWith('/'))
  .map((x) => x.replace(/^\.\//, ''));

if (listing.length !== files.length) {
  fail(`归档条目数 ${listing.length} 与磁盘文件数 ${files.length} 不一致，发布包不可信，已中止`);
}
const missing = files.filter((f) => !listing.includes(f));
if (missing.length) {
  fail(`以下文件未进归档：${missing.slice(0, 10).join(', ')}`);
}

const size = fs.statSync(artifactPath).size;
const digest = sha256(artifactPath);
fs.writeFileSync(`${artifactPath}.sha256`, `${digest}  ${artifact}\n`);

log(`校验通过：${listing.length}/${files.length} 个条目，${(size / 1024 / 1024).toFixed(2)} MB`);
log(`产物：frontend/dist/${artifact}`);
log(`校验和：frontend/dist/${artifact}.sha256`);
log(`sha256：${digest}`);
log('上传服务器后：tar xzf ' + artifact + ' -C <前端站点根目录>');
