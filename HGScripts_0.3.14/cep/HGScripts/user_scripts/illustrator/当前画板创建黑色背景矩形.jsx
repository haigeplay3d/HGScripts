#target illustrator

(function () {
    try {
        if (app.documents.length === 0) {
            return;
        }

        var doc = app.activeDocument;
        var artboardIndex = doc.artboards.getActiveArtboardIndex();
        var artboard = doc.artboards[artboardIndex];
        var rect = artboard.artboardRect; // [left, top, right, bottom]

        var left = rect[0];
        var top = rect[1];
        var width = rect[2] - rect[0];
        var height = rect[1] - rect[3];

        if (!(width > 0) || !(height > 0)) {
            return;
        }

        var black = new RGBColor();
        black.red = 0;
        black.green = 0;
        black.blue = 0;

        var targetLayer = getWritableTargetLayer(doc);
        if (!targetLayer) {
            writeHiddenLog("No writable layer available.");
            return;
        }

        var bg = targetLayer.pathItems.rectangle(top, left, width, height);
        bg.name = "\u5f53\u524d\u753b\u677f\u9ed1\u8272\u80cc\u666f\u77e9\u5f62";
        bg.filled = true;
        bg.fillColor = black;
        bg.stroked = false;

        try {
            bg.zOrder(ZOrderMethod.SENDTOBACK);
        } catch (zOrderError) {
            writeHiddenLog("Send rectangle to back failed: " + zOrderError);
        }
    } catch (error) {
        writeHiddenLog("Create artboard background failed: " + error);
    }
})();

function getWritableTargetLayer(doc) {
    var activeLayer = null;
    try {
        activeLayer = doc.activeLayer;
    } catch (activeError) {
        activeLayer = null;
    }

    if (isWritableLayer(activeLayer)) {
        return activeLayer;
    }

    var layer = null;
    try {
        layer = doc.layers.add();
        layer.name = "HGScripts \u80cc\u666f";
        layer.visible = true;
        layer.locked = false;
        try {
            layer.zOrder(ZOrderMethod.SENDTOBACK);
        } catch (layerOrderError) {
            writeHiddenLog("Send background layer to back failed: " + layerOrderError);
        }
    } catch (createLayerError) {
        writeHiddenLog("Create fallback background layer failed: " + createLayerError);
        layer = null;
    }

    return isWritableLayer(layer) ? layer : null;
}

function isWritableLayer(layer) {
    try {
        return !!layer && !layer.locked && layer.visible !== false;
    } catch (error) {
        return false;
    }
}

function writeHiddenLog(message) {
    try {
        var folder = new Folder(Folder.userData + "/HGScripts/logs");
        if (!folder.exists) {
            folder.create();
        }
        var file = new File(folder.fsName + "/artboard_background.log");
        file.encoding = "UTF-8";
        if (file.open("a")) {
            file.writeln(new Date().toString() + " " + message);
            file.close();
        }
    } catch (logError) {
    }
}
