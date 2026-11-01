#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGLongEdge1024

(function () {
    if (!app.documents.length) return;
    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) return;
    if (getHGScriptsCppMode() === "jsx") return;

    try {
        app.executeMenuCommand("HGLongEdge1024");
    } catch (e) {}

    function getHGScriptsCppMode() {
        try {
            if ($.global && typeof $.global.HGSCRIPTS_CPP_MODE !== "undefined") {
                var globalMode = String($.global.HGSCRIPTS_CPP_MODE).toLowerCase();
                if (globalMode === "cpp" || globalMode === "jsx") return globalMode;
            }
            if (typeof HGSCRIPTS_CPP_MODE !== "undefined") {
                var mode = String(HGSCRIPTS_CPP_MODE).toLowerCase();
                if (mode === "cpp" || mode === "jsx") return mode;
            }
        } catch (e) {}
        return "auto";
    }
})();
