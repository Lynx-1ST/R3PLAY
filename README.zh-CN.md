<div align="center">

# R3PLAYX

面向桌面和 Web 的第三方网易云音乐播放器。

[English](README.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-CN.md)

[![Checks](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/check.yml/badge.svg?branch=dev)](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/check.yml)
[![Windows release](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/build.yaml/badge.svg)](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/build.yaml)
![Source version](https://img.shields.io/badge/source_version-2.9.0-2ea44f)
![License](https://img.shields.io/github/license/Lynx-1ST/R3PLAY)

</div>

## 2.9.0 源码版本与设置

当前源码 package 版本为 **2.9.0**。Windows 稳定版使用 `v2.9.0` 等标签；开发预览版使用 `dev-2.9.0rN`，并标记为 prerelease。版本徽章表示源码版本；已发布的安装包与更新说明请查看 [GitHub Releases](https://github.com/Lynx-1ST/R3PLAY/releases)。

- 恢复播放队列、播放位置、音量、随机播放和循环设置；启动后保持暂停。可在 **设置 → 播放器** 中关闭。
- 快速搜索可在输入时显示歌曲；可在 **设置 → 常规** 中开关。方向键选择结果，Enter 播放所选歌曲或打开全部结果。
- 播放列表搜索支持歌曲名、歌手、专辑和忽略重音符号的匹配。
- 使用队列拖动手柄调整顺序，也可聚焦手柄后按上下方向键。
- **设置 → 播放器** 提供音频输出设备和 Discord Rich Presence。Discord 功能默认关闭，需要在同一台电脑运行 Discord；显示歌曲、歌手、封面和播放时间。
- 优化紧凑窗口与迷你播放器布局。已移除桌面歌词，应用内同步歌词保留。

Windows 安装包和应用更新来自 [Lynx-1ST/R3PLAY Releases](https://github.com/Lynx-1ST/R3PLAY/releases/latest)。

## 开发状态

R3PLAYX 仍在积极开发中。本仓库是 [Sherlockouo/music](https://github.com/Sherlockouo/music) 的 fork，基于 YesPlayMusic 生态。更新可直接覆盖安装，无需卸载或删除数据；如果旧版本仍在后台运行，请先退出应用。遇到问题可在本仓库提交 issue。

## ✨ 特性

- ✅ 使用 React + Electron 开发
- 🔴 网易云账号登录（扫码/手机/邮箱登录）
- 📺 支持 MV 播放
- 🚫🤝 无任何社交功能
- 📖 支持歌词展示
- 🎨 新增全局背景
- 🎵 支持更多音源
- 🐳 支持 docker 部署
- 🔊 支持私人 FM
- 🔧 更多特性，期待你的建议和加入

## 📦️ 安装

访问本项目的 [Releases](https://github.com/Lynx-1ST/R3PLAY/releases/latest)
页面下载安装包。

对于 NixOS 上的安装，请参考 [EndCredits/R3PLAYX-nix](https://github.com/EndCredits/R3PLAYX-nix)

## 📜 开源许可

API 源代码来自 [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)

本项目仅供个人学习研究之目的，不得用于任何商业或非法活动。

基于 [AGPL license](https://opensource.org/licenses/AGPL) 许可进行开源。

任何基于此项目开发的项目都必须遵守开源协议，在项目 README/应用内的关于页面和介绍网站中明确说明基于此项目开发，并附上此项目 GitHub 页面的链接。

## 截图

以下截图来自上游项目，可能与当前版本不同。

- 主页
  <img width="1548" alt="image" src="https://github.com/Sherlockouo/music/assets/34598208/a58b5c05-ce35-4f32-8b07-fb94df94fc62">
- 发现
  <img width="1548" alt="image" src="https://github.com/Sherlockouo/music/assets/34598208/4f8c3168-ac8a-476a-8db2-2aede6e85534">
- 新增歌词展示功能
  ![lyrics-screenshot](https://github.com/Sherlockouo/music/assets/34598208/82123958-db58-4026-ab4d-19f7c8e26495)
- 新增音源，全局背景
  ![background](https://github.com/Sherlockouo/music/assets/34598208/87bbca8f-705a-4925-9ac7-7444ab11f0c0)
- ~~新增歌词特效~~ 由于性能问题被干掉了

如果你遇到了任何问题，我会尽力帮助你解决。以下是一些常见问题的解决方案：

1. **无法登录网易云账号**：请确保你的账号和密码输入正确，如果是扫码登录，请扫描二维码并在手机上确认登录。

2. **如何播放MV**：在播放器界面的右下角有一个 "MV" 按钮，点击它即可打开 MV 播放器。

3. **找不到歌词**：在播放器界面的右上角有一个 "歌词" 按钮，点击它即可显示当前歌曲的歌词。如果歌曲没有歌词信息，可能是因为该歌曲没有提供歌词。

4. **如何更改全局背景**：你可以在设置中选择一个背景图像作为全局背景。在播放器界面的右上角有一个 "设置" 按钮，点击它并在 "主题" 选项卡中选择一个背景图像。

如果你的问题不在上述范围内，请提供更多详细信息，我会尽力提供帮助。同时，你也可以加入我们的开发讨论群组，与其他开发者一起讨论问题和分享经验。

希望以上解决方案对你有帮助！如果你还有其他问题，随时提问。

## 赞赏(这将被用于为开发者充能，进行更加激情的创造)

![赞赏](https://github.com/Sherlockouo/music/assets/34598208/54d3d073-341b-4977-a3a8-a1afd85fe3d2)
<p align="center">
   <h2> 免责声明 Disclaimer </h2>
  <divider/>

- 本代码库仅供个人用于在线学习和研究使用，不得用于商业用途。
- 除了许可条款中规定的事项外，您还知道将本代码库用于商业或其他竞争行为可能会产生法律风险。
- 如果您认为本代码库侵犯了您的知识产权，请发布 PR, Issue 或 DMCA 请求，表达您删除相关引擎或代码的意图。
</p>

## Star History

<a href="https://star-history.com/#Sherlockouo/music&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Sherlockouo/music&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Sherlockouo/music&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Sherlockouo/music&type=Date" />
  </picture>
</a>

## Credit

Designed by [JACKCRING](https://jackcring.com)
