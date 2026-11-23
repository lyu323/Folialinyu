# -*- coding: utf-8 -*-
"""只检查环境、不构建：列出还缺什么，避免白跑半小时。
用法: python 环境检查.py
"""
import os, subprocess, shutil, sys

REQUIRED = [
    ('node',      'Node.js 24',            'https://nodejs.org'),
    ('npm',       'npm（随 Node 附带）',    'https://nodejs.org'),
    ('java',      'JDK 21',                'https://adoptium.net'),
    ('javac',     'JDK 21（编译器）',       'https://adoptium.net'),
    ('keytool',   'JDK 21（签名工具）',     'https://adoptium.net'),
    ('sdkmanager','Android SDK 命令行工具','Android Studio → SDK Manager → SDK Tools'),
    ('git',       'git（推送用）',          'https://git-scm.com'),
]

def ver(cmd, args):
    try:
        return subprocess.run([cmd] + args, capture_output=True, text=True, timeout=8).stdout.strip() \
            or subprocess.run([cmd] + args, capture_output=True, text=True, timeout=8).stderr.strip()
    except Exception as e:
        return '(无法执行: %s)' % e

print('=' * 60)
print(' Folia 定制版 v5 · 出包环境检查')
print('=' * 60)
missing = []
for cmd, name, url in REQUIRED:
    p = shutil.which(cmd)
    if p:
        v = ver(cmd, ['-version'] if cmd in ('java', 'javac', 'keytool') else ['--version'])
        print('  ✅ %-14s %-26s %s' % (cmd, name, v.splitlines()[0][:60] if v else ''))
    else:
        print('  ❌ %-14s %-26s 缺少 → %s' % (cmd, name, url))
        missing.append((name, url))

sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or ''
if sdk and os.path.isdir(sdk):
    print('  ✅ ANDROID_HOME = %s' % sdk)
else:
    guess = os.path.expanduser('~/Android/Sdk')
    print('  ⚠️  ANDROID_HOME 未设置（常见位置 %s）' % guess)
    missing.append(('ANDROID_HOME', 'Android Studio 默认 SDK 路径'))

# 工程文件检查
here = os.path.dirname(os.path.abspath(__file__))
for f in ['package.json', 'capacitor.config.json', 'android/app/build.gradle',
          'android/gradlew', 'src/index.tsx']:
    p = os.path.join(here, '..', f) if os.path.basename(here) == 'Folia定制版' else os.path.join(here, f)
    if os.path.exists(p):
        print('  ✅ 工程文件 %s' % f)
    else:
        print('  ⚠️  未找到 %s（请确认脚本放在工程根目录）' % f)

print()
print('=' * 60)
if missing:
    print(' 还缺 %d 项，本机暂时编不了 APK。' % len(missing))
    print(' 最省事的替代：用 GitHub Actions 云端出包，看「最短路径-拿APK.md」。')
else:
    print(' 🎉 环境齐全！直接跑：')
    print('    Windows      → 双击 一键出包-Windows.bat')
    print('    macOS/Linux  → bash 一键出包-MacLinux.sh')
print('=' * 60)
sys.exit(0)
