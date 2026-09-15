#!/usr/bin/env node
/**
 * Evermodel Ops — 前端构建/开发命令的跨平台入口
 *
 * 背景：原来的 package.json 里写的是 POSIX 形式的环境变量前缀
 *   "build": "NODE_OPTIONS='--openssl-legacy-provider' GENERATE_SOURCEMAP=false react-app-rewired build"
 * 这在 Git Bash / Linux 下没问题，但在 Windows 的 cmd.exe（npm 的默认 shell）里
 * `VAR='值' cmd` 不是环境变量赋值，会被当成要执行的命令 —— 于是 npm run build 必报错。
 * 本脚本用 Node 自己搞定环境变量与进程参数，三种 shell 下行为一致。
 *
 * 用法（在 frontend/ 下）：
 *   npm start        → node scripts/run.js start    开发服务器 :3000
 *   npm run build    → node scripts/run.js build    产出 build/
 *   npm test         → node scripts/run.js test     跑测试
 */
'use strict';

const { spawnSync } = require('child_process');

const TASKS = {
  start: {
    entry: require.resolve('react-app-rewired/scripts/start'),
    env: {},
  },
  build: {
    entry: require.resolve('react-app-rewired/scripts/build'),
    // 源映射体积大且会泄露源码结构，发布产物一律不生成；CI=false 关掉把 warning 当 error。
    env: { GENERATE_SOURCEMAP: 'false', CI: 'false' },
  },
  test: {
    entry: require.resolve('react-app-rewired/scripts/test'),
    env: {},
  },
};

const task = process.argv[2];
if (!TASKS[task]) {
  process.stderr.write(
    `用法：node scripts/run.js <${Object.keys(TASKS).join('|')}>\n` +
      `（收到的是：${task === undefined ? '空' : task}）\n`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// --openssl-legacy-provider
//
// Node 17+ 默认禁用了 OpenSSL 3 的 legacy provider，而 webpack 4（react-scripts 3.4.3
// 的依赖）用它算 md4 哈希，不加这个参数构建会直接抛：
//   error:0308010C:digital envelope routines::unsupported
// Node 16 及以下不认识这个参数（会报 bad option），因此按大版本判断后再加。
// ---------------------------------------------------------------------------
const nodeMajor = Number(process.versions.node.split('.')[0]);
const argv = [
  ...(nodeMajor >= 17 ? ['--openssl-legacy-provider'] : []),
  TASKS[task].entry,
  ...process.argv.slice(3),
];

const result = spawnSync(process.execPath, argv, {
  stdio: 'inherit',
  env: { ...process.env, ...TASKS[task].env },
});

if (result.error) {
  process.stderr.write(`[run] 启动失败：${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
