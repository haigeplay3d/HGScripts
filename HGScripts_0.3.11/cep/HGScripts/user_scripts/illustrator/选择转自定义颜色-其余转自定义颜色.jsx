#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGSelectionCustomOthersCustom

// 把选中的对象改成第一个自定义颜色，把活动画板内其余对象改成第二个自定义颜色。
// 优先走 C++ 加速；插件不在或调用失败自动退回纯 JSX。

(function () {
    HGColorTools_load();
    var HGColorTools = $.global.HGColorTools;
    if (!app.documents.length) return;
    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) return;
    if (HGColorTools.tryCppCommand("HGSelectionCustomOthersCustom")) return;

    HGColorTools.setStatusHint("正在选择选中对象要转成的颜色", "info");
    var selectedColor = HGColorTools.pickCustomColor();
    if (!selectedColor) {
        HGColorTools.setStatusHint("", "info");
        return;
    }

    HGColorTools.setStatusHint("正在选择其余对象要转成的颜色", "info");
    var otherColor = HGColorTools.pickCustomColor();
    if (!otherColor) {
        HGColorTools.setStatusHint("", "info");
        return;
    }

    HGColorTools.setStatusHint("", "info");
    HGColorTools.applySelectionMask(doc, selectedColor, otherColor);
})();

function HGColorTools_load() {
    var root = new File($.fileName).parent;
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorText.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorCore.jsx"));
}
