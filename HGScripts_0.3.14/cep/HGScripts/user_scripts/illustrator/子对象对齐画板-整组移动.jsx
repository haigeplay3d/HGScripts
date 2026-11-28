#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGBasisAlignArtboardPick

// 2026-11-10: 6 个「手选基准对齐画板-*」入口合并为 1 个图标选择入口。
// 两层各自独立：auto/cpp 时由 AIP 弹它自己的图标小窗；AIP 不在时回落本脚本
// 的 ScriptUI 图标小窗。参数不跨层，删掉任一层另一层仍能完成全部 6 种对齐。
// 16:44 修复：short 是 ES3 保留字，作属性名会让 ExtendScript 在解析阶段直接报
// 「非法使用保留字」，整脚本一行都不执行（AIP 与 JSX 两层都无弹窗）。已改名 shortLabel。
// 17:10 修复：iconbutton 的 style:"button" 会画出圆形凸起边框，改成 toolbutton（无边框）。

(function () {
    var CPP_COMMAND = "HGBasisAlignArtboardPick";
    var ENTRY_VERSION = "2026-11-10-icon-picker-es3fix";

    var MODES = [
        { key: "left",    label: "左对齐",   shortLabel: "左",     icon: "align-pick-left.png" },
        { key: "hcenter", label: "水平居中", shortLabel: "水平中", icon: "align-pick-hcenter.png" },
        { key: "right",   label: "右对齐",   shortLabel: "右",     icon: "align-pick-right.png" },
        { key: "top",     label: "顶部对齐", shortLabel: "顶",     icon: "align-pick-top.png" },
        { key: "vcenter", label: "垂直居中", shortLabel: "垂直中", icon: "align-pick-vcenter.png" },
        { key: "bottom",  label: "底部对齐", shortLabel: "底",     icon: "align-pick-bottom.png" }
    ];

    // 桥接库缺失或加载失败时仍走 JSX 自己的小窗（C11：删掉 AIP 层也能独立跑）。
    var bridge = null;
    try {
        HGColorTools_load();
        bridge = $.global.HGColorTools;
    } catch (bridgeError) {
        bridge = null;
    }

    // 1. 先校验单选；不满足时静默返回，连窗口都不创建。
    if (!hasSingleSelection()) {
        return;
    }

    // 2. auto/cpp: 静默交给 AIP，由 AIP 弹它自己的图标小窗。
    //    C10: executeMenuCommand 是延迟执行，成功后必须立即返回，不再读写文档/选区。
    if (bridge && typeof bridge.tryCppCommand === "function" &&
        bridge.tryCppCommand(CPP_COMMAND)) {
        return;
    }

    // 3. AIP 不在（或 jsx 模式）：JSX 自己的图标小窗。
    var mode = showIconPicker();
    if (!mode) {
        return;
    }

    // 4. 用公共核心独立完成对齐，与 AIP 无关。
    var coreFile = new File(new File($.fileName).parent.fsName +
        "/../../assets/jsx/illustrator_lib/HGBasisArtboardAlignCore.jsx");
    if (!coreFile.exists) {
        return;
    }

    try {
        $.evalFile(coreFile);
        var core = $.global.HGBasisArtboardAlignCore;
        if (core && typeof core.run === "function") {
            core.run(mode);
        }
    } catch (coreError) {
        // 静默：不弹成功/失败反馈窗（A14 / F3）。
    }

    // 加载统一深色主题库（与 AIP 原生窗口 HGUITheme.h 同一套配色）。缺失时静默降级。
    function HGUILoadTheme() {
        try {
            if ($.global.HGScriptUITheme) return $.global.HGScriptUITheme;
            var root = new File($.fileName).parent;
            $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGScriptUITheme.jsx"));
            return $.global.HGScriptUITheme;
        } catch (e) { return null; }
    }

    function hasSingleSelection() {
        try {
            if (!app.documents.length) return false;
            var doc = app.activeDocument;
            return doc.selection && doc.selection.length === 1;
        } catch (e) {
            return false;
        }
    }

    function iconRoot() {
        return new File($.fileName).parent.fsName + "/../../assets/icons";
    }

    function showIconPicker() {
        try {
            return buildPicker(true);
        } catch (iconError) {
            // ScriptUI iconbutton / PNG 不被宿主支持时降级为文字按钮，
            // 6 种功能一个不少（C11: JSX 上限低可降级体验）。
            try {
                return buildPicker(false);
            } catch (textError) {
                return null;
            }
        }
    }

    function buildPicker(useIcons) {
        var picked = null;
        var dlg = new Window("dialog", "对齐画板");
        dlg.orientation = "column";
        dlg.alignChildren = "center";
        dlg.spacing = 6;
        dlg.margins = 12;

        function makePick(key) {
            return function () {
                picked = key;
                dlg.close();
            };
        }

        function addRow(parent, title, list, withIcons) {
            parent.add("statictext", undefined, title);
            var row = parent.add("group");
            row.orientation = "row";
            row.spacing = 6;
            for (var i = 0; i < list.length; i++) {
                var m = list[i];
                var btn;
                if (withIcons) {
                    var iconFile = new File(iconRoot() + "/" + m.icon);
                    if (!iconFile.exists) throw new Error("missing icon: " + m.icon);
                    // 17:10 修复：style:"button" 会给每个图标画一圈凸起的圆形边框；
                    // "toolbutton" 是 ScriptUI 官方的 flat / 无边框样式。
                    // 若宿主不接受该样式，让它抛错走下面的文字按钮降级，绝不退回圆形边框。
                    btn = row.add("iconbutton", undefined, iconFile, { style: "toolbutton" });
                } else {
                    btn = row.add("button", undefined, m.shortLabel);
                }
                try { btn.helpTip = m.label; } catch (tipError) {}
                btn.onClick = makePick(m.key);
            }
        }

        dlg.add("statictext", undefined, "已选 1 个基准对象 · 移动父级");
        addRow(dlg, "水平", MODES.slice(0, 3), useIcons);
        addRow(dlg, "垂直", MODES.slice(3, 6), useIcons);
        dlg.add("statictext", undefined, "点一下图标立即执行 · 关闭窗口取消");

        var hgTheme = HGUILoadTheme();
        if (hgTheme) hgTheme.apply(dlg);
        dlg.show();
        return picked;
    }

    function HGColorTools_load() {
        var root = new File($.fileName).parent;
        $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    }
})();
