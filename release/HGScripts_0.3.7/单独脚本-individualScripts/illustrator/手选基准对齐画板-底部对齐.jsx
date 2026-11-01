#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGBasisAlignArtboardBottom

(function () {
    var ENTRY_MODE = "bottom";
    var ENTRY_CPP_COMMAND = "HGBasisAlignArtboardBottom";
    var ENTRY_VERSION = "2026-05-15-1750-cpp";

    var coreFile = new File(new File($.fileName).parent.fsName + "/../../assets/jsx/illustrator_lib/HGBasisArtboardAlignCore.jsx");
    var selectionSnapshot = captureSelection();

    if (tryRunCppPlugin(ENTRY_CPP_COMMAND)) {
        restoreSelection(selectionSnapshot);
        return;
    }

    if (!coreFile.exists) {
        return;
    }

    try {
        $.evalFile(coreFile);
        $.global.HGBasisArtboardAlignCore.run(ENTRY_MODE);
    } catch (e) {
    }

    function captureSelection() {
        try {
            if (!app.documents.length) return null;
            var doc = app.activeDocument;
            var items = [];
            if (doc.selection) {
                for (var i = 0; i < doc.selection.length; i++) {
                    items.push(doc.selection[i]);
                }
            }
            return { doc: doc, items: items };
        } catch (e) {
            return null;
        }
    }

    function restoreSelection(snapshot) {
        try {
            if (!snapshot || !snapshot.doc || !snapshot.items || snapshot.items.length === 0) return false;
            snapshot.doc.selection = null;
            snapshot.doc.selection = snapshot.items;
            try {
                app.redraw();
            } catch (redrawError) {}
            return true;
        } catch (arraySelectError) {
            try {
                snapshot.doc.selection = null;
                for (var i = 0; i < snapshot.items.length; i++) {
                    snapshot.items[i].selected = true;
                }
                return true;
            } catch (flagSelectError) {
                return false;
            }
        }
    }

    function tryRunCppPlugin(command) {
        var mode = getHGScriptsCppMode();
        if (mode === "jsx") {
            return false;
        }

        try {
            app.executeMenuCommand(command);
            return true;
        } catch (e) {
            return false;
        }
    }

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


