# 怎么拿到 **完整的 APK**（最短路径）

> 🚨 **安全提醒**：如果你把私人令牌贴进过对话，请先去对应平台**撤销并重置**再用。

> 先说清楚：这个包里**没有 .apk 文件**，我不能把一个文件改名成 apk 交给你，也不会拿社区原版 APK 冒充定制版。
> 下面三条路都能真正编译出**带 v5 全部改动的签名 APK**，按省事程度排序。

---

## 为什么没在这台机器上直接编好

我实际检查过当前环境，缺的东西是硬性的：

| 需要 | 当前 | 差距 |
| --- | --- | --- |
| JDK **21**（AGP 8.x 强制） | JDK 11，且 `javac` 缺失 | 版本不对，编译直接失败 |
| Android SDK platform-36 / build-tools 36 | 完全没有（`sdkmanager` / `aapt2` / `apksigner` 都不存在） | 需约 1.5 GB |
| NDK 28.2.13676358 + CMake 3.22.1 | 没有 | 上游有 Vulkan 原生歌词舞台，必装，约 2.5 GB |
| Gradle 8.14.3 + npm 依赖（81 个包） | 没有；npm / Google / Gradle 源均返回 403 | 拉不下来 |
| 可用磁盘 | **442 MB** | 完整工具链约 **5–7 GB** |

所以本地编译不是「慢一点」，是**不可能**。这也是前几轮一直交付源码补丁的原因。云端（GitHub Actions）有 JDK 21、完整 SDK、14 GB 磁盘和通畅网络，是唯一现实路径。

---

## 🥇 路径 A：GitHub Actions（推荐，只要「推一次 + 拉一次」）

云端编译，你**不需要装任何开发工具，也不用点网页按钮**。工作流已配置成 **push 即自动触发、编完自动把 APK 回推仓库**。

**前提**：一个 GitHub 账号（免费），以及任意一台能跑一次 Python 的电脑。

1. **解压** `Folia定制版_v5_完整工程.zip`（已经是改好、包名迁移完成的完整源码树）
2. **推送**：在 GitHub 新建一个**空仓库**（不要勾 README / license），然后
   `python 一键推送到GitHub.py https://github.com/你的名字/folia-custom.git`
   这一步会自动 `git add / commit / push`
3. **等着**：push 完成，云端立刻开始编译，约 **15–25 分钟**（首次要下 NDK 和 npm 依赖）。中间可以去仓库 **Actions** 页看进度，也可以不管
4. **取回**：等状态变绿后，在工程根目录跑
   `python 取回APK.py`
   它会自动 `git pull`，把云端回推的 `apk/Folia定制版-v5.apk` 复制到本地

> 没等到？脚本会提示「还没找到 APK」，过几分钟再跑一次即可。
> 保底：Actions 页面底部 **Artifacts** 里也有 `Folia-定制版-v5-APK` 可下载。

为什么能做到「不用点按钮」：工作流里 `on: push` 自动触发，最后一步用内置 `GITHUB_TOKEN` 把 APK commit 回 `apk/`；`paths-ignore` 排除了 `apk/`，自己回推不会再次触发，不会死循环。

---

## 🆕 路径 A2：GitCode（国内可用，不用 GitHub）

适合「没有 GitHub 令牌、但有 GitCode 账号」。

**实测限制先说清**：这个工作环境到 `gitcode.com`、`api.gitcode.com`、Gitee、AtomGit、CNB 全部返回 `403 policy_default_denied`（沙盒网络白名单只放通 `github.com`、`raw.githubusercontent.com`、`codeload.github.com` 等少数域名）。所以 **GitCode 这条路我没法代办**：即使把令牌发我，我也连不上、推不了代码、盯不了构建、取不回产物。**令牌不要发给我**，只在你自己设备上用，反而更安全。

**你只需要一条命令**：

1. 解压 `Folia定制版_v5_完整工程.zip`
2. GitCode → 头像 → 个人设置 → 访问令牌 → 创建新令牌：勾「仓库读写」，有效期选 7 天，生成后立刻复制
3. 在工程根目录跑：`python GitCode一键出APK.py`，按提示粘贴 PAT（输入不回显）
4. 脚本自动完成：建私有空仓库 → push（推完**立刻从 git 配置里抹掉令牌**）→ 流水线自动编译 → 每 30 秒拉一次，APK 一出现就复制到根目录 `Folia定制版-v5.apk`

首次约 **15–30 分钟**（主要在下 NDK）。中途断了用 `python GitCode一键出APK.py --fetch-only` 接着等。

**可选一步**：在仓库「设置 → CI/CD → 变量」加 `GITCODE_TOKEN`，流水线会把 APK 自动回推到 `apk/`；不加也能在流水线页下载 artifacts（`输出APK/`）。

