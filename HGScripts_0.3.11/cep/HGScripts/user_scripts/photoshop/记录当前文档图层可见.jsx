#target photoshop

(function () {
    var SCRIPT_NAME = "记录当前文档图层可见";
    var STORE_VERSION = 1;
    var RECORD_RETENTION_DAYS = 2;
    var DAY_MS = 24 * 60 * 60 * 1000;

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
            keyHash: simpleHash(keySource),
            widthPx: getUnitText(doc.width),
            heightPx: getUnitText(doc.height),
            mode: String(doc.mode)
        };
    }

    function getStoreFile(doc) {
        var identity = getDocumentIdentity(doc);
        var root = getStoreRoot();
        var base = safeFilePart(identity.path || identity.name);
        return {
            identity: identity,
            file: new File(root.fsName + "/" + identity.keyHash + "_" + base + ".json")
        };
    }

    function sameFile(left, right) {
        try {
            return String(left.fsName).toLowerCase() === String(right.fsName).toLowerCase();
        } catch (ignore) {
        }

        return false;
    }

    function cleanupOldRecords(root, keepFile) {
        var files = root.getFiles("*.json");
        var cutoffTime = (new Date()).getTime() - RECORD_RETENTION_DAYS * DAY_MS;
        var deleted = 0;
        var failed = 0;

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (!(file instanceof File) || sameFile(file, keepFile)) {
                continue;
            }

            try {
                if (file.modified && file.modified.getTime && file.modified.getTime() < cutoffTime) {
                    if (file.remove()) {
                        deleted++;
                    } else {
                        failed++;
                    }
                }
            } catch (ignore) {
                failed++;
            }
        }

        if (deleted || failed) {
            writeLog("Cleanup. retentionDays=" + RECORD_RETENTION_DAYS + ", deleted=" + deleted + ", failed=" + failed);
        }
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

    function getLayerKind(layer) {
        try {
            return String(layer.kind);
        } catch (ignore) {
        }

        return "";
    }

    function getVisible(layer) {
        try {
            return !!layer.visible;
        } catch (ignore) {
        }

        return false;
    }

    function makeKey(parts) {
        return parts.join("\u001f");
    }

    function collectLayers(container, parentNames, parentOrdinals, indexPath, records) {
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

            records.push({
                id: getLayerId(layer),
                name: name,
                type: type,
                kind: getLayerKind(layer),
                visible: getVisible(layer),
                path: names,
                pathKey: makeKey(names),
                ordinalPath: ordinals,
                ordinalKey: makeKey(ordinals),
                indexPath: indexes,
                depth: names.length
            });

            if (type === "LayerSet") {
                collectLayers(layer, names, ordinals, indexes, records);
            }
        }
    }

    function repeatText(text, count) {
        var result = "";
        for (var i = 0; i < count; i++) {
            result += text;
        }
        return result;
    }

    function escapeJsonString(text) {
        var value = String(text || "");
        var result = "";

        for (var i = 0; i < value.length; i++) {
            var ch = value.charAt(i);
            var code = value.charCodeAt(i);

            if (ch === "\\") {
                result += "\\\\";
            } else if (ch === "\"") {
                result += "\\\"";
            } else if (ch === "\b") {
                result += "\\b";
            } else if (ch === "\f") {
                result += "\\f";
            } else if (ch === "\n") {
                result += "\\n";
            } else if (ch === "\r") {
                result += "\\r";
            } else if (ch === "\t") {
                result += "\\t";
            } else if (code < 32) {
                result += "\\u" + ("0000" + code.toString(16)).substr(-4);
            } else {
                result += ch;
            }
        }

        return "\"" + result + "\"";
    }

    function isArray(value) {
        return value instanceof Array;
    }

    function stringifyValue(value, depth) {
        var type = typeof value;
        var indent = repeatText("  ", depth);
        var nextIndent = repeatText("  ", depth + 1);

        if (value === null) {
            return "null";
        }
        if (type === "string") {
            return escapeJsonString(value);
        }
        if (type === "number") {
            return isFinite(value) ? String(value) : "null";
        }
        if (type === "boolean") {
            return value ? "true" : "false";
        }
        if (type === "undefined" || type === "function") {
            return undefined;
        }
        if (isArray(value)) {
            var arrayItems = [];
            for (var i = 0; i < value.length; i++) {
                var arrayValue = stringifyValue(value[i], depth + 1);
                arrayItems.push(nextIndent + (typeof arrayValue === "undefined" ? "null" : arrayValue));
            }

            return arrayItems.length ? "[\n" + arrayItems.join(",\n") + "\n" + indent + "]" : "[]";
        }

        var objectItems = [];
        for (var key in value) {
            if (value.hasOwnProperty && !value.hasOwnProperty(key)) {
                continue;
            }

            var objectValue = stringifyValue(value[key], depth + 1);
            if (typeof objectValue !== "undefined") {
                objectItems.push(nextIndent + escapeJsonString(key) + ": " + objectValue);
            }
        }

        return objectItems.length ? "{\n" + objectItems.join(",\n") + "\n" + indent + "}" : "{}";
    }

    function stringifyPretty(data) {
        if (typeof JSON !== "undefined" && JSON.stringify) {
            return JSON.stringify(data, null, 2);
        }

        return stringifyValue(data, 0);
    }

    function writeJson(file, data) {
        var text = stringifyPretty(data);

        file.encoding = "UTF-8";
        if (!file.open("w")) {
            throw new Error("无法写入记录文件: " + file.fsName);
        }

        try {
            file.write(text);
        } finally {
            file.close();
        }
    }

    function run() {
        if (!app.documents.length) {
            writeLog("Skipped: no open Photoshop document.");
            return;
        }

        var doc = app.activeDocument;
        var store = getStoreFile(doc);
        var records = [];

        collectLayers(doc, [], [], [], records);

        var data = {
            version: STORE_VERSION,
            script: SCRIPT_NAME,
            savedAt: formatDate(new Date()),
            document: store.identity,
            layerCount: records.length,
            layers: records
        };

        writeJson(store.file, data);
        cleanupOldRecords(getStoreRoot(), store.file);
        writeLog("Saved. layers=" + records.length + ", file=" + store.file.fsName);
    }

    try {
        run();
    } catch (err) {
        writeLog("Failed: " + err);
    }
})();
