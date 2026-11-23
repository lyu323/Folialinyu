# -*- coding: utf-8 -*-
"""
Folia 定制版 v5 · 国内平台一键出 APK（Gitee / GitCode 自动识别）

在【你自己能上网的设备】上跑（凭据只留本机，不要发给任何人）：

    python 国内平台一键出APK.py

脚本自动识别你贴的令牌属于 Gitee 还是 GitCode（这是两个不同平台，令牌不通用），
然后：建私有空仓库 → push（推完立刻从 git 配置抹掉令牌）→ 轮询取回 APK。

Gitee   → https://gitee.com/profile/personal_access_tokens
GitCode → https://gitcode.com 头像 → 个人设置 → 访问令牌

只取回（脚本中断后接着等）：  python 国内平台一键出APK.py --fetch-only
也可用环境变量：              GITCODE_TOKEN=xxx / GITEE_TOKEN=xxx python 国内平台一键出APK.py

⚠️ 重要：Gitee Go 预置 JDK 最高 11、Node 最高 16；Gitee「Android 在线构建」要求
   标准 Gradle 根目录结构且用 JDK 11。本工程需要 JDK 21 + Node 24 + NDK 28.2 +
   Capacitor 混合结构，所以【Gitee 云编译大概率跑不通】。
   请把 Gitee 当代码托管，编译走：本机「一键出包-Windows.bat / MacLinux.sh」
   或 GitHub Actions（已验证）。详见 最短路径-拿APK.md。
"""
import os, sys, json, time, glob, shutil, subprocess, getpass
import urllib.request, urllib.error, urllib.parse

REPO_NAME = 'folia-custom'
APK_NAME = 'Folia定制版-v5.apk'
POLL_SECONDS = 30
WAIT_SECONDS = 60 * 60

PLATFORMS = {
    'gitee': {
        'label': 'Gitee（码云）',
        'api': 'https://gitee.com/api/v5',
        'host': 'gitee.com',
        'branch': 'master',
        'json': False,
    },
    'gitcode': {
        'label': 'GitCode / AtomGit',
        'api': 'https://api.gitcode.com/api/v5',
        'host': 'gitcode.com',
        'branch': 'main',
        'json': True,
    },
}

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = HERE if os.path.exists(os.path.join(HERE, 'package.json')) else os.getcwd()


def call(method, base, path, token, body=None, as_json=False):
    url = base + path + ('&' if '?' in path else '?') + 'access_token=' + urllib.parse.quote(token)
    if body is None:
        data = None
        ctype = 'application/json'
    elif as_json:
        data = json.dumps(body).encode('utf-8')
        ctype = 'application/json'
    else:
        data = urllib.parse.urlencode(body).encode('utf-8')
        ctype = 'application/x-www-form-urlencoded'
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Content-Type': ctype,
                                          'Accept': 'application/json',
                                          'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode('utf-8', 'ignore')
            try:
                return r.status, json.loads(raw)
            except Exception:
                return r.status, raw[:300]
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'ignore')
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:200]
    except Exception as e:
        return 0, str(e)


