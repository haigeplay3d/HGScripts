#target photoshop

(function () {
    var SCRIPT_NAME = "选择图层添加白色颜色叠加";

    function s2t(name) {
        return stringIDToTypeID(name);
    }

    function c2t(name) {
        return charIDToTypeID(name);
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

    function getActiveLayerId() {
        var ref = new ActionReference();
        ref.putProperty(s2t("property"), s2t("layerID"));
        ref.putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
        return executeActionGet(ref).getInteger(s2t("layerID"));
    }

    function getSelectedLayerIds() {
        var ids = [];

        try {
            var ref = new ActionReference();
            ref.putProperty(s2t("property"), s2t("targetLayersIDs"));
            ref.putEnumerated(s2t("document"), s2t("ordinal"), s2t("targetEnum"));

            var desc = executeActionGet(ref);
            var key = s2t("targetLayersIDs");
            if (desc.hasKey(key)) {
                var list = desc.getList(key);
                for (var i = 0; i < list.count; i++) {
                    ids.push(list.getReference(i).getIdentifier());
                }
            }
        } catch (ignore) {
        }

        if (!ids.length) {
            ids.push(getActiveLayerId());
        }

        return ids;
    }

    function selectLayerById(id, addToSelection) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putIdentifier(c2t("Lyr "), id);
        desc.putReference(c2t("null"), ref);

        if (addToSelection) {
            desc.putEnumerated(
                s2t("selectionModifier"),
                s2t("selectionModifierType"),
                s2t("addToSelection")
            );
        }

        desc.putBoolean(s2t("makeVisible"), false);
        executeAction(c2t("slct"), desc, DialogModes.NO);
    }

    function restoreSelection(ids) {
        if (!ids || !ids.length) {
            return;
        }

        selectLayerById(ids[0], false);
        for (var i = 1; i < ids.length; i++) {
            selectLayerById(ids[i], true);
        }
    }

    function applyWhiteColorOverlayToTargetLayer() {
        var effects = getLayerEffectsDescriptor();
        var fills = getExistingColorOverlayList(effects);
        fills.putObject(s2t("solidFill"), createWhiteColorOverlayDescriptor());

        eraseDescriptorKey(effects, s2t("solidFill"));
        eraseDescriptorKey(effects, c2t("SoFi"));
        effects.putList(s2t("solidFillMulti"), fills);
        setLayerEffectsDescriptor(effects);
    }

    function getLayerEffectsDescriptor() {
        var ref = new ActionReference();
        var property = s2t("layerEffects");

        ref.putProperty(s2t("property"), property);
        ref.putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));

        var layerDesc = executeActionGet(ref);
        if (layerDesc.hasKey(property)) {
            return layerDesc.getObjectValue(property);
        }

        var effects = new ActionDescriptor();
        effects.putUnitDouble(c2t("Scl "), c2t("#Prc"), 100);
        return effects;
    }

    function setLayerEffectsDescriptor(effects) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        ref.putProperty(s2t("property"), s2t("layerEffects"));
        ref.putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
        desc.putReference(s2t("null"), ref);
        desc.putObject(s2t("to"), s2t("layerEffects"), effects);
        executeAction(s2t("set"), desc, DialogModes.NO);
    }

    function getExistingColorOverlayList(effects) {
        var fills = new ActionList();
        var multiKey = s2t("solidFillMulti");
        var singleKey = s2t("solidFill");
        var legacySingleKey = c2t("SoFi");

        if (effects.hasKey(multiKey)) {
            var existing = effects.getList(multiKey);
            for (var i = 0; i < existing.count; i++) {
                fills.putObject(s2t("solidFill"), existing.getObjectValue(i));
            }
        }

        if (effects.hasKey(singleKey)) {
            fills.putObject(s2t("solidFill"), effects.getObjectValue(singleKey));
        } else if (effects.hasKey(legacySingleKey)) {
            fills.putObject(s2t("solidFill"), effects.getObjectValue(legacySingleKey));
        }

        return fills;
    }

    function createWhiteColorOverlayDescriptor() {
        var overlay = new ActionDescriptor();
        overlay.putBoolean(s2t("enabled"), true);
        overlay.putBoolean(s2t("present"), true);
        overlay.putBoolean(s2t("showInDialog"), false);
        overlay.putEnumerated(s2t("mode"), s2t("blendMode"), s2t("normal"));
        overlay.putUnitDouble(s2t("opacity"), s2t("percentUnit"), 100);

        var white = new ActionDescriptor();
        white.putDouble(c2t("Rd  "), 255);
        white.putDouble(c2t("Grn "), 255);
        white.putDouble(c2t("Bl  "), 255);
        overlay.putObject(s2t("color"), s2t("RGBColor"), white);

        return overlay;
    }

    function eraseDescriptorKey(desc, key) {
        if (desc.hasKey(key)) {
            desc.erase(key);
        }
    }

    if (!app.documents.length) {
        writeLog("Skipped: no open Photoshop document.");
        return;
    }

    var selectedIds = getSelectedLayerIds();
    var successCount = 0;

    for (var i = 0; i < selectedIds.length; i++) {
        try {
            selectLayerById(selectedIds[i], false);
            applyWhiteColorOverlayToTargetLayer();
            successCount++;
        } catch (layerError) {
            writeLog("Layer " + selectedIds[i] + " failed: " + layerError);
        }
    }

    try {
        restoreSelection(selectedIds);
    } catch (restoreError) {
        writeLog("Restore selection failed: " + restoreError);
    }

    writeLog("Done. Selected layers: " + selectedIds.length + ", applied: " + successCount + ".");
})();
