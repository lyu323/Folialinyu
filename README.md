# Folia 定制版 · 版本仓库

基于 [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major) 的社区 Android 移植定制版，**仅限个人学习与非营利测试**（上游 AGPL-3.0）。

## 版本迭代

| 版本 | 版本文件 | APK | 说明 |
| --- | --- | --- | --- |
| v5 | `folia-project.zip`（根目录，原样保留） | `apk/Folia定制版-v5.apk` | 液态玻璃主题、7 套配色、3D/液态启动页、流畅度专项、备份恢复、悬浮球 |
| v6 | `versions/v6/Folia-v6-完整工程.zip` | `apk/Folia定制版-v6.apk` | 星云启动页、主题预设收藏夹、五组细腻调节、流光强调色、静谧模式、自适应降级 |
| **v7** | **根目录完整源码树** / `versions/v7/Folia-v7-完整工程.zip` | `apk/Folia定制版-v7.apk` | 晨雾玻璃 UI、主题化弹窗、检测更新、更新日志 |

> **原版本不删除**：v5 的工程包、APK、构建诊断，v6 的工程包与 APK 全部保留在根目录、`apk/` 与 `versions/`。每个新版本都是增量叠加，旧源码文件与能力仍在。

## 当前版本（v7 · 晨雾玻璃）

- 版本：`0.7.29-custom.7` / `versionCode 537`
- 包名：`top.folia.custom`（与社区版不同，安装前需卸载社区版）
- 架构：arm64-v8a，Android 7.0+
- 启动页三态：星云（默认）/ 液态玻璃 / 3D 晶体
- 入口：左下角可拖动 ✦ 徽标 → 设置面板含「v7 晨雾 UI / 检测更新 / 更新日志 / 关于」

### v7 重点
- **按参考图重做空状态页**：修复 v5 只认「还没有连接在线平台」导致「还没有导入本地音乐」仍是黑底灰字；改为悬浮玻璃栏、胶囊标签、居中音符图标、高对比文字、双主操作按钮
- **弹窗主题化**：白色系统 alert → 与 7 套主题 / 流光强调色同步的玻璃卡片；修正硬编码旧版本号
- **检测更新**：直连 GitHub Releases latest，启动静默检查 + 手动检查，可一键下载；失败可打开 Releases 页
- **更新日志**：内置 v1–v7 全量记录 + 远端 Release 说明

## 自动出包

push 到 `main` 即触发 `.github/workflows/build-custom-apk.yml`：云端展开 v7 工程包、装 JDK 21 / Android SDK 36 / NDK 28.2 / Node 24，编译签名 Release APK，自动回推到 `apk/`、回推完整源码树到根目录并上传 Artifact。

## 目录

- `src/` `android/` `package.json` … v7 完整源码
- `apk/` 编译产物（v5 / v6 / v7）
- `versions/` 各版本工程包、更新日志与归档说明
- `CHANGELOG.md` 更新日志
- `.github/workflows/` 自动编译流水线

音乐内容版权归各平台所有，请通过官方渠道支持正版。
