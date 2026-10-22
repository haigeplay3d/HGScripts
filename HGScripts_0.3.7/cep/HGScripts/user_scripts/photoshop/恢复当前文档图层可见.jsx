#target photoshop

(function () {
    var SCRIPT_NAME = "恢复当前文档图层可见";

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

    function ensureFolder(folder) {
        if (folder.exists) {
            return true;
        }

        if (folder.parent && !folder.parent.exists) {
            ensureFolder(folder.parent);
        }

        return folder.create();
    }

    function getLogFile() {
        var root = new Folder(Folder.userData.fsName + "/HGScripts/logs/photoshop");
        ensureFolder(root);
        return new File(root.fsName + "/" + SCRIPT_NAME + ".log");
    }

    function writeLog(message) {
        try {
            var file = getLogFile();
            file.encoding = "UTF-8";
            if (file.open("a")) {
                file.writeln("[" + formatDate(new Date()) + "] " + message);
                file.close();
            }
        } catch (ignore) {
        }
    }

    function getStoreRoot() {
        var root = new Folder(Folder.userData.fsName + "/HGScripts/data/photoshop/layer_visibility");
        ensureFolder(root);
        return root;
    }

    function simpleHash(text) {
        var hash = 0;
        var value = String(text || "");

        for (var i = 0; i < value.length; i++) {
            hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
        }

        return hash.toString(16);
    }

    function safeFilePart(text) {
        return String(text || "unsaved")
            .replace(/[\\\/:\*\?"<>\|]/g, "_")
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .substr(0, 80) || "document";
    }

    function safeDocPath(doc) {
        try {
            return doc.fullName.fsName;
        } catch (ignore) {
        }

        return "";
    }

    function getUnitText(value) {
        try {
            return String(value.as("px"));
        } catch (ignore) {
        }

        try {
            return String(value);
        } catch (ignoreValue) {
        }

        return "";
    }

    function getDocumentIdentity(doc) {
        var fullPath = safeDocPath(doc);
        var keySource = fullPath || (doc.name + "|" + getUnitText(doc.width) + "x" + getUnitText(doc.height));

        return {
            name: String(doc.name || ""),
            path: fullPath,
            keySource: keySource,
            keyHash: simpleHash(keySource)
        };
    }

    function getStoreFile(doc) {
        var identity = getDocumentIdentity(doc);
        var root = getStoreRoot();
        var base = safeFilePart(identity.path || identity.name);
        return new File(root.fsName + "/" + identity.keyHash + "_" + base + ".json");
    }

    function parseJson(text) {
        if (!text || !String(text).replace(/\s/g, "")) {
            throw new Error("当前文档的图层可见记录为空，请重新运行记录脚本");
        }

        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(text);
        }

        return eval("(" + text + ")");
    }

    function readJson(file) {
        if (!file.exists) {
            throw new Error("找不到当前文档的图层可见记录: " + file.fsName);
        }

        file.encoding = "UTF-8";
        if (!file.open("r")) {
            throw new Error("无法读取记录文件: " + file.fsName);
        }

        var text = file.read();
        file.close();
        return parseJson(text);
    }

    function getLayerId(layer) {
        try {
            return String(layer.id);
        } catch (ignore) {
        }

        return "";
    }

    function getLayerName(layer) {
        try {
            return String(layer.name);
        } catch (err) {
            return "<name error: " + err + ">";
        }
    }

    function getLayerType(layer) {
        try {
            return String(layer.typename);
        } catch (ignore) {
        }

        return "";
    }

    function makeKey(parts) {
        return parts.join("\u001f");
    }

    function addUnique(map, key, layer) {
        if (!key) {
            return;
        }

        if (!map[key]) {
            map[key] = layer;
        }
    }

    function collectCurrentLayers(container, parentNames, parentOrdinals, indexPath, index) {
        var layers = container.layers;
        var seenNames = {};

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var name = getLayerName(layer);
            var sameNameOrdinal = seenNames[name] || 0;
            seenNames[name] = sameNameOrdinal + 1;

            var names = parentNames.concat([name]);
            var ordinals = parentOrdinals.concat([name + "\u0002" + sameNameOrdinal]);
            var indexes = indexPath.concat([i]);
            var type = getLayerType(layer);

            addUnique(index.byId, getLayerId(layer), layer);
            addUnique(index.byPath, makeKey(names), layer);
            addUnique(index.byOrdinal, makeKey(ordinals), layer);
            addUnique(index.byIndex, makeKey(indexes), layer);

            if (type === "LayerSet") {
                collectCurrentLayers(layer, names, ordinals, indexes, index);
            }
        }
    }

    function buildLayerIndex(doc) {
        var index = {
            byId: {},
            byPath: {},
            byOrdinal: {},
            byIndex: {}
        };

        collectCurrentLayers(doc, [], [], [], index);
        return index;
    }

    function findLayer(record, index) {
        if (record.id && index.byId[record.id]) {
            return index.byId[record.id];
        }
        if (record.ordinalKey && index.byOrdinal[record.ordinalKey]) {
            return index.byOrdinal[record.ordinalKey];
        }
        if (record.pathKey && index.byPath[record.pathKey]) {
            return index.byPath[record.pathKey];
        }
        if (record.indexPath && index.byIndex[makeKey(record.indexPath)]) {
            return index.byIndex[makeKey(record.indexPath)];
        }

        return null;
    }

    function setVisible(layer, visible) {
        try {
            layer.visible = !!visible;
            return true;
        } catch (err) {
            writeLog("Set visible failed: " + getLayerName(layer) + ", visible=" + visible + ", error=" + err);
        }

        return false;
    }

    function restoreRecords(data, index) {
        var records = data.layers || [];
        var restored = 0;
        var missing = 0;
        var failed = 0;

        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            var layer = findLayer(record, index);

            if (!layer) {
                missing++;
                writeLog("Missing layer: name=" + record.name + ", path=" + (record.path || []).join("/"));
                continue;
            }

            if (setVisible(layer, record.visible)) {
                restored++;
            } else {
                failed++;
            }
        }

        return {
            restored: restored,
            missing: missing,
            failed: failed,
            total: records.length
        };
    }

    function run() {
        if (!app.documents.length) {
            writeLog("Skipped: no open Photoshop document.");
            return;
        }

        var doc = app.activeDocument;
        var file = getStoreFile(doc);
        var data = readJson(file);
        var index = buildLayerIndex(doc);
        var result = restoreRecords(data, index);

        writeLog("Restored. total=" + result.total +
            ", restored=" + result.restored +
            ", missing=" + result.missing +
            ", failed=" + result.failed +
            ", file=" + file.fsName);
    }

    try {
        run();
    } catch (err) {
        writeLog("Failed: " + err);
    }
})();
