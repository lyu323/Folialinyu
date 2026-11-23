#!/usr/bin/env bash
# Folia 定制版 v5 · macOS / Linux 一键出包
# 用法：把本文件放在【已应用补丁的工程根目录】，终端执行  bash 一键出包-MacLinux.sh
# 跑完 APK 会出现在  输出APK/Folia定制版-v5.apk
set -euo pipefail
cd "$(dirname "$0")"

ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
die()  { echo "  ❌ $*"; echo; echo "  看 最短路径-拿APK.md 里的『环境要求』一节"; exit 1; }

echo "=========================================================="
echo " Folia 定制版 v5 · 一键出包（macOS / Linux）"
echo "=========================================================="

# ---------- 1. 环境检查 ----------
echo; echo "[1/7] 检查环境"

command -v node >/dev/null || die "没找到 node，请装 Node.js 24：https://nodejs.org"
NV=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NV" -ge 20 ] || die "Node 版本过低（$(node -v)），需要 20+，推荐 24"

command -v java >/dev/null || die "没找到 java"
JV=$(java -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+).*/\1/')
[ "$JV" -ge 21 ] || die "JDK 版本过低（$JV），AGP 8.x 必须 JDK 21：https://adoptium.net"
ok "Node $(node -v) / JDK $JV"

: "${ANDROID_HOME:=$HOME/Android/Sdk}"
: "${ANDROID_SDK_ROOT:=$ANDROID_HOME}"
export ANDROID_HOME ANDROID_SDK_ROOT
[ -d "$ANDROID_HOME" ] || die "没找到 Android SDK，请先装 Android Studio，或设置 ANDROID_HOME"
SDKM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
[ -x "$SDKM" ] || SDKM="$(command -v sdkmanager || true)"
[ -n "$SDKM" ] || die "没找到 sdkmanager（Android SDK 命令行工具）"
ok "Android SDK: $ANDROID_HOME"

# ---------- 2. 安装 SDK 组件 ----------
echo; echo "[2/7] 安装 Android SDK / NDK / CMake（首次较慢，之后跳过）"
yes | "$SDKM" --licenses >/dev/null 2>&1 || true
"$SDKM" --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" \
                  "ndk;28.2.13676358" "cmake;3.22.1" >/dev/null || \
  warn "部分组件已存在或下载失败，若后面编译报缺失再手动装"
ok "SDK 组件就绪"

# ---------- 3. 前端依赖 ----------
echo; echo "[3/7] 安装前端依赖（npm ci）"
npm ci --no-audit --no-fund
ok "依赖就绪"

# ---------- 4. 构建 Web 资源 ----------
echo; echo "[4/7] 构建 Web 资源"
npm run build:capacitor
ok "dist/ 已生成"

# ---------- 5. 同步 Capacitor ----------
echo; echo "[5/7] 同步 Capacitor 工程"
npx cap sync android
ok "android/ 已同步"

# ---------- 6. 签名 + 编译 ----------
echo; echo "[6/7] 生成签名并编译 Release APK"
cd android
chmod +x gradlew
if [ ! -f app/folia-custom.keystore ]; then
  keytool -genkeypair -v \
    -keystore app/folia-custom.keystore \
    -alias folia-custom -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass folia2026 -keypass folia2026 \
    -dname "CN=Folia Custom, OU=Personal, O=Personal, L=NA, S=NA, C=CN" >/dev/null 2>&1
fi
cat > keystore.properties <<'EOF'
storeFile=folia-custom.keystore
storePassword=folia2026
keyAlias=folia-custom
keyPassword=folia2026
EOF
./gradlew assembleRelease --no-daemon --stacktrace
cd ..
ok "编译完成"

# ---------- 7. 输出 ----------
echo; echo "[7/7] 整理产物"
mkdir -p 输出APK
APK=$(ls android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1)
[ -n "$APK" ] || die "没找到 APK，翻一下上面的 Gradle 报错"
cp "$APK" 输出APK/Folia定制版-v5.apk
ls -lh 输出APK/Folia定制版-v5.apk

echo
echo "=========================================================="
echo " 🎉 完成！APK 在： 输出APK/Folia定制版-v5.apk"
echo "    传到手机，允许『未知来源』即可安装"
echo "    注意：包名与社区版不同，需先卸载社区版"
echo "=========================================================="
