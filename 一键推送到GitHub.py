# -*- coding: utf-8 -*-
"""把【已应用补丁】的工程一键 commit + push 到你自己的 GitHub 仓库。
推完去仓库 Actions → 构建 Folia 定制版 APK → Run workflow → 下载 APK。

用法:
  1. 先在 GitHub 新建一个空仓库（不要勾 README/license）
  2. 把下面 REPO_URL 改成你的仓库地址，或运行时当参数传：
       python 一键推送到GitHub.py https://github.com/你的名字/folia-custom.git
  3. 双击/执行本脚本
"""
import os, subprocess, sys

REPO_URL = 'https://github.com/你的名字/folia-custom.git'

def run(args, check=True):
    print('  $ ' + ' '.join(args))
    r = subprocess.run(args, capture_output=True, text=True)
    if r.stdout.strip(): print('    ' + r.stdout.strip()[:400].replace('\n', '\n    '))
    if r.stderr.strip(): print('    ' + r.stderr.strip()[:400].replace('\n', '\n    '))
    if check and r.returncode != 0:
        sys.exit('\n❌ 命令失败，见上方输出。最常见原因：没登录 git / 仓库地址写错。')
    return r

url = sys.argv[1] if len(sys.argv) > 1 else REPO_URL
if '你的名字' in url:
    sys.exit('❌ 请先把 REPO_URL 改成你自己的仓库地址，或运行时把地址当参数传进来。')

# 脚本在 Folia定制版/ 目录里，工程根是它的上一级
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here) if os.path.basename(here) == 'Folia定制版' else here
os.chdir(root)
print('工程目录：', root)

if not os.path.exists('android/app/build.gradle'):
    sys.exit('❌ 这不像已应用补丁的工程（缺 android/app/build.gradle）。\n'
             '   请先跑：python 一键应用补丁.py /工程路径')

if not os.path.isdir('.git'):
    run(['git', 'init'])
    run(['git', 'branch', '-M', 'main'])

# 避免把本地构建产物、密钥、备份推上去
open('.gitignore', 'a', encoding='utf-8').write(
    '\n# v5\nnode_modules/\ndist/\nandroid/.gradle/\nandroid/build/\n'
    'android/app/build/\nandroid/app/folia-custom.keystore\n'
    'android/keystore.properties\n输出APK/\n_定制前备份_*/\n')

run(['git', 'add', '-A'])
run(['git', 'commit', '-m', 'Folia 定制版 v5：液态玻璃 + 流畅度优化'], check=False)

r = run(['git', 'remote', 'get-url', 'origin'], check=False)
if r.returncode != 0:
    run(['git', 'remote', 'add', 'origin', url])
else:
    run(['git', 'remote', 'set-url', 'origin', url])

run(['git', 'push', '-u', 'origin', 'main'])

print()
print('=' * 60)
print(' ✅ 已推送！云端会自动开始编译（push 即触发，不用手动点）')
print()
print('   等 15–25 分钟后，在工程根目录跑：')
print('       python 取回APK.py')
print('   它会 git pull 并自动把 apk/Folia定制版-v5.apk 取回本地。')
print()
print('   想看进度：仓库页面 → Actions 选项卡')
print('=' * 60)
