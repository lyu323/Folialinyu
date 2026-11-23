@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==========================================================
echo  Folia 定制版 v5 - 一键出包 (Windows)
echo ==========================================================
echo.

echo [1/7] 检查环境
where node >nul 2>&1 || (echo  ❌ 没找到 node，请装 Node.js 24: https://nodejs.org && goto :fail)
for /f "tokens=1 delims=." %%a in ('node -v') do set NV=%%a
set NV=%NV:v=%
if %NV% LSS 20 (echo  ❌ Node 版本过低，需要 20+ 推荐 24 && goto :fail)
where java >nul 2>&1 || (echo  ❌ 没找到 java，请装 JDK 21: https://adoptium.net && goto :fail)
for /f "tokens=3 delims= " %%a in ('java -version 2^>^&1 ^| findstr /i "version"') do set JV=%%a
set JV=%JV:"=%
for /f "tokens=1 delims=." %%a in ("%JV%") do set JM=%%a
if %JM% LSS 21 (echo  ❌ JDK 版本过低(%JM%)，AGP 8.x 必须 JDK 21 && goto :fail)
echo  ✅ Node / JDK 21 就绪

if "%ANDROID_HOME%"=="" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not exist "%ANDROID_HOME%" (echo  ❌ 没找到 Android SDK，请装 Android Studio 或设置 ANDROID_HOME && goto :fail)
set "SDKM=%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat"
if not exist "%SDKM%" (echo  ❌ 没找到 sdkmanager: %SDKM% && goto :fail)
echo  ✅ Android SDK: %ANDROID_HOME%

echo.
echo [2/7] 安装 SDK / NDK / CMake（首次较慢）
call "%SDKM%" --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;28.2.13676358" "cmake;3.22.1" >nul 2>&1
echo  ✅ SDK 组件就绪

echo.
echo [3/7] 安装前端依赖
call npm ci --no-audit --no-fund || goto :fail
echo  ✅ 依赖就绪

echo.
echo [4/7] 构建 Web 资源
call npm run build:capacitor || goto :fail
echo  ✅ dist 已生成

echo.
echo [5/7] 同步 Capacitor
call npx cap sync android || goto :fail
echo  ✅ android 已同步

echo.
echo [6/7] 生成签名并编译 Release APK
cd android
if not exist app\folia-custom.keystore (
  keytool -genkeypair -v -keystore app\folia-custom.keystore -alias folia-custom -keyalg RSA -keysize 2048 -validity 10000 -storepass folia2026 -keypass folia2026 -dname "CN=Folia Custom, OU=Personal, O=Personal, L=NA, S=NA, C=CN" >nul 2>&1
)
> keystore.properties echo storeFile=folia-custom.keystore
>>keystore.properties echo storePassword=folia2026
>>keystore.properties echo keyAlias=folia-custom
>>keystore.properties echo keyPassword=folia2026
call gradlew.bat assembleRelease --no-daemon --stacktrace || goto :fail
cd ..
echo  ✅ 编译完成

echo.
echo [7/7] 整理产物
if not exist 输出APK mkdir 输出APK
set "APK="
for %%f in (android\app\build\outputs\apk\release\*.apk) do set "APK=%%f"
if "%APK%"=="" (echo  ❌ 没找到 APK，翻一下上面的 Gradle 报错 && goto :fail)
copy /y "%APK%" "输出APK\Folia定制版-v5.apk" >nul
dir "输出APK\Folia定制版-v5.apk"

echo.
echo ==========================================================
echo  🎉 完成！APK 在  输出APK\Folia定制版-v5.apk
echo     传到手机，允许「未知来源」即可安装
echo     包名与社区版不同，需先卸载社区版
echo ==========================================================
goto :eof

:fail
echo.
echo  看「最短路径-拿APK.md」的『环境要求』一节，或用 GitHub Actions 云端出包。
pause
exit /b 1
