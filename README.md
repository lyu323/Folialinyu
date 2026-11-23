# Folia 定制版 · 版本仓库

基于 [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major) 的社区 Android 移植定制版，**仅限个人学习与非营利测试**（上游 AGPL-3.0）。

## 版本迭代

| 版本 | 版本文件 | APK | 说明 |
| --- | --- | --- | --- |
| v5 | `folia-project.zip`（仓库根目录，原样保留） | `apk/Folia定制版-v5.apk` | 液态玻璃主题、7 套配色、3D/液态启动页、流畅度专项、备份恢复、悬浮球 |
| **v6** | **本仓库根目录完整源码树** / `versions/v6/Folia-v6-完整工程.zip` | `apk/Folia定制版-v6.apk` | 星云启动页、主题预设收藏夹、五组细腻调节、流光强调色、静谧模式、自适应降级 |

> **原版本不删除**：v5 的工程包、APK、构建诊断全部保留在根目录与 `versions/v5/`。v6 是增量叠加，v5 的所有源码文件与能力都还在。

## 当前版本（v6）

- 版本：`0.7.29-custom.6` / `versionCode 536`
- 包名：`top.folia.custom`（与社区版不同，安装前需卸载社区版）
- 架构：arm64-v8a，Android 7.0+
- 启动页三态：星云（默认）/ 液态玻璃 / 3D 晶体
- 入口：左下角可拖动 ✦ 徽标 → 点击开 v6 设置面板，长按快速切静谧模式

## 自动出包

push 到 `main` 即触发 `.github/workflows/build-custom-apk.yml`：云端装 JDK 21 / Android SDK 36 / NDK 28.2 / Node 24，编译签名 Release APK，自动回推到 `apk/` 并上传 Artifact。

## 目录

- `src/` `android/` `package.json` … v6 完整源码
- `apk/` 编译产物（v5 + v6）
- `versions/v5/` v5 归档与说明
- `versions/v6/` v6 工程包快照与更新日志
- `.github/workflows/` 自动编译流水线

音乐内容版权归各平台所有，请通过官方渠道支持正版。

## 源码树说明

`versions/v6/Folia-v6-完整工程.zip` 是 v6 完整源码包。push 触发编译后，云端 runner 会把它展开并**把完整源码树回推到本仓库根目录**，所以编译完成后的仓库根目录即为可直接 `npm ci && npx cap sync android` 的 v6 工程：`src/`、`android/`、`package.json`、`capacitor.config.json` 等一应俱全。

v5 的 `folia-project.zip` 与 `apk/Folia定制版-v5.apk` 在整个过程中**不会被删除或覆盖**。
