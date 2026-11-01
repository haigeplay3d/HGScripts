#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGSelectedBlackWhiteSwap

// Only existing solid process-color endpoints are swapped. The native plug-in
// command is preferred when it is available; the JSX logic below stays as the
// fallback for hosts without the plug-in and for JSX-only mode.
(function () {
    var seenIds = {};
    var seenRefs = [];
    var stats = { status: "starting", paths: 0, characters: 0, fills: 0, strokes: 0,
        skippedItems: 0, skippedPaint: 0, errors: 0, lastError: "none" };

    try {
        run();
    } catch (error) {
        recordError("run", error);
        stats.status = "failed";
    } finally {
        writeHiddenLog();
    }

    function run() {
        if (!app.documents.length) {
            stats.status = "no_document";
            return;
        }
        var selection = app.activeDocument.selection;
        // Text-edit selections are ranges, not selected artwork objects.
        if (selection && selection.typename === "TextRange") {
            stats.status = "text_edit_selection_skipped";
            return;
        }
        if (!selection || !selection.length) {
            stats.status = "no_selection";
            return;
        }
        if (runCppAccelerated()) {
            stats.status = "completed_cpp";
            return;
        }
        var roots = [];
        var i;
        for (i = 0; i < selection.length; i++) roots.push(selection[i]);
        for (i = 0; i < roots.length; i++) visit(roots[i]);
        stats.status = stats.errors ? "completed_with_errors" : "completed";
    }

    function unavailable(item) {
        try {
            var current = item;
            while (current && current.typename !== "Document" && current.typename !== "Application") {
                if (current.locked || current.hidden || current.editable === false) return true;
                if (current.typename === "Layer" && current.visible === false) return true;
                current = current.parent;
            }
            return !item;
        } catch (error) {
            recordError("availability", error);
            return true;
        }
    }

    function alreadyVisited(item) {
        // PageItem.uuid is stable even when the host returns another wrapper.
        try {
            var id = item.uuid;
            if (id) {
                var key = "item_" + id;
                if (seenIds[key]) return true;
                seenIds[key] = true;
                return false;
            }
        } catch (ignoredUuid) {}
        for (var i = 0; i < seenRefs.length; i++) {
            if (seenRefs[i] === item) return true;
        }
        seenRefs.push(item);
        return false;
    }

    function visit(item) {
        if (unavailable(item)) {
            stats.skippedItems++;
            return;
        }
        try {
            if (item.typename === "PathItem") {
                if (item.guides || item.clipping) {
                    stats.skippedItems++;
                    return;
                }
                // A directly selected subpath still shares its compound's paint.
                if (item.parent && item.parent.typename === "CompoundPathItem") {
                    visit(item.parent);
                    return;
                }
            }
            if (alreadyVisited(item)) return;
            switch (item.typename) {
                case "GroupItem":
                    for (var i = 0; i < item.pageItems.length; i++) visit(item.pageItems[i]);
                    break;
                case "CompoundPathItem":
                    swapCompound(item);
                    break;
                case "PathItem":
                    swapPath(item);
                    break;
                case "TextFrame":
                    swapText(item);
                    break;
                default:
                    stats.skippedItems++;
                    break;
            }
        } catch (error) {
            recordError("visit", error);
        }
    }

    function swapCompound(item) {
        // Capture every original paint before writing. This handles both shared
        // compound styles and native DOM compounds with independent subpath paint.
        var pending = [];
        var i;
        for (i = 0; i < item.pathItems.length; i++) swapPath(item.pathItems[i], pending);
        for (i = 0; i < pending.length; i++) {
            var change = pending[i];
            writePaint(change.owner, change.property, change.counter, change.color);
        }
    }

    function swapPath(item, pending) {
        if (unavailable(item) || item.guides || item.clipping) {
            stats.skippedItems++;
            return;
        }
        stats.paths++;
        if (item.filled) swapPaint(item, "fillColor", "fills", pending);
        if (item.stroked) swapPaint(item, "strokeColor", "strokes", pending);
    }

    function swapText(frame) {
        var chars = frame.textRange.characters;
        for (var i = 0; i < chars.length; i++) {
            try {
                var attrs = chars[i].characterAttributes;
                stats.characters++;
                swapPaint(attrs, "fillColor", "fills");
                // Changing the color must never turn a zero-width text stroke on.
                if (attrs.strokeWeight > 0) swapPaint(attrs, "strokeColor", "strokes");
            } catch (error) {
                recordError("text_character", error);
            }
        }
    }

    function swapPaint(owner, property, counter, pending) {
        try {
            var next = oppositeEndpoint(owner[property]);
            if (next) {
                if (pending) {
                    pending.push({ owner: owner, property: property, counter: counter, color: next });
                } else {
                    writePaint(owner, property, counter, next);
                }
            } else {
                stats.skippedPaint++;
            }
        } catch (error) {
            recordError(property, error);
        }
    }

    function writePaint(owner, property, counter, color) {
        try {
            owner[property] = color;
            stats[counter]++;
        } catch (error) {
            recordError(property, error);
        }
    }

    function oppositeEndpoint(color) {
        if (!color) return null;
        var next;
        var value;
        switch (color.typename) {
            case "RGBColor":
                if (color.red === 0 && color.green === 0 && color.blue === 0) {
                    value = 255;
                } else if (color.red === 255 && color.green === 255 && color.blue === 255) {
                    value = 0;
                } else {
                    return null;
                }
                next = new RGBColor();
                next.red = value;
                next.green = value;
                next.blue = value;
                return next;
            case "CMYKColor":
                if (color.cyan !== 0 || color.magenta !== 0 || color.yellow !== 0 ||
                    (color.black !== 0 && color.black !== 100)) return null;
                next = new CMYKColor();
                next.cyan = 0;
                next.magenta = 0;
                next.yellow = 0;
                next.black = 100 - color.black;
                return next;
            case "GrayColor":
                if (color.gray !== 0 && color.gray !== 100) return null;
                next = new GrayColor();
                next.gray = 100 - color.gray;
                return next;
            default:
                // Never edit shared Gradient, Spot or Pattern definitions.
                return null;
        }
    }

    function runCppAccelerated() {
        try {
            HGColorTools_load();
            var bridge = $.global.HGColorTools;
            if (!bridge || typeof bridge.tryCppCommand !== "function") return false;
            return bridge.tryCppCommand("HGSelectedBlackWhiteSwap") === true;
        } catch (cppError) {
            // A missing or misbehaving plug-in must never block the JSX fallback.
            return false;
        }
    }

    function HGColorTools_load() {
        var root = new File($.fileName).parent;
        $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    }

    function recordError(stage, error) {
        stats.errors++;
        stats.lastError = stage;
        if (error && typeof error.number === "number") stats.lastError += ":code=" + error.number;
        if (error && typeof error.line === "number") stats.lastError += ":line=" + error.line;
    }

    function writeHiddenLog() {
        var file = null;
        try {
            var root = new Folder(Folder.userData.fsName + "/HGScripts");
            if (!root.exists && !root.create()) return;
            var folder = new Folder(root.fsName + "/logs");
            if (!folder.exists && !folder.create()) return;
            file = new File(folder.fsName + "/selected_black_white_swap.log");
            file.encoding = "UTF-8";
            // A last-run summary avoids retaining document data or growing logs.
            if (!file.open("w")) return;
            file.writeln(new Date().toString() + " revision=1 status=" + stats.status +
                " paths=" + stats.paths + " characters=" + stats.characters +
                " fills=" + stats.fills + " strokes=" + stats.strokes +
                " skippedItems=" + stats.skippedItems + " skippedPaint=" + stats.skippedPaint +
                " errors=" + stats.errors + " lastError=" + stats.lastError);
        } catch (ignoredLogError) {
        } finally {
            try { if (file) file.close(); } catch (ignoredCloseError) {}
        }
    }
})();
