# Illustrator 加速插件安装说明

这个文件夹里放的是 HGScripts 给 Illustrator 用的加速插件。

```text
plugins/illustrator-win
├─ 2023
├─ 2024
├─ 2025
└─ 2026
```

当前每个 Illustrator 年份只包含一个统一 AIP：

```text
HGScriptsNative.aip
```

`HGScriptsNative.aip` 内部注册多条 C++ 命令，包括颜色、尺寸、基准缩放/对齐、清理空对象，以及原独立插件提供的 `HGSelectNoPaintObjectsNoSave`。每个年份文件夹里都有一套对应 Illustrator 版本编译的 `.aip`。不要手动把 2026 文件夹里的 `.aip` 复制给 2023/2024/2025 使用。

Illustrator 2021 不包含 HGScripts `.aip` 加速插件；2021 只使用 CEP 面板和普通 JSX 脚本。Illustrator 2020 已停止作为兼容目标。

## 推荐安装方法

1. 关闭 Illustrator。
2. 右键 `tools/windows/install_illustrator_plugins.bat`。
3. 选择“以管理员身份运行”。
4. 等待出现 `Installation completed.`。
5. 重新打开 Illustrator。

## 它会做什么

安装脚本会寻找电脑里的 Illustrator，例如：

```text
Adobe Illustrator 2026
Adobe Illustrator 2025
Adobe Illustrator 2024
Adobe Illustrator 2023
```

然后按版本把对应年份文件夹里的加速插件复制到每个 Illustrator 的插件文件夹里。

## 没装会怎样

不安装加速插件也能使用 HGScripts。  
部分脚本会自动走普通 JSX 方式，只是速度可能慢一些。

## 注意

如果你以前手动设置过 Illustrator 的“其它增效工具文件夹”，并且里面也放了同名 `.aip`，测试正式版时请先禁用那条额外路径，避免同一个插件被加载两次。升级到统一 AIP 后，也要移除旧的 `HGSelectNoPaintObjectsNoSave.aip` 或 `HGSelectionManager.aip` 副本，避免旧命令重复加载。
