# HGScripts 安装帮助

版本：v0.3.4  
更新日期：2026-06-13

## Windows 推荐安装

Windows 用户优先使用同目录里的 EXE 安装包：

```text
安装-海哥的Adobe脚本管理器v0.3.4.exe
```

安装器会安装 CEP 面板、开启 Adobe CEP 支持，并默认安装 Illustrator C++ 加速插件。安装完成后重新打开 Illustrator，在菜单中打开：

```text
窗口 > 扩展 > 海哥的Adobe脚本管理器
```

如果 Windows 弹出安全提醒，是因为当前安装包还没有代码签名。确认安装包来源可靠后，可以继续运行。

Illustrator 2021 可以使用 HGScripts CEP 面板和普通 JSX 脚本；C++ 加速插件目前只提供 Illustrator 2023、2024、2025、2026 的 `.aip`。Illustrator 2020 已停止作为兼容目标。

## Windows 卸载

关闭 Illustrator 后，运行同目录里的卸载工具：

```text
卸载-海哥的Adobe脚本管理器.exe
```

卸载器会删除正式版 CEP 面板目录、安装目录和安装器放入 Illustrator `Plug-ins\HGScripts` 的 HGScripts `.aip` 文件；不会删除 `HGScripts_dev` 或你自己添加的外部脚本目录。

## 放入自己的脚本

HGScripts 按“脚本目录”管理脚本，不需要逐个导入文件。

安装后会自带一个内置脚本目录，Illustrator 版一般在：

```text
%APPDATA%\Adobe\CEP\extensions\HGScripts\user_scripts\illustrator
```

把自己的 `.jsx` / `.js` 脚本放进去，会作为默认脚本显示。

也可以自己新建一个文件夹，例如“我的 AI 脚本”，把零散脚本集中放进去，然后在面板里点“添加目录”选择这个文件夹。添加后会自动加载，不需要手动刷新。

不建议直接选择桌面，最好单独建一个脚本文件夹，这样脚本列表更干净。

## Windows 发布包说明

当前正式版不再提供单独的手动安装包 zip。普通用户只需要使用 EXE 安装器；需要移除时使用同目录的卸载 EXE。

如果你需要查看源码、文档或 `.aip` 成品，请使用 GitHub 导出目录；它不是面向普通用户的一键安装包。GitHub 导出目录中，CEP 面板本体位于 `cep/HGScripts`，Windows Illustrator `.aip` 成品位于 `plugins/illustrator-win`。

## 安装 Illustrator C++ 加速插件

如果你主要用 Illustrator 2023 或更新版本，建议在安装器中保留 C++ 加速插件选项。v0.3.4 已按 Illustrator 2023、2024、2025、2026 分版本打包 `.aip`。Illustrator 2021 不安装 HGScripts `.aip`，会使用普通 JSX 方式运行。

没有安装加速插件时，HGScripts 面板仍然可以使用，带加速标记的脚本会回退到普通 JSX 方式运行。

## 常见问题

### 面板菜单没有出现

1. 重新运行 EXE 安装器，并确认勾选了“开启 Adobe CEP 支持”。
2. 完全关闭并重新打开 Illustrator。
3. 确认 `%APPDATA%\Adobe\CEP\extensions\HGScripts` 内能直接看到 `CSXS`、`assets`、`scripts`、`user_scripts`。

### 加速脚本没有变快

1. 确认安装器中勾选了 C++ 加速插件。
2. 确认安装后重启了 Illustrator。
3. 确认 HGScripts 面板顶部运行模式不是 `JSX`。

### 安装加速插件失败

请右键 EXE 安装器，选择“以管理员身份运行”，并确认安装器中勾选了 C++ 加速插件。

## Mac 说明

当前正式包暂不支持 macOS，不提供 macOS 安装包、手动安装说明或技术支持。