def git(*args, check=True):
    r = subprocess.run(['git'] + list(args), cwd=ROOT, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    if out:
        print('   ' + out[:300].replace('\n', '\n   '))
    if check and r.returncode != 0:
        sys.exit('\n❌ git 命令失败，见上方输出')
    return r


def fetch_apk():
    if os.path.isdir(os.path.join(ROOT, '.git')):
        git('pull', '--rebase', check=False)
    hits = []
    for pat in ('apk/*.apk', '输出APK/*.apk', APK_NAME):
        hits += glob.glob(os.path.join(ROOT, pat))
    if not hits:
        return False
    src = sorted(hits, key=os.path.getsize)[-1]
    size = os.path.getsize(src)
    if size < 5 * 1024 * 1024:
        print('   ⚠️  产物偏小（%.1f KB），继续等…' % (size / 1024))
        return False
    dst = os.path.join(ROOT, APK_NAME)
    if os.path.abspath(src) != os.path.abspath(dst):
        shutil.copy2(src, dst)
    print('\n' + '=' * 62)
    print(' 🎉 APK 到手：' + dst)
    print('    %.1f MB · 传到手机，允许「未知来源」安装' % (size / 1024 / 1024))
    print('    包名 top.folia.custom，需先卸载社区版')
    print('=' * 62)
    return True


def detect(token):
    """分别校验两个平台，返回 (key, login)。都不通就明确报网络问题。"""
    for key in ('gitee', 'gitcode'):
        p = PLATFORMS[key]
        code, me = call('GET', p['api'], '/user', token)
        if code == 200 and isinstance(me, dict):
            login = (me.get('login') or me.get('username') or me.get('name') or '').strip()
            if login:
                return key, login
        print('   %s 校验返回 HTTP %s，试下一个…' % (p['label'], code))
    return None, None


def main():
    os.chdir(ROOT)
    print('=' * 62)
    print(' Folia 定制版 v5 · 国内平台一键出 APK')
    print(' 工程目录：' + ROOT)
    print('=' * 62)

    if '--fetch-only' in sys.argv:
        if fetch_apk():
            return
        print('还没找到 APK，编译完成后再跑一次（加 --fetch-only 也行）。')
        return

    if not os.path.exists(os.path.join(ROOT, 'package.json')) or not os.path.exists(
            os.path.join(ROOT, 'android', 'app', 'build.gradle')):
        sys.exit('❌ 请把本脚本放在【解压后的完整工程根目录】再运行')

    token = (os.environ.get('GITEE_TOKEN') or os.environ.get('GITCODE_TOKEN') or '').strip()
    if not token:
        for a in sys.argv[1:]:
            if not a.startswith('--'):
                token = a.strip()
                break
    if not token:
        print('\n需要私人令牌（PAT），两个平台任选其一：\n'
              '  Gitee   → https://gitee.com/profile/personal_access_tokens（勾 projects）\n'
              '  GitCode → gitcode.com 头像 → 个人设置 → 访问令牌（勾仓库读写）\n'
              '  ⚠️  令牌只在你本机用，脚本不写入任何文件；已发到聊天里的令牌请立刻撤销\n')
        token = getpass.getpass('粘贴 PAT（输入不回显）：').strip()
    if not token:
        sys.exit('❌ 没拿到令牌')

    print('\n[1/4] 识别平台…')
    key, login = detect(token)
    if not key:
        sys.exit('\n❌ 两个平台都校验失败。常见原因：\n'
                 '   · 本机网络访问不到 gitee.com / api.gitcode.com（本机防火墙或代理）\n'
                 '   · 令牌已过期 / 没勾 projects 或仓库读写权限\n'
                 '   · 令牌属于别的平台\n'
                 '   先打开 https://gitee.com 或 https://gitcode.com 确认能访问。')
    p = PLATFORMS[key]
    print('   ✅ 识别为 %s，账号：%s' % (p['label'], login))

    # 2) 建仓（已存在就复用）
    code, repo = call('POST', p['api'], '/user/repos', token, {
        'name': REPO_NAME, 'path': REPO_NAME,
        'description': 'Folia 定制版 v5', 'private': True, 'auto_init': False,
        'has_issues': False, 'has_wiki': False,
    }, p['json'])
    print('[2/4] 仓库就绪：%s/%s（建仓返回 HTTP %s，已存在则直接复用）'
          % (login, REPO_NAME, code))

    # 3) 推送（令牌只进这一次的 URL，推完立刻抹掉）
    remote = 'https://%s/%s/%s.git' % (p['host'], login, REPO_NAME)
    auth_remote = 'https://%s:%s@%s/%s/%s.git' % (
        urllib.parse.quote(login), urllib.parse.quote(token), p['host'], login, REPO_NAME)
    branch = p['branch']
    print('\n[3/4] 推送工程到 %s（首次 1–3 分钟）…' % branch)
    if not os.path.isdir(os.path.join(ROOT, '.git')):
        git('init')
    git('config', 'user.name', 'folia-builder')
    git('config', 'user.email', 'folia-builder@localhost')
    with open(os.path.join(ROOT, '.gitignore'), 'a', encoding='utf-8') as f:
        f.write('\n# build outputs\nnode_modules/\ndist/\nandroid/.gradle/\nandroid/build/\n'
                'android/app/build/\nandroid/app/folia-custom.keystore\n'
                'android/keystore.properties\n输出APK/\n')
    git('add', '-A')
    git('commit', '-m', 'Folia 定制版 v5', check=False)
    cur = subprocess.run(['git', 'remote', 'get-url', 'origin'], cwd=ROOT,
                         capture_output=True, text=True)
    if cur.returncode != 0:
        git('remote', 'add', 'origin', auth_remote)
    else:
        git('remote', 'set-url', 'origin', auth_remote)
    r = subprocess.run(['git', 'push', '-u', 'origin', 'HEAD:refs/heads/' + branch, '--force'],
                       cwd=ROOT, capture_output=True, text=True, timeout=600)
    print('   ' + (r.stdout + r.stderr).strip()[:400].replace('\n', '\n   '))
    git('remote', 'set-url', 'origin', remote)   # 立刻抹掉令牌
    if r.returncode != 0:
        sys.exit('\n❌ 推送失败。检查令牌权限、或网页端是否勾了「用 README 初始化」。'
                 '\n   凭据已从 git 配置移除，可删掉仓库重跑。')
    print('   ✅ 推送完成，凭据已从 git 配置移除')

    # 4) 后续指引 + 轮询
    print('\n[4/4] 源码已托管。接下来编译（重要，请先读）：')
    print('   ⚠️  Gitee Go 预置 JDK≤11 / Node≤16，Android 在线构建要求标准 Gradle 结构')
    print('      且用 JDK 11 —— 都和本工程（JDK 21 / Node 24 / NDK 28.2 / Capacitor）不匹配，')
    print('      【Gitee 云编译大概率失败】，别在这上面耗时间。')
    print()
    print('   推荐二选一：')
    print('   ① 本机：装好 Node 24 / JDK 21 / Android Studio 后跑')
    print('        Windows → 一键出包-Windows.bat   |   macOS/Linux → 一键出包-MacLinux.sh')
    print('   ② 云端：把本仓库导入 GitHub（或粘同一份工程新建仓库），')
    print('        用已验证的 .github/workflows/build-custom-apk.yml，push 即自动出包并回推 apk/')
    print()
    print('   编好后把 APK 放进仓库 apk/ 或 输出APK/，本脚本每 30 秒拉一次自动取回：')
    print('        python 国内平台一键出APK.py --fetch-only')
    print()
    print('   GitCode 仓库可试 .gitlab-ci.yml（GitLab 风格流水线），同样未实测。')
    print('   详细信息：最短路径-拿APK.md\n')

    deadline = time.time() + WAIT_SECONDS
    while time.time() < deadline:
        if fetch_apk():
            return
        left = int(deadline - time.time())
        print('   ⏳ 还没发现 APK，%d 分 %02d 秒后再查（Ctrl+C 可退出）…'
              % (left // 60, left % 60), flush=True)
        try:
            time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            print('\n已退出。之后用 --fetch-only 接着等。')
            return
    print('\n⏰ 等待超时。编译完成后跑：python 国内平台一键出APK.py --fetch-only')


if __name__ == '__main__':
    main()
