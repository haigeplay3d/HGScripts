#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGCleanUselessEmptyObjects

(function () {


    if (!app.documents.length) {
        return;
    }

    if (tryRunCppPlugin()) {
        return;
    }

    var deleted = cleanDocument(app.activeDocument);

    function tryRunCppPlugin() {
        var mode = getHGScriptsCppMode();
        if (mode === "jsx") {
            return false;
        }

        try {
            app.executeMenuCommand("HGCleanUselessEmptyObjects");
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

    function cleanDocument(doc) {
        var total = 0;
        total += deleteCandidates(collectLeafCandidates(doc.pageItems));

        var changed = true;
        while (changed) {
            var groups = collectGroupCandidates(doc.pageItems);
            changed = groups.length > 0;
            total += deleteCandidates(groups);
        }

        return total;
    }

    function collectLeafCandidates(items) {
        var candidates = [];
        var seen = {};
        collectLeaves(items, candidates, seen);
        candidates.sort(compareDepthDesc);
        return candidates;
    }

    function collectLeaves(items, candidates, seen) {
        if (!items) return;

        for (var i = items.length - 1; i >= 0; i--) {
            var item = null;
            try {
                item = items[i];
            } catch (e0) {
                continue;
            }

            if (!item || shouldSkip(item)) continue;

            if (item.typename === "GroupItem") {
                collectLeaves(item.pageItems, candidates, seen);
                continue;
            }

            if (item.typename === "CompoundPathItem") {
                if (isUselessCompoundPath(item)) {
                    pushUnique(item, candidates, seen);
                }
                continue;
            }

            if (item.typename === "PathItem" && isUselessPath(item) && !hasParentType(item, "CompoundPathItem")) {
                pushUnique(item, candidates, seen);
                continue;
            }

            if (item.typename === "TextFrame" && isEmptyTextFrame(item)) {
                pushUnique(item, candidates, seen);
            }
        }
    }

    function collectGroupCandidates(items) {
        var candidates = [];
        var seen = {};
        collectGroups(items, candidates, seen);
        candidates.sort(compareDepthDesc);
        return candidates;
    }

    function collectGroups(items, candidates, seen) {
        if (!items) return;

        for (var i = items.length - 1; i >= 0; i--) {
            var item = null;
            try {
                item = items[i];
            } catch (e0) {
                continue;
            }

            if (!item || shouldSkip(item)) continue;

            if (item.typename === "GroupItem") {
                collectGroups(item.pageItems, candidates, seen);
                if (isEmptyGroup(item) || isClippedGroupOnlyUselessMaskResidue(item)) {
                    pushUnique(item, candidates, seen);
                }
            }
        }
    }

    function deleteCandidates(candidates) {
        var deleted = 0;
        for (var i = 0; i < candidates.length; i++) {
            var item = candidates[i];
            try {
                var type = item.typename;
                item.remove();
                deleted++;
            } catch (e) {
            }
        }
        return deleted;
    }

    function shouldSkip(item) {
        try {
            if (!item || item.locked || item.hidden) return true;
            if (item.layer && (item.layer.locked || !item.layer.visible)) return true;
            if (item.typename === "PlacedItem" ||
                item.typename === "RasterItem" ||
                item.typename === "SymbolItem" ||
                item.typename === "GraphItem" ||
                item.typename === "MeshItem") {
                return true;
            }

            var parent = item.parent;
            while (parent && parent !== app && parent.typename !== "Document") {
                if (parent.locked === true || parent.hidden === true) return true;
                if (parent.typename === "Layer" && (parent.locked || !parent.visible)) return true;
                parent = parent.parent;
            }

            return false;
        } catch (e) {
            return true;
        }
    }

    function isUselessPath(item) {
        try {
            return item.typename === "PathItem" &&
                item.filled === false &&
                item.stroked === false &&
                item.clipping !== true &&
                item.guides !== true;
        } catch (e) {
            return false;
        }
    }

    function isEmptyTextFrame(item) {
        try {
            return item.typename === "TextFrame" &&
                String(item.contents || "").replace(/\s/g, "") === "";
        } catch (e) {
            return false;
        }
    }

    function isUselessCompoundPath(item) {
        try {
            if (!item.pathItems || item.pathItems.length === 0) return true;
            for (var i = 0; i < item.pathItems.length; i++) {
                if (!isUselessPath(item.pathItems[i])) return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function isEmptyGroup(item) {
        try {
            return item.typename === "GroupItem" && item.pageItems.length === 0;
        } catch (e) {
            return false;
        }
    }

    function isClippedGroupOnlyUselessMaskResidue(item) {
        try {
            if (item.typename !== "GroupItem" || item.clipped !== true || item.pageItems.length === 0) {
                return false;
            }
            for (var i = 0; i < item.pageItems.length; i++) {
                if (!isUselessMaskResidue(item.pageItems[i])) return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function isUselessMaskResidue(item) {
        try {
            if (!item || shouldSkip(item)) return false;
            if (item.typename === "PathItem") {
                return item.filled === false &&
                    item.stroked === false &&
                    item.guides !== true &&
                    item.clipping === true;
            }
            if (item.typename === "CompoundPathItem") {
                return item.pathItems.length === 0 || isUselessCompoundPathIgnoringClip(item);
            }
            if (item.typename === "GroupItem") {
                if (item.pageItems.length === 0) return true;
                for (var i = 0; i < item.pageItems.length; i++) {
                    if (!isUselessMaskResidue(item.pageItems[i])) return false;
                }
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function isUselessCompoundPathIgnoringClip(item) {
        try {
            if (!item.pathItems || item.pathItems.length === 0) return true;
            for (var i = 0; i < item.pathItems.length; i++) {
                var path = item.pathItems[i];
                if (path.filled !== false || path.stroked !== false || path.guides === true) return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function hasParentType(item, typename) {
        try {
            var parent = item.parent;
            while (parent && parent !== app && parent.typename !== "Document") {
                if (parent.typename === typename) return true;
                parent = parent.parent;
            }
        } catch (e) {}
        return false;
    }

    function compareDepthDesc(a, b) {
        return getDepth(b) - getDepth(a);
    }

    function getDepth(item) {
        var depth = 0;
        try {
            var parent = item.parent;
            while (parent && parent !== app && parent.typename !== "Document") {
                depth++;
                parent = parent.parent;
            }
        } catch (e) {}
        return depth;
    }

    function pushUnique(item, list, seen) {
        var key = getItemKey(item);
        if (seen[key]) return;
        seen[key] = true;
        list.push(item);
    }

    function getItemKey(item) {
        try {
            if (item.uuid) return item.uuid;
        } catch (e1) {}

        try {
            return item.typename + "|" + getDepth(item) + "|" + item.name + "|" + item.geometricBounds.join(",");
        } catch (e2) {
            return String(item);
        }
    }

})();

