#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGSizeNoDecimal

(function () {
    var FINAL_EPSILON = 0.0001;
    var INTEGER_TAIL_EPSILON = 0.01;


    if (!app.documents.length) {
        return;
    }

    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) {
        return;
    }

    if (tryRunCppPlugin()) {
        return;
    }

    var changed = resizeSelection(doc.selection);

    function tryRunCppPlugin() {
        var mode = getHGScriptsCppMode();
        if (mode === "jsx") {
            return false;
        }

        try {
            app.executeMenuCommand("HGSizeNoDecimal");
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

    function resizeSelection(selection) {
        var changed = 0;
        var seen = {};

        for (var i = 0; i < selection.length; i++) {
            var item = null;
            try {
                item = selection[i];
            } catch (e0) {
                continue;
            }

            if (!item || shouldSkip(item)) continue;

            var key = getItemKey(item);
            if (seen[key]) continue;
            seen[key] = true;

            if (resizeOne(item)) {
                changed++;
            }
        }

        return changed;
    }

    function resizeOne(item) {
        var size = getPanelSize(item);
        var bounds = getBounds(item);
        if (!size || !bounds) return false;

        var width = size.width;
        var height = size.height;
        if (!(width > FINAL_EPSILON) || !(height > FINAL_EPSILON)) {
            return false;
        }

        var targetWidth = getNoDecimalTarget(width);
        var targetHeight = getNoDecimalTarget(height);
        if (nearlyEqual(targetWidth, width, FINAL_EPSILON) && nearlyEqual(targetHeight, height, FINAL_EPSILON)) {
            return false;
        }

        var center = {
            x: (bounds.left + bounds.right) / 2,
            y: (bounds.top + bounds.bottom) / 2
        };

        for (var pass = 0; pass < 3; pass++) {
            size = getPanelSize(item);
            if (!size) return false;

            width = size.width;
            height = size.height;
            if (nearlyEqual(targetWidth, width, FINAL_EPSILON) && nearlyEqual(targetHeight, height, FINAL_EPSILON)) {
                break;
            }

            if (!setPanelSize(item, targetWidth, targetHeight)) {
                return false;
            }

            moveCenterTo(item, center.x, center.y);
        }

        return true;
    }

    function getPanelSize(item) {
        try {
            return {
                width: Number(item.width),
                height: Number(item.height)
            };
        } catch (e) {
            var bounds = getBounds(item);
            if (!bounds) return null;
            return {
                width: bounds.right - bounds.left,
                height: bounds.top - bounds.bottom
            };
        }
    }

    function setPanelSize(item, targetWidth, targetHeight) {
        try {
            item.width = targetWidth;
            item.height = targetHeight;
            return true;
        } catch (e1) {
            try {
                var size = getPanelSize(item);
                if (!size || !(size.width > FINAL_EPSILON) || !(size.height > FINAL_EPSILON)) return false;
                var scaleX = (targetWidth / size.width) * 100;
                var scaleY = (targetHeight / size.height) * 100;
                var lineScale = Math.sqrt(Math.abs((targetWidth / size.width) * (targetHeight / size.height))) * 100;
                item.resize(
                    scaleX,
                    scaleY,
                    true,
                    true,
                    true,
                    true,
                    lineScale,
                    Transformation.CENTER
                );
                return true;
            } catch (e2) {
                return false;
            }
        }
    }

    function getNoDecimalTarget(value) {
        var rounded = Math.round(value);
        if (Math.abs(value - rounded) <= INTEGER_TAIL_EPSILON) {
            return rounded;
        }
        return Math.floor(value) + 1;
    }

    function moveCenterTo(item, x, y) {
        var bounds = getBounds(item);
        if (!bounds) return;

        var centerX = (bounds.left + bounds.right) / 2;
        var centerY = (bounds.top + bounds.bottom) / 2;
        try {
            item.translate(x - centerX, y - centerY);
        } catch (e) {
        }
    }

    function getBounds(item) {
        try {
            var b = usePreviewBounds() ? item.visibleBounds : item.geometricBounds;
            return {
                left: Number(b[0]),
                top: Number(b[1]),
                right: Number(b[2]),
                bottom: Number(b[3])
            };
        } catch (e) {
            return null;
        }
    }

    function usePreviewBounds() {
        try {
            return app.preferences.getBooleanPreference("includeStrokeInBounds") === true;
        } catch (e) {
            return false;
        }
    }

    function shouldSkip(item) {
        try {
            if (!item || item.locked || item.hidden || item.guides) return true;
            if (item.layer && (item.layer.locked || !item.layer.visible)) return true;

            var parent = item.parent;
            while (parent && parent !== app && parent.typename !== "Document") {
                if (parent.locked === true || parent.hidden === true) return true;
                if (parent.typename === "Layer" && (parent.locked || !parent.visible)) return true;
                parent = parent.parent;
            }
        } catch (e) {
            return true;
        }
        return false;
    }

    function nearlyEqual(a, b, tolerance) {
        return Math.abs(a - b) <= tolerance;
    }

    function getItemType(item) {
        try {
            return item.typename || "Unknown";
        } catch (e) {
            return "Unknown";
        }
    }

    function getItemKey(item) {
        try {
            if (item.uuid) return item.uuid;
        } catch (e1) {}

        try {
            return getItemType(item) + "|" + item.name + "|" + getBoundsArray(item).join(",");
        } catch (e2) {
            return String(item);
        }
    }

    function getBoundsArray(item) {
        try {
            return usePreviewBounds() ? item.visibleBounds : item.geometricBounds;
        } catch (e) {
            return item.visibleBounds;
        }
    }

})();

