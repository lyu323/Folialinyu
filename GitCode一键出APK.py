# -*- coding: utf-8 -*-
"""
Folia 定制版 v5 · GitCode 一键出 APK

你在【自己能上网的设备】上跑这一条命令即可（凭据只留在本机，不用发给任何人）：

    python GitCode一键出APK.py

它会依次完成：
  1. 用你的 GitCode 私人令牌建一个私有空仓库
  2. 把当前完整工程 push 上去（push 完立刻从 git 配置里抹掉令牌）
  3. GitCode 流水线自动编译 Release APK 并回推到仓库 apk/ 目录
  4. 脚本每 30 秒拉一次，APK 一出现就复制到当前目录：Folia定制版-v5.apk

只取回（脚本被中断后接着等）：
    python GitCode一键出APK.py --fetch-only

Token 也可以通过环境变量给：GITCODE_TOKEN=xxxx python GitCode一键出APK.py
"""
import os, sys, json, time, shutil, subprocess, getpass, urllib.request, urllib.error, urllib.parse

REPO_NAME = 'folia-custom'
APK_NAME = 'Folia定制版-v5.apk'
API = 'https://api.gitcode.com/api/v5'
HOST = 'gitcode.com'
WAIT_SECONDS = 60 * 60          # 最多等 60 分钟
POLL_SECONDS = 30

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = HERE if os.path.exists(os.path.join(HERE, 'package.json')) else os.getcwd()


def api(method, path, token, body=None):
    url = API + path + ('&' if '?' in path else '?') + 'access_token=' + urllib.parse.quote(token)
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Content-Type': 'application/json',
                                          'Accept': 'application/json',
                                          'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode('utf-8', 'ignore')
            return r.status, (json.loads(raw) if raw.strip().startswith(('{', '[')) else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'ignore')
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:300]
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
    """尝试从仓库 apk/ 或 输出APK/ 取回 APK；找到返回 True。"""
    if os.path.isdir(os.path.join(ROOT, '.git')):
        git('pull', '--rebase', check=False)
    hits = []
    for pat in ('apk/*.apk', '输出APK/*.apk', APK_NAME):
        import glob
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


