#!/usr/bin/env python
"""
Evermodel Ops — 后端发布包打包脚本

产出：backend/dist/evermodel_ops-<版本>.tar.gz（附 .sha256）

注意：后端是 Python / Django 工程，**不产出 .jar**（jar 是 JVM 的产物）。
本脚本用 Python 标准库 tarfile 直接生成发布包，不依赖外部 tar 命令
（Git Bash 的 tar 有漏归档前科，标准库可控且可靠）。

用法（在 backend/ 下，用 venv 里的 python 或系统 python 均可）：

    python tools/build_release.py                    # 打包
    python tools/build_release.py --list              # 只列出会被打进包的文件
    python tools/build_release.py --include-overrides # 连带本地 overrides.py 一起打（含明文密码，慎用）
    VERSION=v4.0.2 python tools/build_release.py      # 指定版本号

服务器侧还原：

    sudo tar xzf evermodel_ops-v4.0.1.tar.gz -C /data/evermodel_ops/backend
"""

import argparse
import hashlib
import os
import re
import sys
import tarfile

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BACKEND_DIR, 'dist')
SETTINGS_PY = os.path.join(BACKEND_DIR, 'evermodel_ops', 'settings.py')

# 目录名（相对 backend/）整棵排除
EXCLUDE_DIRS = {
    'venv',            # 跨平台不可复用，服务器自己建
    '__pycache__',
    '.pytest_cache',
    'dist',            # 打包产物自身
    'node_modules',
    '.idea',
    '.vscode',
}

# 路径通配（相对 backend/，按前缀匹配）整棵排除
EXCLUDE_PREFIXES = (
    'repos/',            # 运行期的仓库缓存
    'storage/transfer/', # 运行期的分发临时文件
)

# 单文件精确排除
EXCLUDE_FILES = {
    'db.sqlite3',
    'access.log',
    '.env',
    'evermodel_ops/overrides.py',   # 含各环境明文密码与地址，默认不入包
}

# 后缀排除
EXCLUDE_SUFFIXES = (
    '.pyc', '.pyo', '.pyd',
    '.log',
    '.swp', '.swo', '~',
)

# logs/ 只保留 .gitkeep，让解压后目录天然存在
KEEP_IF_MATCHES = (
    'logs/.gitkeep',
    'storage/transfer/.gitkeep',
)


def log(msg):
    sys.stdout.write('[build_release] %s\n' % msg)


def fail(msg):
    sys.stderr.write('[build_release] 错误：%s\n' % msg)
    sys.exit(1)


def resolve_version():
    """版本号来源：VERSION 环境变量 > settings.py 的 EVERMODEL_VERSION > 时间戳兜底。"""
    if os.environ.get('VERSION'):
        return os.environ['VERSION']
    try:
        with open(SETTINGS_PY, encoding='utf-8') as fh:
            hit = re.search(r"""EVERMODEL_VERSION\s*=\s*['"]([^'"]+)['"]""", fh.read())
        if hit:
            return hit.group(1)
    except OSError:
        pass
    import datetime
    return 'v0.0.0-%s' % datetime.datetime.now().strftime('%Y%m%d%H%M')


def should_skip(rel, include_overrides=False):
    """rel 是相对 backend/ 的 POSIX 风格路径，返回 True 表示不打包。"""
    if include_overrides and rel == 'evermodel_ops/overrides.py':
        return False

    if rel in KEEP_IF_MATCHES:
        return False

    parts = rel.split('/')

    # 任意层级的排除目录
    if any(p in EXCLUDE_DIRS for p in parts[:-1]):
        return True
    if parts[0] in EXCLUDE_DIRS:
        return True

    # logs/ 下只留 .gitkeep
    if parts[0] == 'logs':
        return rel not in KEEP_IF_MATCHES

    # 前缀排除
    if any(rel.startswith(p) for p in EXCLUDE_PREFIXES):
        return True

    if rel in EXCLUDE_FILES:
        return True
    if any(rel.endswith(s) for s in EXCLUDE_SUFFIXES):
        return True

    return False


