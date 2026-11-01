#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGSameBW

(function () {
    HGColorTools_load();
    var HGColorTools = $.global.HGColorTools;
    if (!app.documents.length) return;
    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) return;
    if (HGColorTools.tryCppCommand("HGSameBW")) return;

    var sampleKey = HGColorTools.getSingleColorSampleKey(HGColorTools.findFirstPaintSignature(doc.selection[0]));
    if (!sampleKey) {
        return;
    }
    HGColorTools.applySameMask(doc, sampleKey, HGColorTools.makeRGB(0, 0, 0), HGColorTools.makeRGB(255, 255, 255));
})();

function HGColorTools_load() {
    var root = new File($.fileName).parent;
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorText.jsx"));
    $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGColorCore.jsx"));
}


