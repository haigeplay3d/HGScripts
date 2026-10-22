# Mac 安装说明（未测试）

版本：v0.3.5
更新日期：2026-06-13

## 重要说明

我目前没有 Mac 设备，所以这套安装方法还没有实机验证。

HGScripts 是 CEP 面板，理论上可以在 macOS 的 Illustrator 中手动安装。当前正式发布不再提供手动安装包 zip，也不包含 `.command` 自动安装脚本。

macOS 只支持 CEP 面板和普通 JSX 脚本。Windows Illustrator C++ 加速插件（`.aip`）只适用于 Windows，不支持 macOS。

## 准备文件

请从 GitHub 导出目录或源码发布目录中找到 `cep/HGScripts` 文件夹。

这个 `HGScripts` 文件夹就是 CEP 面板本体，里面应能看到 `CSXS`、`assets`、`scripts`、`user_scripts` 和 `index.html`。

## 复制 HGScripts 面板

打开 Finder，按：

```text
Command + Shift + G
```

输入：

```text
~/Library/Application Support/Adobe/CEP/extensions
```

如果没有 `CEP` 或 `extensions` 文件夹，可以手动新建。

把 `cep` 目录里的 `HGScripts` 文件夹复制到：

```text
~/Library/Application Support/Adobe/CEP/extensions
```

最终应类似：

```text
~/Library/Application Support/Adobe/CEP/extensions/HGScripts/CSXS/manifest.xml
```

## 开启 CEP 未签名扩展

因为这是未签名 CEP 扩展，需要开启 `PlayerDebugMode`。

打开“终端”，执行：

```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
defaults write com.adobe.CSXS.13 PlayerDebugMode 1
defaults write com.adobe.CSXS.14 PlayerDebugMode 1
defaults write com.adobe.CSXS.15 PlayerDebugMode 1
```

通常只需要当前 Adobe 版本对应的 CSXS 版本；如果不确定，可以都执行。

## 打开插件

完全退出并重新打开 Illustrator。

然后在菜单中打开：

```text
窗口 > 扩展 > 海哥的Adobe脚本管理器
```

英文界面一般是：

```text
Window > Extensions > 海哥的Adobe脚本管理器
```

## 脚本目录

插件自带脚本按宿主分开放置：

```text
HGScripts/user_scripts/illustrator
HGScripts/user_scripts/photoshop
HGScripts/user_scripts/indesign
```

你自己的 `.jsx` 或 `.js` 脚本也可以放到对应目录，或在面板里点“添加目录”选择自己的脚本文件夹。添加后会自动加载，不需要手动刷新。

## 关于 C++ 加速插件

GitHub 导出目录中的 `plugins/illustrator-win` 目录只适用于 Windows。

macOS 用户请忽略：

```text
plugins/illustrator-win
tools/windows/install_illustrator_plugins.bat
```

在 macOS 上请使用普通 JSX 模式。

## 如果菜单没有出现

可以检查：

1. 插件是否放到了 `~/Library/Application Support/Adobe/CEP/extensions/HGScripts`。
2. `HGScripts` 文件夹内是否能直接看到 `CSXS/manifest.xml`。
3. 是否执行了 `defaults write ... PlayerDebugMode 1`。
4. 是否完全退出并重新打开 Illustrator。
5. 当前 Adobe 版本是否还支持 CEP 扩展。

## 反馈方式

- Email: haigeplay3d@gmail.com
- WeChat: haigeplay3d
- GitHub: https://github.com/haigeplay3d/HGScripts

如果你测试成功或失败，都欢迎反馈具体系统版本、Adobe 软件版本和现象。