**如实说明风险**：GitCode 共享 runner 能否拉取 2.5GB NDK、免费流水线时长是否够，我**没有实测条件**（沙盒访问不了 GitCode）。流水线已写多源 SDK 下载兜底与失败日志上传；若因 SDK 源不通失败，保底走「路径 B 本机一键编译」或「路径 A GitHub Actions（已验证的工作流）」。

> 若你其实可以弄 GitHub：令牌不需要「已有」，`github.com/settings/tokens/new` 一分钟生成（勾 `repo` + `workflow`、7 天）发我，我就能**全程代办**，把 `.apk` 文件直接交到你手上，一步都不用你做。

---

## 🆕 路径 A3：Gitee（码云）—— 你手上这个令牌所属的平台

### ⚠️ 第一件事：请立刻作废刚才那串令牌

你把私人令牌直接贴在对话里了。它现在已经出现在聊天记录中，**不管我有没有用、也不管我这边能不能连上，都请按泄露处理**：

> 打开 <https://gitee.com/profile/personal_access_tokens> → 删掉/重置那一条 → 重新生成一个。
> 新勾 `projects`（仓库读写）+ `user_info`，有效期选 7 天，用完再删。
> **新令牌不要再发给任何人、也不要贴进聊天**，只在自己电脑的终端里粘贴（输入不回显）。

我没有拿它发过任何请求，也没把它写进任何文件或交付物。

### 两个容易混的点

1. **Gitee（gitee.com，码云）和 GitCode（gitcode.com，CSDN 旗下 / AtomGit）是两个不同平台，令牌不通用。** 你给的链接是 Gitee 的私人令牌页，32 位十六进制串也是 Gitee 常见的 PAT 格式；前面那条路写的是 GitCode。新脚本 `国内平台一键出APK.py` 会**自动识别**你贴的是哪家的令牌，不用自己判断。
2. **这个工作环境到 `gitee.com`、`gitee.com/api/v5`、`gitcode.com`、`api.gitcode.com` 全部返回 `403 policy_default_denied`** —— 是域名级网络白名单，跟令牌对不对无关（不带令牌复测也一样 403）。所以 **「我全程代办」在 Gitee / GitCode 上都做不到**：我连不上、推不了代码、盯不了构建、也取不回产物。

### 在你的设备上怎么走

1. 解压 `Folia定制版_v5_完整工程.zip`
2. 按上面**重置**令牌，复制新的
3. 工程根目录跑：`python 国内平台一键出APK.py`，按提示粘贴新令牌（输入不回显）
4. 脚本自动：识别平台 → 建私有空仓库 → push（**推完立刻从 git 配置抹掉令牌**）→ 给出编译指引 → 每 30 秒轮询，APK 一进仓库就复制到根目录 `Folia定制版-v5.apk`
5. 脚本中断过：`python 国内平台一键出APK.py --fetch-only` 接着等

### 必须说清：Gitee 的云编译大概率跑不通这个工程

我查了 Gitee 官方帮助中心，硬限制对不上：

| 本工程需要 | Gitee 提供 |
| --- | --- |
| JDK **21**（AGP 8.x 强制） | Gitee Go `build@gradle` 预置 jdkVersion 6–11；「Android 在线构建」示例也是 OpenJDK 11 |
| Node **24** + `npm ci` + `cap sync` | Gitee Go `build@nodejs` 预置到 16.x；在线构建只跑 `gradlew`，不跑 npm |
| NDK 28.2 + CMake 3.22.1（Vulkan 原生歌词舞台） | 预置环境不提供，Runner 未必能装 |
| Capacitor 混合结构（根目录 `package.json`，Android 在 `android/`） | 「Android 在线构建」要求**标准 Gradle 根目录结构**，`gradlew` 必须在根 |
| 约 6 GB 工具链 | Gitee Go 免费额度：单仓库 200 分钟 + 每月约 500 分钟（2C4G 折算），需绑手机号 / 实名认证 |

所以 **别把时间耗在让 Gitee CI 编出 APK 上**。Gitee 在这里只当代码托管，编译走下面两条已经能跑通的路：

- **① 本机（最稳）**：装好 Node 24 / JDK 21 / Android Studio 后跑 `一键出包-Windows.bat` 或 `一键出包-MacLinux.sh`，约 20 分钟出 `输出APK/Folia定制版-v5.apk`
- **② GitHub Actions（已验证）**：把同一份工程 push 到 GitHub（或让 Gitee 仓库做镜像），用包里现成的 `.github/workflows/build-custom-apk.yml`，**push 即自动编译、编完自动把 APK 回推到仓库 `apk/`**。GitHub 令牌不需要「已有」，<https://github.com/settings/tokens/new> 一分钟生成（勾 `repo` + `workflow`、7 天）。这条给我令牌我能全程代办，把 `.apk` 直接交到你手上。
- 若仍想试 Gitee Go：在流水线可视化界面加「**基于镜像的 Shell 脚本执行**」任务，指定 `ubuntu:24.04`，把包里 `.gitlab-ci.yml` 的 `script:` 命令整段粘进去。这是**未实测**的尝试，失败就回到 ① 或 ②。

