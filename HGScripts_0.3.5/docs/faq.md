# FAQ

## 添加桌面脚本后，为什么其它脚本也出现了？

HGScripts 添加的是脚本目录，不是单个脚本文件。如果选择桌面上的一个 `.jsx`，实际添加的是桌面目录。

扫描深度含义：

- `0`：仅当前目录。
- `1`：当前目录 + 1 层子目录。

如果只想扫描桌面这一层，把扫描深度设为 `0`。

## AI2023 报 `.aip` 插件问题怎么办？

先关闭 Illustrator，删除旧的：

```text
C:\Program Files\Adobe\Adobe Illustrator 2023\Plug-ins\HGScripts
```

再安装 HGScripts v0.3.5，并勾选 Windows Illustrator C++ 加速插件。v0.3.5 已按 2023、2024、2025、2026 分别打包对应 `.aip`。
