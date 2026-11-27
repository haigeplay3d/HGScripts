# HGScripts

当前版本：**v0.3.13** · 2026-11-27

一个面向 Adobe 用户的脚本管理面板，用来集中管理、搜索、收藏、查看说明、编辑和运行脚本。当前以 Illustrator 为主，同时保留 Photoshop / InDesign 的基础支持。

最新版收录 **34 个脚本**（Illustrator 26 / Photoshop 7 / InDesign 1）。下方按用途配有统一图标和简要说明，方便在安装前快速找到需要的工具。

## 下载与安装

### [下载 HGScripts v0.3.13 Windows 安装器](https://github.com/haigeplay3d/HGScripts/releases/download/v0.3.13/HGScripts-v0.3.13-Setup.exe)

**只需下载这一个 `Setup.exe` 文件，无需下载整个仓库。** 安装器已包含所需的面板、脚本和插件文件。

1. 保存工作，并关闭正在运行的 Adobe 软件。
2. 点击上方链接，下载并运行 `HGScripts-v0.3.13-Setup.exe`，按提示完成安装。
3. 重新打开 Illustrator，在「窗口 > 扩展」中打开「海哥的Adobe脚本管理器」。

需要卸载时，再次运行同一个 `Setup.exe`，点击底部「卸载 HGScripts」；也可以通过 Windows「设置 > 应用 > 安装的应用」卸载。

[精简安装说明](https://github.com/haigeplay3d/HGScripts/releases/download/v0.3.13/HGScripts-v0.3.13-Install-Notes.txt) · [详细安装／卸载说明](HGScripts_0.3.13/docs/install_windows.md) · [SHA256 校验值](https://github.com/haigeplay3d/HGScripts/releases/download/v0.3.13/SHA256SUMS.txt) · [查看发布说明](https://github.com/haigeplay3d/HGScripts/releases/tag/v0.3.13)

## Illustrator 脚本目录

下方只列出 v0.3.13 收录的脚本。点击脚本名或「脚本」可查看对应 JSX；有详细说明的脚本可继续查看操作条件和注意事项。批量改色、自动清理类工具会直接修改文档，重要文件建议先保存副本。

### 颜色转换与遮罩

#### <img src="assets/script-icons/black-white-swap.png" width="32" height="32" alt=""> 选择对象黑白互换.jsx

**纯黑与纯白互换**

将选中对象已有的纯黑填充、描边与纯白互换，灰色和彩色保持原样，不会新增填充或描边。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择对象黑白互换.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择对象黑白互换.md)

---

#### <img src="assets/script-icons/selected-custom-color.png" width="32" height="32" alt=""> 选择对象转自定义颜色.jsx

**选中对象自定义改色**

通过拾色器选择新颜色，替换当前选中对象已有的填充和描边；取消拾色器不会改色。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择对象转自定义颜色.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择对象转自定义颜色.md)

---

#### <img src="assets/script-icons/select-same-strict.png" width="32" height="32" alt=""> 选择同色对象-严格版.jsx

**严格匹配填充、描边和颜色**

以首个选中对象为样本，选中填充与描边的有无状态、颜色都完全相同的对象；只改变选择，不改色。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择同色对象-严格版.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择同色对象-严格版.md)

---

#### <img src="assets/script-icons/select-same-loose.png" width="32" height="32" alt=""> 选择同色对象-宽松版.jsx

**按宽松单色规则选择**

以首个选中对象为样本，按更宽松的单色规则选择对象；单色样本不强制填充对填充、描边对描边。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择同色对象-宽松版.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择同色对象-宽松版.md)

---

#### <img src="assets/script-icons/round-size-up.png" width="32" height="32" alt=""> 尺寸无小数.jsx

**宽高小数向上取整**

将选中对象带小数的宽或高去掉小数后加一，原本为整数的维度不变，默认保持对象中心。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/尺寸无小数.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/尺寸无小数.md)

---

#### <img src="assets/script-icons/record-position.png" width="32" height="32" alt=""> 记录对象中心相对画板位置.jsx

**记录对象在画板中的相对位置**

记录选中对象或整体选区的几何中心相对所在画板的位置，供“应用位置”脚本重复使用。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/记录对象中心相对画板位置.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/记录对象中心相对画板位置.md)

---

#### <img src="assets/script-icons/apply-position.png" width="32" height="32" alt=""> 应用对象中心相对画板位置.jsx

**应用已记录的画板相对位置**

将当前选中对象或整体选区移动到已记录的画板相对位置，多选时保持对象之间的相对关系。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/应用对象中心相对画板位置.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/应用对象中心相对画板位置.md)

---

#### <img src="assets/script-icons/selection-frame.png" width="32" height="32" alt=""> 为选择对象创建外框.jsx

**创建选中对象的外接矩形**

按选中对象的可见范围创建无填充、白色描边的外框并选中它，原对象保留。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/为选择对象创建外框.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/为选择对象创建外框.md)

---

#### <img src="assets/script-icons/white-overlay.png" width="32" height="32" alt=""> 选择对象上方创建白色矩形.jsx