def main():
    os.chdir(ROOT)
    print('=' * 62)
    print(' Folia 定制版 v5 · GitCode 一键出 APK')
    print(' 工程目录：' + ROOT)
    print('=' * 62)

    if '--fetch-only' in sys.argv:
        if fetch_apk():
            return
        print('还没找到 APK，稍后再跑一次本脚本（加 --fetch-only 也可以）。')
        return

    if not os.path.exists(os.path.join(ROOT, 'package.json')) or not os.path.exists(
            os.path.join(ROOT, 'android', 'app', 'build.gradle')):
        sys.exit('❌ 请把本脚本放在【解压后的完整工程根目录】再运行')

    token = os.environ.get('GITCODE_TOKEN', '').strip()
    if not token:
        for a in sys.argv[1:]:
            if not a.startswith('--'):
                token = a.strip()
                break
    if not token:
        print('\n需要 GitCode 私人令牌（PAT）：\n'
              '  GitCode → 右上角头像 → 个人设置 → 访问令牌 → 创建新令牌\n'
              '  勾「仓库读写」，有效期选 7 天，生成后立刻复制\n'
              '  ⚠️  令牌不用发给我，只在你本机用；脚本不会写进任何文件\n')
        token = getpass.getpass('粘贴 PAT（输入不回显）：').strip()
    if not token:
        sys.exit('❌ 没拿到令牌')

    # 1) 校验并取用户名
    code, me = api('GET', '/user', token)
    if code != 200:
        sys.exit('❌ 令牌校验失败（HTTP %s）：%s\n   检查令牌是否过期、是否勾了仓库权限' % (code, str(me)[:200]))
    login = (me.get('login') or me.get('username') or me.get('name') or '').strip() if isinstance(me, dict) else ''
    if not login:
        sys.exit('❌ 没读到 GitCode 用户名，返回：' + str(me)[:200])
    print('\n[1/4] 令牌有效，账号：' + login)

    # 2) 建仓（已存在就复用）
    code, repo = api('POST', '/user/repos', token, {
        'name': REPO_NAME, 'path': REPO_NAME,
        'description': 'Folia 定制版 v5 · 自动编译 APK',
        'private': True, 'public': 0, 'auto_init': False,
        'has_issues': False, 'has_wiki': False,
    })
    if code in (201, 200, 409) or (isinstance(repo, dict) and repo.get('path') == REPO_NAME):
        print('[2/4] 仓库就绪：%s/%s' % (login, REPO_NAME))
    else:
        print('[2/4] 建仓返回 HTTP %s：%s' % (code, str(repo)[:200]))
        print('      若你已在网页手动建好同名仓库，脚本会直接复用，继续推送。')

    # 3) 推送（令牌只进这一次的 URL，推完立刻抹掉）
    remote = 'https://%s/%s/%s.git' % (HOST, login, REPO_NAME)
    auth_remote = 'https://%s:%s@%s/%s/%s.git' % (
        urllib.parse.quote(login), urllib.parse.quote(token), HOST, login, REPO_NAME)
    print('\n[3/4] 推送工程（首次约 1–3 分钟）…')
    if not os.path.isdir(os.path.join(ROOT, '.git')):
        git('init')
        git('branch', '-M', 'main')
    git('config', 'user.name', 'folia-builder')
    git('config', 'user.email', 'folia-builder@localhost')
    with open(os.path.join(ROOT, '.gitignore'), 'a', encoding='utf-8') as f:
        f.write('\n# build outputs\nnode_modules/\ndist/\nandroid/.gradle/\nandroid/build/\n'
                'android/app/build/\nandroid/app/folia-custom.keystore\n'
                'android/keystore.properties\n输出APK/\n*.apk~\n')
    git('add', '-A')
    git('commit', '-m', 'Folia 定制版 v5：push 即自动编译 APK', check=False)
    cur = subprocess.run(['git', 'remote', 'get-url', 'origin'], cwd=ROOT,
                         capture_output=True, text=True)
    if cur.returncode != 0:
        git('remote', 'add', 'origin', auth_remote)
    else:
        git('remote', 'set-url', 'origin', auth_remote)
    r = subprocess.run(['git', 'push', '-u', 'origin', 'main', '--force'],
                       cwd=ROOT, capture_output=True, text=True, timeout=600)
    print('   ' + (r.stdout + r.stderr).strip()[:400].replace('\n', '\n   '))
    git('remote', 'set-url', 'origin', remote)   # 立刻抹掉令牌
    if r.returncode != 0:
        sys.exit('\n❌ 推送失败。常见原因：令牌没勾仓库写权限 / 网页端已初始化了 README。'
                 '\n   可在网页删掉仓库重跑，或手动建空仓库后重跑。')
    print('   ✅ 推送完成，凭据已从 git 配置移除')

    # 4) 等云端编译并取回
    print('\n[4/4] 云端编译中（首次约 15–30 分钟，主要在下 NDK）…')
    print('      进度可看：https://%s/%s/%s/-/pipelines' % (HOST, login, REPO_NAME))
    print('      提示：若你的 GitCode 项目需要手动启用流水线，去「CI/CD → 流水线」点一次启用。')
    print('      可选：在「设置 → CI/CD → 变量」加一个 GITCODE_TOKEN，'
          '流水线会把 APK 自动回推到仓库 apk/；不加也能在流水线页下载 artifacts。\n')
    deadline = time.time() + WAIT_SECONDS
    while time.time() < deadline:
        if fetch_apk():
            return
        left = int(deadline - time.time())
        print('   ⏳ 还没好，%d 分 %02d 秒后再查…' % (left // 60, left % 60), flush=True)
        time.sleep(POLL_SECONDS)
    print('\n⏰ 等待超时。去流水线页看日志或下载 artifacts，之后跑：')
    print('   python GitCode一键出APK.py --fetch-only')


if __name__ == '__main__':
    main()
