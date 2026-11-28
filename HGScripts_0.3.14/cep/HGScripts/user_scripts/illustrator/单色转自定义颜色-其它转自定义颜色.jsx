#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGSingleColorCustomOthersCustom

(function () {
    HGColorTools_load();
    var HGColorTools = $.global.HGColorTools;
    if (!app.documents.length) return;
    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) return;
    if (HGColorTools.tryCppCommand("HGSingleColorCustomOthersCustom")) return;

    var sampleKey = HGColorTools.getSingleColorSampleKey(HGColorTools.findFirstPaintSignature(doc.selection[0]));
    if (!sampleKey) {
        return;
    }

    var originalSelection = HGColorTools.copySelection(doc.selection);
    try {
        doc.selection = null;
    } catch (clearSelectionError) {}

    HGColorTools.setStatusHint("正在选择样本颜色", "info");
    var matchedColor = HGColorTools.pickCustomColor();
    if (!matchedColor) {
        HGColorTools.restoreSelection(doc, originalSelection);
        HGColorTools.setStatusHint("", "info");
        return;
    }
    HGColorTools.setStatusHint("正在选择其它颜色", "info");
    var otherColor = HGColorTools.pickCustomColor();
    if (!otherColor) {
        HGColorTools.restoreSelection(doc, originalSelection);
        HGColorTools.setStatusHint("", "info");
        return;
    }
    HGColorTools.restoreSelection(doc, originalSelection);
    HGColorTools.setStatusHint("", "info");

    var stats = HGColorTools.makeColorStats();
    // doc.pageItems is a FLATTENED list (group children included). Walk it once
    // with the non-recursive applier so every object is touched exactly once;
    // compound sub-paths are skipped here because the compound branch of
    // applyMatchedColorFlat recurses into pathItems. (2026-11-14 fix: the old
    // per-item recursive call processed nested objects depth+1 times and later
    // passes stomped matched colours with the "other" colour.)
    for (var i = 0; i < doc.pageItems.length; i++) {
        var pageItem = doc.pageItems[i];
        try {
            if (pageItem.parent && pageItem.parent.typename === "CompoundPathItem") continue;
        } catch (parentError) {}
        HGColorTools.applyMatchedColorFlat(pageItem, sampleKey, matchedColor, otherColor, stats);
    }
    HGColorTools.notifyAppearanceLayerGap(doc.selection, "color");
})();

function HGColorTools_load() {
    var root = new File($.fileName).parent;
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorText.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorCore.jsx"));
}