def collect(include_overrides):
    files = []
    for dirpath, dirnames, filenames in os.walk(BACKEND_DIR):
        # 就地裁剪，避免走进大目录（venv 有几万文件）
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, BACKEND_DIR).replace(os.sep, '/')
            if should_skip(rel, include_overrides):
                continue
            files.append(rel)
    return sorted(files)


def human(size):
    for unit in ('B', 'KB', 'MB', 'GB'):
        if size < 1024 or unit == 'GB':
            return '%.2f %s' % (size, unit)
        size /= 1024.0


def main():
    parser = argparse.ArgumentParser(description='打包 Evermodel Ops 后端发布包')
    parser.add_argument('--list', action='store_true', help='只列出会被打包的文件，不生成包')
    parser.add_argument('--include-overrides', action='store_true',
                        help='把本地 evermodel_ops/overrides.py 一起打进包（含明文密码，分发前请三思）')
    args = parser.parse_args()

    if not os.path.exists(os.path.join(BACKEND_DIR, 'manage.py')):
        fail('在 %s 下找不到 manage.py，请确认本脚本放在 backend/tools/ 下' % BACKEND_DIR)

    files = collect(args.include_overrides)

    if args.list:
        log('共 %d 个文件待打包：' % len(files))
        for rel in files:
            sys.stdout.write('  %s\n' % rel)
        return

    version = resolve_version().lstrip('v')
    artifact_name = 'evermodel_ops-v%s.tar.gz' % version
    os.makedirs(DIST_DIR, exist_ok=True)
    artifact = os.path.join(DIST_DIR, artifact_name)
    if os.path.exists(artifact):
        os.remove(artifact)

    log('版本      v%s' % version)
    log('文件数    %d' % len(files))
    log('overrides %s' % ('已包含（含明文密码）' if args.include_overrides else '已排除，部署时从 overrides.py.example 复制'))
    log('输出      backend/dist/%s' % artifact_name)

    # ------------------------------------------------------------------
    # 归档：arcname 用相对路径，解压出来就是 backend/ 的内容（不带 backend/ 前缀），
    # 直接 `tar xzf ... -C /data/evermodel_ops/backend` 即可。
    # ------------------------------------------------------------------
    written = 0
    with tarfile.open(artifact, 'w:gz') as tar:
        for rel in files:
            full = os.path.join(BACKEND_DIR, rel)
            tar.add(full, arcname=rel, recursive=False)
            written += 1

    # ------------------------------------------------------------------
    # 校验：归档里的成员数必须与磁盘文件数一致。
    # 不校验的话「静默漏归档」会一路带到线上，部署时才炸。
    # ------------------------------------------------------------------
    with tarfile.open(artifact, 'r:gz') as tar:
        members = [m for m in tar.getnames() if not m.endswith('/')]

    if written != len(files) or len(members) != len(files):
        fail('归档条目数 %d / 写入 %d 与磁盘文件数 %d 不一致，发布包不可信，已中止'
             % (len(members), written, len(files)))

    missing = sorted(set(files) - set(members))
    if missing:
        fail('以下文件未进归档：%s' % ', '.join(missing[:10]))

    size = os.path.getsize(artifact)
    digest = hashlib.sha256(open(artifact, 'rb').read()).hexdigest()
    with open(artifact + '.sha256', 'w', encoding='utf-8') as fh:
        fh.write('%s  %s\n' % (digest, artifact_name))

    log('校验通过  %d/%d 个条目，%s' % (len(members), len(files), human(size)))
    log('产物      backend/dist/%s' % artifact_name)
    log('校验和    backend/dist/%s.sha256' % artifact_name)
    log('sha256    %s' % digest)
    log('服务器侧  sudo tar xzf %s -C /data/evermodel_ops/backend' % artifact_name)


if __name__ == '__main__':
    main()
