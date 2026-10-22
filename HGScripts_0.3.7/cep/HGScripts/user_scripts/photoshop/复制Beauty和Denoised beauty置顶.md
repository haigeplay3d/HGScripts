# 复制Beauty和Denoised beauty置顶.jsx 说明

## 脚本用途

在 Photoshop 当前文档中复制 `Beauty` 和 `Denoised beauty` 两个图层，并把复制出来的图层放到文档最顶部。

## 效果

- 查找名为 `Beauty` 的图层，复制为 `Beauty copy`。
- 查找名为 `Denoised beauty` 的图层，复制为 `Denoised beauty copy`。
- 两个复制图层都会移动到图层栈最顶部。
- `Denoised beauty copy` 会在最顶层，`Beauty copy` 在它下面。
- 运行结束后会选中 `Denoised beauty copy`。

## 使用流程

1. 在 Photoshop 中打开 C4D / Octane 输出的 PSD。
2. 确认文档里有名为 `Beauty` 和 `Denoised beauty` 的图层。
3. 在 HGScripts 面板中运行 `复制Beauty和Denoised beauty置顶.jsx`。

## 注意事项

- 脚本按精确图层名查找，大小写和空格都要一致。
- `Beauty` 如果是 Photoshop 背景层，脚本会通过 `backgroundLayer` 兼容查找，不需要你先手动解锁。
- 如果当前 PSD 把 Beauty pass 本地化成 `背景` / `Background` / `图层 0` / `Layer 0`，脚本会把这个底层图层当作 `Beauty` 来源。
- 如果同名图层存在多个，脚本优先使用图层栈更靠底部的那个，避免误用顶部已生成的副本。
- 当前正式路径已关闭详细 trace，只保留错误和慢运行日志。
- 没有打开文档时会静默跳过。
- 运行错误或单次耗时超过阈值时会写入本机隐藏日志：`%APPDATA%\HGScripts\logs\photoshop\复制Beauty和Denoised beauty置顶.log`。
