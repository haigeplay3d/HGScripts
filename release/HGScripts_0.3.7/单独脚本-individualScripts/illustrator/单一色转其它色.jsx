#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGSingleColorToCustomColor

(function () {
    HGColorTools_load();
    var HGColorTools = $.global.HGColorTools;
    if (!app.documents.length) return;
    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) return;
    if (HGColorTools.tryCppCommand("HGSingleColorToCustomColor")) return;

    var sampleKey = HGColorTools.getSingleColorSampleKey(HGColorTools.findFirstPaintSignature(doc.selection[0]));
    if (!sampleKey) {
        return;
    }
    var color = HGColorTools.pickCustomColor();
    if (!color) {
        return;
    }
    var matches = [];
    HGColorTools.collectSingleColorMatches(doc.pageItems, sampleKey, matches, {}, {});
    var stats = HGColorTools.makeColorStats();
    for (var i = 0; i < matches.length; i++) {
        HGColorTools.applyColor(matches[i], color, stats);
    }
})();

function HGColorTools_load() {
    var root = new File($.fileName).parent;
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorText.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorCore.jsx"));
}


