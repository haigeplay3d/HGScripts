# HGScripts

当前版本：**v0.3.6** · 2026-10-22

一个面向 Adobe 用户的脚本管理面板，用来集中管理、搜索、收藏、查看说明、编辑和运行脚本。当前以 Illustrator 为主，同时保留 Photoshop / InDesign 的基础支持。

## 下载与安装

Windows 用户先保存工作并关闭 Adobe 软件，再下载并运行：

- [安装 HGScripts v0.3.6](HGScripts_0.3.6/安装-海哥的Adobe脚本管理器v0.3.6.exe?raw=1)
- [安装帮助](HGScripts_0.3.6/docs/install_windows.md)
- [独立卸载器](HGScripts_0.3.6/卸载-海哥的Adobe脚本管理器.exe?raw=1)
- [安装包 SHA256 校验值](HGScripts_0.3.6/SHA256SUMS.txt)

安装后重新打开 Illustrator，在「窗口 > 扩展」中打开「海哥的Adobe脚本管理器」。

## v0.3.6 更新

- **选择对象黑白互换**：交换选中对象已有填充、描边的精确纯黑与纯白，灰色和彩色保持原样。
- **纸杯展开**：输入上下口直径，以及实际高度 H 或斜坡长度 S，生成可编辑纸样；支持预览、搭接、出血、等份辅助线、尺寸标注和独立图案区域。
- **拼音 / 首字母搜索**：例如输入 `zbzk`，即可找到“纸杯展开”。

查看 [完整更新日志](HGScripts_0.3.6/CHANGELOG.md)、[本版说明](HGScripts_0.3.6/docs/release_notes_0.3.6.md) 和 [新功能上手](HGScripts_0.3.6/docs/whats_new_0.3.6.md)。

## 兼容与使用

本版面向 Windows。Illustrator 2023–2026 提供各年份匹配的统一 AIP 加速插件；Illustrator 2021 保留有限 CEP / JSX 支持，不提供 AIP。Illustrator 2020 不在兼容目标内，macOS 暂不支持。

纸杯工具当前为 JSX，真实宿主验收覆盖 Illustrator 2026。它生成杯身展开图，不含卷口、杯底和封底工艺余量；打印时使用 100% / 实际大小，先打样核对。

## 源码与反馈

本版公开内容在 [HGScripts_0.3.6](HGScripts_0.3.6/)：包含面板、JSX、用户说明及编译好的 AIP，不包含 C++ 源码、Adobe SDK、VS 工程、调试符号或本机运行数据。旧版本目录仅供历史参考。

作者：[@haigeplay3d](https://github.com/haigeplay3d)。反馈时请提供 Adobe 版本、操作步骤和错误现象。
