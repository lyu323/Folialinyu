# -*- coding: utf-8 -*-
"""云端编译完成后，把仓库里自动回推的 APK 取回本地。
用法（在工程根目录）：python 取回APK.py
编好后跑一次即可；还没编好会提示你稍后再跑。
"""
import os, glob, shutil, subprocess, sys

root = os.path.dirname(os.path.abspath(__file__))
os.chdir(root)
print('工程目录：', root)

# 1) 拉取云端回推的产物
if os.path.isdir('.git'):
    print('\n[1/3] git pull 取回仓库最新内容…')
    r = subprocess.run(['git', 'pull', '--rebase'], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip() or '已是最新')[:300])
else:
    print('\n[1/3] 当前不是 git 仓库，直接查本地 apk/ 目录')

# 2) 找 APK
print('\n[2/3] 查找编译产物…')
hits = sorted(glob.glob('apk/*.apk') + glob.glob('输出APK/*.apk') +
              glob.glob('Folia定制版-v5.apk'))
if not hits:
    print('\n  ⏳ 还没找到 APK。')
    print('     云端首次编译约需 15–25 分钟，去仓库 Actions 页看进度，')
    print('     变绿之后（或收到「自动回推编译产物」这条 commit）再跑一次本脚本。')
    sys.exit(0)

src = hits[0]
size = os.path.getsize(src)
print('  ✅ 找到：%s（%.1f MB）' % (src, size / 1024 / 1024))
if size < 5 * 1024 * 1024:
    print('  ⚠️  文件偏小，可能不是完整 APK，建议核对')

# 3) 复制到根目录，方便直接传手机
dst = os.path.join(root, 'Folia定制版-v5.apk')
if os.path.abspath(src) != os.path.abspath(dst):
    shutil.copy2(src, dst)
print('\n[3/3] 已取回：', dst)

print()
print('=' * 60)
print(' 🎉 APK 到手：Folia定制版-v5.apk')
print('    传到手机 → 允许「未知来源」→ 安装')
print('    包名与社区版不同，需先卸载社区版')
print('=' * 60)
