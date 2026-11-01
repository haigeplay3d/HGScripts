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

    var matchedColor = HGColorTools.pickCustomColor();
    if (!matchedColor) {
        HGColorTools.restoreSelection(doc, originalSelection);
        return;
    }
    var otherColor = HGColorTools.pickCustomColor();
    if (!otherColor) {
        HGColorTools.restoreSelection(doc, originalSelection);
        return;
    }
    HGColorTools.restoreSelection(doc, originalSelection);

    var stats = HGColorTools.makeColorStats();
    for (var i = 0; i < doc.pageItems.length; i++) {
        HGColorTools.applyMatchedColor(doc.pageItems[i], sampleKey, matchedColor, otherColor, stats);
    }
})();

function HGColorTools_load() {
    var root = new File($.fileName).parent;
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorText.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorCore.jsx"));
}
