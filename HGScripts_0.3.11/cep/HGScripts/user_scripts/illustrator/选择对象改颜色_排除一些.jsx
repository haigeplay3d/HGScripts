#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGChangeColorExcludeSome

(function () {
    HGColorTools_load();
    var HGColorTools = $.global.HGColorTools;
    if (!app.documents.length) return;
    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) return;
    if (HGColorTools.tryCppCommand("HGChangeColorExcludeSome")) return;

    HGColorTools.setStatusHint("正在选目标颜色", "info");
    var target = HGColorTools.pickCustomColor();
    if (!target) {
        HGColorTools.setStatusHint("", "info");
        return;
    }

    var excludes = [];
    for (;;) {
        HGColorTools.setStatusHint("正在选排除颜色（取消结束）", "info");
        var ex = HGColorTools.pickCustomColor();
        if (!ex) break;
        excludes.push(ex);
    }

    HGColorTools.setStatusHint("", "info");
    var skipFn = excludes.length > 0 ? HGColorTools.makeExcludeColorsFn(excludes) : null;
    HGColorTools.applySelectedToColor(doc, target, "v1-change-color-exclude-some", skipFn);
})();

function HGColorTools_load() {
    var root = new File($.fileName).parent;
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorText.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorCore.jsx"));
}