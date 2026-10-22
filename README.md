# HGScripts

当前版本：**v0.3.7** · 2026-10-23

一个面向 Adobe 用户的脚本管理面板，用来集中管理、搜索、收藏、查看说明、编辑和运行脚本。当前以 Illustrator 为主，同时保留 Photoshop / InDesign 的基础支持。

## 下载与安装

Windows 用户先保存工作并关闭 Adobe 软件，再下载并运行：

- [安装 HGScripts v0.3.7](HGScripts_0.3.7/安装-海哥的Adobe脚本管理器v0.3.7.exe?raw=1)
- [安装帮助](HGScripts_0.3.7/docs/install_windows.md)
- [独立卸载器](HGScripts_0.3.7/卸载-海哥的Adobe脚本管理器.exe?raw=1)
- [安装包 SHA256 校验值](HGScripts_0.3.7/SHA256SUMS.txt)

安装后重新打开 Illustrator，在「窗口 > 扩展」中打开「海哥的Adobe脚本管理器」。

## v0.3.7 更新

- **修复运行报错**：修复运行脚本后统计行的 `formatElapsed is not defined` 报错，运行记录与耗时统计恢复正常。
- **界面缩放**：设置页可选 100%–200% 界面缩放，立即生效并自动保存，高分辨率屏幕文字偏小时可调大。
- **中文输入法恢复**：安装器不再按系统缩放写入 `--force-device-scale-factor`（旧写法导致旧版 CEF 中文输入法无法上屏），固定为 `1`，配合界面缩放使用。

查看 [完整更新日志](HGScripts_0.3.7/CHANGELOG.md) 和 [本版说明](HGScripts_0.3.7/docs/release_notes_0.3.7.md)。

## 兼容与使用

本版面向 Windows。Illustrator 2023–2026 提供各年份匹配的统一 AIP 加速插件；Illustrator 2021 保留有限 CEP / JSX 支持，不提供 AIP。Illustrator 2020 不在兼容目标内，macOS 暂不支持。

纸杯工具当前为 JSX，真实宿主验收覆盖 Illustrator 2026。它生成杯身展开图，不含卷口、杯底和封底工艺余量；打印时使用 100% / 实际大小，先打样核对。

## 源码与反馈

本版公开内容在 [HGScripts_0.3.7](HGScripts_0.3.7/)：包含面板、JSX、用户说明及编译好的 AIP，不包含 C++ 源码、Adobe SDK、VS 工程、调试符号或本机运行数据。旧版本目录仅供历史参考。

作者：[@haigeplay3d](https://github.com/haigeplay3d)。反馈时请提供 Adobe 版本、操作步骤和错误现象。