**在选中对象上方覆盖白色矩形**

在首个选中对象的原位置创建同尺寸、白色无描边矩形并置于其上方，原对象保留。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/选择对象上方创建白色矩形.jsx)

---

#### <img src="assets/script-icons/black-background.png" width="32" height="32" alt=""> 当前画板创建黑色背景矩形.jsx

**创建画板大小的黑色背景**

在当前画板创建等大的黑色无描边矩形并放到底层；重复运行会新增背景，不会替换已有背景。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/当前画板创建黑色背景矩形.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/当前画板创建黑色背景矩形.md)

---

#### <img src="assets/script-icons/paper-cup.png" width="32" height="32" alt=""> 纸杯展开.jsx

**生成可编辑的纸杯杯身展开图**

根据上下口直径和实际高度 H 或斜坡长度 S 生成杯身轮廓，支持搭接、出血、辅助线和尺寸标注。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/纸杯展开.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/纸杯展开.md)

---

#### <img src="assets/script-icons/upca-barcode.png" width="32" height="32" alt=""> 生成UPC-A条形码.jsx

**生成可编辑的矢量 UPC-A 条形码**

在当前画板中心生成矢量条码，支持输入 11 位数字自动计算校验位，或输入 12 位数字生成。

[脚本](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/生成UPC-A条形码.jsx) · [详细说明](HGScripts_0.3.13/cep/HGScripts/user_scripts/illustrator/生成UPC-A条形码.md)

## v0.3.13 更新

- Illustrator「HG Tools」菜单精简：移除 15 个过时命令（长边设为 1024、噪声生成器、染白/染黑等黑白遮罩命令、被六合一取代的旧对齐命令、清理空对象），菜单项现在与正式脚本一一对应。
- 开发中功能（按颜色/按对象导出 mask、选择管理器）移到「HG Tools Dev」菜单，正式安装包不再包含这些入口。
- 插件重编时自动核对菜单命令与正式脚本是否对应，多旧项或少入口都会当场报错。

查看 [完整更新日志](HGScripts_0.3.13/CHANGELOG.md) 和 [本版说明](HGScripts_0.3.13/docs/release_notes_0.3.13.md)。

## v0.3.12 更新

- 新增 Illustrator 2027 支持：面板按宿主主版本正确识别 2027，安装器装入单独用 2027 SDK 编译的插件，同时保留 2023–2026。
- 安装器「安装位置明细」补上 Illustrator 2027。
- 面板记住上次查看的收藏或默认目录，关闭重开不再跳回旧目录。
- JSX 模式跑 8 个颜色类脚本遇到组级外观层颜色时明确提示能力边界，不再静默给出改不全的结果。
- 插件版坐标转换器补齐 Tab / Shift+Tab 键盘切换与首尾回绕；「自定义计算」分别记住每个输入框最后输入的值。
- 发布流程新增跨渠道机器自检；英文界面补齐顶部按钮、目录弹窗、默认目录和脚本名称的翻译。

查看 [完整更新日志](HGScripts_0.3.13/CHANGELOG.md)。

## v0.3.8 更新

- **修复运行报错**：修复运行脚本后统计行的 `formatElapsed is not defined` 报错，运行记录与耗时统计恢复正常。
- **界面缩放**：设置页可选 100%–200% 界面缩放，立即生效并自动保存，高分辨率屏幕文字偏小时可调大。
- **中文输入法恢复**：安装器不再按系统缩放写入 `--force-device-scale-factor`，固定为 `1`，配合界面缩放使用。

查看 [完整更新日志](HGScripts_0.3.13/CHANGELOG.md) 和 [本版说明](HGScripts_0.3.13/docs/release_notes_0.3.13.md)。

## 兼容与使用

本版面向 Windows。Illustrator 2023–2027 提供各年份匹配的统一 AIP 加速插件；Illustrator 2021 保留有限 CEP / JSX 支持，不提供 AIP。Illustrator 2020 不在兼容目标内，macOS 暂不支持。

纸杯工具当前为 JSX，真实宿主验收覆盖 Illustrator 2026。它生成杯身展开图，不含卷口、杯底和封底工艺余量；打印时使用 100% / 实际大小，先打样核对。

## 源码与图标维护

本版公开内容在 [HGScripts_0.3.13](HGScripts_0.3.13/)：包含面板、JSX、用户说明及编译好的 AIP，不包含 C++ 源码、Adobe SDK、VS 工程、调试符号或本机运行数据。

README 图标由 [build_script_icons.py](tools/build_script_icons.py) 使用同一套 64×64 几何图元生成，产物位于 `assets/script-icons`。新增或调整脚本后运行以下命令，可重新生成 SVG、透明 PNG、总预览和清单，并自动核对脚本目录是否完整：

```powershell
python tools/build_script_icons.py
```

## 反馈

作者：[@haigeplay3d](https://github.com/haigeplay3d)。反馈时请提供 Adobe 版本、操作步骤和错误现象。
