#target photoshop

(function () {
    var SCRIPT_NAME = "复制Beauty和Denoised beauty置顶";
    var BEAUTY_NAME = "Beauty";
    var DENOISED_NAME = "Denoised beauty";
    var BEAUTY_FALLBACK_NAMES = {
        "背景": true,
        "Background": true,
        "图层 0": true,
        "Layer 0": true
    };
    var SLOW_THRESHOLD_MS = 900;
    var TRACE_LOG = false;
    var MAX_TREE_LOG_LINES = 120;

    function pad2(value) {
        return value < 10 ? "0" + value : String(value);
    }

    function formatDate(date) {
        return date.getFullYear() + "-" +
            pad2(date.getMonth() + 1) + "-" +
            pad2(date.getDate()) + " " +
            pad2(date.getHours()) + ":" +
            pad2(date.getMinutes()) + ":" +
            pad2(date.getSeconds());
    }

    function writeLog(message) {
        try {
            var root = new Folder(Folder.userData.fsName + "/HGScripts/logs/photoshop");
            if (!root.exists) {
                root.create();
            }
            var file = new File(root.fsName + "/" + SCRIPT_NAME + ".log");
            file.encoding = "UTF-8";
            if (file.open("a")) {
                file.writeln("[" + formatDate(new Date()) + "] " + message);
                file.close();
            }
        } catch (ignore) {
        }
    }

    function trace(message) {
        if (TRACE_LOG) {
            writeLog("[trace] " + message);
        }
    }

    function safeName(layer) {
        try {
            return layer.name;
        } catch (err) {
            return "<name error: " + err + ">";
        }
    }

    function nameInfo(name) {
        var text = String(name);
        var codes = [];

        for (var i = 0; i < text.length; i++) {
            codes.push(text.charCodeAt(i));
        }

        return "\"" + text + "\" len=" + text.length + " codes=[" + codes.join(",") + "]";
    }

    function describeLayer(layer) {
        if (!layer) {
            return "<null>";
        }

        var parts = [];
        parts.push("name=" + nameInfo(safeName(layer)));

        try {
            parts.push("typename=" + layer.typename);
        } catch (ignoreType) {
        }

        try {
            parts.push("kind=" + layer.kind);
        } catch (ignoreKind) {
        }

        try {
            parts.push("allLocked=" + layer.allLocked);
        } catch (ignoreLocked) {
        }

        try {
            parts.push("visible=" + layer.visible);
        } catch (ignoreVisible) {
        }

        return parts.join(", ");
    }

    function logLayerTree(container, prefix, state) {
        if (!TRACE_LOG || state.count >= MAX_TREE_LOG_LINES) {
            return;
        }

        var layers = null;
        try {
            layers = container.layers;
        } catch (errLayers) {
            trace(prefix + " layers access failed: " + errLayers);
            return;
        }

        trace(prefix + " layerCount=" + layers.length);

        for (var i = 0; i < layers.length; i++) {
            if (state.count >= MAX_TREE_LOG_LINES) {
                trace("Layer tree log truncated at " + MAX_TREE_LOG_LINES + " entries.");
                return;
            }

            var layer = layers[i];
            trace(prefix + "[" + i + "] " + describeLayer(layer));
            state.count++;

            try {
                if (layer.typename === "LayerSet") {
                    logLayerTree(layer, prefix + "[" + i + "]", state);
                }
            } catch (ignoreLayerSet) {
            }
        }
    }

    function getBackgroundLayer(doc) {
        try {
            var background = doc.backgroundLayer;
            trace("backgroundLayer access ok: " + describeLayer(background));
            return background;
        } catch (err) {
            trace("backgroundLayer access failed: " + err);
        }

        return null;
    }

    function findBackgroundLayerByName(doc, layerName) {
        var background = getBackgroundLayer(doc);
        trace("Compare background with target " + nameInfo(layerName) + ": " +
            (background ? nameInfo(safeName(background)) : "<none>"));
        if (background && background.name === layerName) {
            trace("Matched backgroundLayer for " + layerName + ".");
            return background;
        }

        return null;
    }

    function findTopLevelArtLayerByName(doc, layerName) {
        try {
            var artLayer = doc.artLayers.getByName(layerName);
            trace("artLayers.getByName matched " + layerName + ": " + describeLayer(artLayer));
            return artLayer;
        } catch (err) {
            trace("artLayers.getByName failed for " + layerName + ": " + err);
        }

        return null;
    }

    function isBeautyFallbackName(name) {
        return !!BEAUTY_FALLBACK_NAMES[String(name)];
    }

    function getBottomLayer(doc) {
        try {
            if (doc.layers.length) {
                return doc.layers[doc.layers.length - 1];
            }
        } catch (err) {
            trace("Bottom layer lookup failed: " + err);
        }

        return null;
    }

    function findBeautyFallbackLayer(doc) {
        var background = getBackgroundLayer(doc);
        var backgroundName = background ? safeName(background) : "";

        if (background && isBeautyFallbackName(backgroundName)) {
            trace("Beauty fallback matched background layer: " + describeLayer(background));
            return background;
        }

        var bottom = getBottomLayer(doc);
        var bottomName = bottom ? safeName(bottom) : "";

        if (bottom && isBeautyFallbackName(bottomName)) {
            trace("Beauty fallback matched bottom layer: " + describeLayer(bottom));
            return bottom;
        }

        trace("Beauty fallback not matched. background=" +
            (background ? nameInfo(backgroundName) : "<none>") +
            ", bottom=" + (bottom ? nameInfo(bottomName) : "<none>"));
        return null;
    }

    function findLayerByName(container, layerName) {
        trace("findLayerByName start: target=" + nameInfo(layerName) +
            ", containerType=" + (container.typename || "<unknown>"));

        if (container.typename === "Document") {
            var background = findBackgroundLayerByName(container, layerName);
            if (background) {
                return background;
            }

            var topLevelArtLayer = findTopLevelArtLayerByName(container, layerName);
            if (topLevelArtLayer) {
                return topLevelArtLayer;
            }
        }

        for (var i = container.layers.length - 1; i >= 0; i--) {
            var layer = container.layers[i];
            trace("Scan layer index=" + i + ": " + describeLayer(layer));

            if (layer.name === layerName) {
                trace("Matched ordinary layer for " + layerName + " at index " + i + ".");
                return layer;
            }

            if (layer.typename === "LayerSet") {
                var found = findLayerByName(layer, layerName);
                if (found) {
                    return found;
                }
            }
        }

        if (container.typename === "Document" && layerName === BEAUTY_NAME) {
            return findBeautyFallbackLayer(container);
        }

        return null;
    }

    function setLayerName(layer, name) {
        try {
            trace("Rename duplicate to " + nameInfo(name) + ". Before: " + describeLayer(layer));
            layer.name = name;
            trace("Rename duplicate ok. After: " + describeLayer(layer));
        } catch (err) {
            writeLog("Rename duplicate failed: " + name + ", " + err);
        }
    }

    function moveToDocumentTop(doc, layer) {
        trace("Move to document top start: " + describeLayer(layer));
        if (!doc.layers.length || doc.layers[0] === layer) {
            trace("Move skipped: layer already top or document has no ordinary layers.");
            return;
        }

        layer.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
        trace("Move to document top ok: " + describeLayer(layer));
    }

    function duplicateLayerToTop(doc, sourceName, copyName) {
        trace("Duplicate start: source=" + nameInfo(sourceName) + ", copy=" + nameInfo(copyName));
        var source = findLayerByName(doc, sourceName);
        if (!source) {
            trace("Duplicate aborted: source not found for " + nameInfo(sourceName));
            throw new Error("找不到图层: " + sourceName);
        }

        trace("Source found: " + describeLayer(source));
        var copy = source.duplicate();
        trace("Duplicate ok: " + describeLayer(copy));
        setLayerName(copy, copyName);
        moveToDocumentTop(doc, copy);
        return copy;
    }

    function run() {
        if (!app.documents.length) {
            return;
        }

        var doc = app.activeDocument;
        var startedAt = new Date().getTime();
        var runId = startedAt + "-" + Math.floor(Math.random() * 100000);
        var denoisedCopy = null;

        trace("========== run start " + runId + " ==========");
        trace("Targets: beauty=" + nameInfo(BEAUTY_NAME) +
            ", denoised=" + nameInfo(DENOISED_NAME));

        try {
            trace("Document: name=" + nameInfo(doc.name) +
                ", mode=" + doc.mode +
                ", topLayerCount=" + doc.layers.length +
                ", artLayerCount=" + doc.artLayers.length +
                ", layerSetCount=" + doc.layerSets.length);
        } catch (docInfoErr) {
            trace("Document info failed: " + docInfoErr);
        }

        try {
            logLayerTree(doc, "doc", { count: 0 });
        } catch (treeErr) {
            trace("Layer tree log failed: " + treeErr);
        }

        try {
            duplicateLayerToTop(doc, BEAUTY_NAME, BEAUTY_NAME + " copy");
            denoisedCopy = duplicateLayerToTop(doc, DENOISED_NAME, DENOISED_NAME + " copy");
            try {
                doc.activeLayer = denoisedCopy;
            } catch (selectErr) {
                writeLog("Select Denoised beauty copy failed: " + selectErr);
            }
            trace("Both duplicates completed.");
        } catch (err) {
            writeLog("Failed. Method: duplicateBeautyDenoisedToTop, elapsedMs: " +
                (new Date().getTime() - startedAt) + ", error: " + err);
            return;
        }

        var elapsed = new Date().getTime() - startedAt;
        if (elapsed >= SLOW_THRESHOLD_MS) {
            writeLog("Slow. Method: duplicateBeautyDenoisedToTop, elapsedMs: " + elapsed + ".");
        }
        trace("========== run end " + runId + ", elapsedMs=" + elapsed + " ==========");
    }

    run();
})();