### 保底

能立刻装、但**不带任何定制改动**的仍是社区原版：
<https://github.com/whycfawa/folia-android/releases/download/v0.7.29-android.492/Folia-Android-0.7.29-android.492.apk>

---

## 🥈 路径 B：自己电脑一键编译（有 Windows / Mac / Linux）

需要：Node.js 24、JDK 21、Android Studio（勾上 SDK 36 / NDK 28.2 / CMake 3.22.1）、约 6 GB 空余磁盘。

1. 先跑 `python 环境检查.py`，它会逐项告诉你还缺什么（不构建，几秒出结果）
2. 全绿之后：
   - **Windows**：双击 `一键出包-Windows.bat`
   - **macOS / Linux**：`bash 一键出包-MacLinux.sh`
3. 脚本自动完成：装 SDK 组件 → `npm ci` → `npm run build:capacitor` → `npx cap sync android` → 生成自签名 → `gradlew assembleRelease`
4. APK 出现在 `输出APK/Folia定制版-v5.apk`

首次约 15–30 分钟（主要在下载 NDK 和 npm 依赖），之后有缓存会快很多。

---

## 🥉 路径 C：把完整工程交给能编译的人 / 自己的 CI

`Folia定制版_v5_完整工程.zip` 是**已经改好、包名已迁移、可直接 `npm ci` 的完整源码树**，不是增量补丁。发给有 Android 环境的朋友、或丢进你公司的 CI，按路径 B 的步骤跑即可。

---

## 装到手机上

- Android 7.0+；建议 Android 10+（液态玻璃的 `backdrop-filter` 在老 WebView 上会退化成普通半透明，不会白屏）
- 安装时允许「**未知来源**」
- ⚠️ 包名是 `top.folia.custom`、签名也是自签的，**不能覆盖安装社区版**，先卸载（会清登录态与本地曲库缓存）
- 上游 AGPL-3.0，仅供个人学习与非营利测试；在线音乐、歌词、封面版权归各平台

---

## 实在不想折腾

能立刻装的是**社区原版**（没有本定制版的任何改动）：
<https://github.com/whycfawa/folia-android/releases/download/v0.7.29-android.492/Folia-Android-0.7.29-android.492.apk>
约 18.5 MB，国内可在链接前加 `https://ghfast.top/`。


---

## v6 · 星云纪元（0.7.29-custom.6 / versionCode 536）

> 本版本在 v5 基础上**增量叠加**，v5 的所有文件与能力完整保留。

### 启动页
- 新增**星云**样式为默认：折射玻璃核 + 三层倾斜轨道 + conic 光环 + 3 条流星拖尾 + 标题逐字浮现 + 光带进度
- 原「液态玻璃」「3D 晶体」两套完整保留，三态可在设置里切换；支持「重播启动动画」
- 纯 CSS + 2D canvas 星尘，不用 WebGL；减少动态效果 / 跳过动画 / 12 秒兜底均保留

### 新增功能
- **主题预设收藏夹**：把当前整套外观命名保存、一键切回、删除
- **五组细腻调节**：界面密度、精致度、字距、字重、微动效强度
- **流光强调色**（一条 CSS 变量驱动，零逐帧 blur）、**静谧模式**、**低对比文字提亮**
- **低电量自动省电**（Battery Status，不支持则静默跳过）
- **启动耗时 / 实时帧率读数**、复制诊断、**更新日志面板**、**恢复 v6 默认**（不动用户数据）
- 左下角可拖动 ✦ 徽标：点击开面板，长按 600ms 切静谧模式，位置记忆

### 更流畅
- 零常驻 `backdrop-filter`；装饰全部静态渐变 + `transform/opacity`
- 初始化按 `requestIdleCallback` 分三批；监听全部 passive
- 离屏装饰动画由 IntersectionObserver 暂停；长列表 `content-visibility`
- **低帧三级自适应降级**：连续 3 次 < 42 FPS 依次关流光 → 收精致度 → 收微动效 + 静谧
- 低对比文字扫描「命中即停」，最多 48 个元素，12 秒后强制断开

### 版本归档
- 仓库 `versions/v5/`：v5 完整工程包与 v5 APK，原样保留
- 仓库 `versions/v6/`：v6 完整工程包与本更新日志
- 仓库根目录：v6 完整源码树；`apk/` 同时保留 v5 与 v6 产物
