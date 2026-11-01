#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGSelectNoPaintObjectsNoSave

(function () {

    if (!app.documents.length) {
        return;
    }


    if (tryRunCppPlugin()) {
        return;
    }

    runJsxFallback();

    function tryRunCppPlugin() {
        var command = "HGSelectNoPaintObjectsNoSave";
        var mode = getHGScriptsCppMode();

        if (mode === "jsx") {
            return false;
        }

        try {
            app.executeMenuCommand(command);
            return true;
        } catch (err) {
        }

        return false;
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

    function runJsxFallback() {
        var doc = app.activeDocument;
        var emptyPaths = [];

        collectEmptyPaths(doc.pageItems, emptyPaths);
        clearSelection(doc);

        if (emptyPaths.length) {
            selectItems(doc, emptyPaths);
        }

    }

    function collectEmptyPaths(items, result) {
        if (!items) {
            return;
        }

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (shouldSkip(item)) {
                continue;
            }

            if (item.typename === "GroupItem") {
                collectEmptyPaths(item.pageItems, result);
            } else if (item.typename === "CompoundPathItem") {
                collectEmptyPaths(item.pathItems, result);
                if (isEmptyCompoundPath(item)) {
                    result.push(item);
                }
            } else if (item.typename === "PathItem" && isEmptyPath(item)) {
                result.push(item);
            }
        }
    }

    function shouldSkip(item) {
        try {
            if (!item || item.locked || item.hidden) {
                return true;
            }

            if (item.layer && (item.layer.locked || !item.layer.visible)) {
                return true;
            }

            var parent = item.parent;
            while (parent && parent !== app && parent.typename !== "Document") {
                if ((parent.locked === true) || (parent.hidden === true)) {
                    return true;
                }
                if (parent.typename === "Layer" && (parent.locked || !parent.visible)) {
                    return true;
                }
                parent = parent.parent;
            }

            return false;
        } catch (e) {
            return true;
        }
    }

    function isEmptyPath(item) {
        try {
            return item.filled === false && item.stroked === false;
        } catch (e) {
            return false;
        }
    }

    function isEmptyCompoundPath(item) {
        try {
            if (!item.pathItems || item.pathItems.length === 0) {
                return false;
            }

            for (var i = 0; i < item.pathItems.length; i++) {
                if (!isEmptyPath(item.pathItems[i])) {
                    return false;
                }
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    function clearSelection(targetDoc) {
        try {
            targetDoc.selection = null;
        } catch (e) {
        }
    }

    function selectItems(targetDoc, items) {
        try {
            targetDoc.selection = items;
        } catch (e) {
            selectItemsOneByOne(items);
        }
    }

    function selectItemsOneByOne(items) {
        for (var i = 0; i < items.length; i++) {
            try {
                items[i].selected = true;
            } catch (e) {
            }
        }
    }

})();

