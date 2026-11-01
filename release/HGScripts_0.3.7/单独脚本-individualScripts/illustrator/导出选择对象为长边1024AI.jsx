#target illustrator

(function () {
    if (app.documents.length === 0) {
        alert("\u8bf7\u5148\u6253\u5f00\u4e00\u4e2a Illustrator \u6587\u6863");
        return;
    }

    var sourceDoc = app.activeDocument;
    if (!sourceDoc.selection || sourceDoc.selection.length === 0) {
        alert("\u8bf7\u5148\u9009\u4e2d\u9700\u8981\u5bfc\u51fa\u7684\u5bf9\u8c61");
        return;
    }

    var outputFolder = getOutputFolder(sourceDoc);
    if (!outputFolder) return;

    var outputFile = getUniqueFile(outputFolder, getBaseName(sourceDoc) + "_selection_long1024", "ai");
    var selectedItems = copySelectionArray(sourceDoc.selection);
    var targetDoc = app.documents.add(sourceDoc.documentColorSpace, 1024, 1024);
    var targetLayer = targetDoc.layers[0];
    var duplicates = [];

    for (var i = 0; i < selectedItems.length; i++) {
        try {
            var dup = selectedItems[i].duplicate(targetLayer, ElementPlacement.PLACEATBEGINNING);
            duplicates.push(dup);
        } catch (e1) {}
    }

    if (duplicates.length === 0) {
        targetDoc.close(SaveOptions.DONOTSAVECHANGES);
        alert("\u9009\u4e2d\u5bf9\u8c61\u65e0\u6cd5\u590d\u5236\u5230\u65b0\u6587\u6863");
        return;
    }

    standardizeDocument(targetDoc, duplicates, 1024);
    saveAiFile(targetDoc, outputFile);
})();

function copySelectionArray(selection) {
    var out = [];
    for (var i = 0; i < selection.length; i++) {
        out.push(selection[i]);
    }
    return out;
}

function standardizeDocument(doc, items, longSide) {
    doc.activate();

    var initialBounds = getItemsVisibleBounds(items);
    if (!initialBounds) return;

    var initialWidth = initialBounds[2] - initialBounds[0];
    var initialHeight = initialBounds[1] - initialBounds[3];
    var initialLongSide = Math.max(initialWidth, initialHeight);
    if (!(initialLongSide > 0)) return;

    var scalePercent = (longSide / initialLongSide) * 100;
    for (var i = 0; i < items.length; i++) {
        try {
            items[i].resize(
                scalePercent,
                scalePercent,
                true,
                true,
                true,
                true,
                scalePercent,
                Transformation.CENTER
            );
        } catch (e1) {
            try {
                items[i].resize(scalePercent, scalePercent);
            } catch (e2) {}
        }
    }

    var bounds = getItemsVisibleBounds(items);
    if (!bounds) return;

    var width = bounds[2] - bounds[0];
    var height = bounds[1] - bounds[3];
    var artboardWidth;
    var artboardHeight;

    if (width >= height) {
        artboardWidth = longSide;
        artboardHeight = Math.ceil(height);
    } else {
        artboardWidth = Math.ceil(width);
        artboardHeight = longSide;
    }

    if (artboardWidth < 1) artboardWidth = 1;
    if (artboardHeight < 1) artboardHeight = 1;

    doc.artboards[0].artboardRect = [0, artboardHeight, artboardWidth, 0];

    var centerX = (bounds[0] + bounds[2]) / 2;
    var centerY = (bounds[1] + bounds[3]) / 2;
    var dx = artboardWidth / 2 - centerX;
    var dy = artboardHeight / 2 - centerY;

    for (var j = 0; j < items.length; j++) {
        try {
            items[j].translate(dx, dy);
        } catch (e3) {}
    }

    doc.selection = null;
    for (var k = 0; k < items.length; k++) {
        try {
            items[k].selected = true;
        } catch (e4) {}
    }
}

function getItemsVisibleBounds(items) {
    var merged = null;

    for (var i = 0; i < items.length; i++) {
        var b = getItemBounds(items[i]);
        if (!b) continue;

        if (!merged) {
            merged = [b[0], b[1], b[2], b[3]];
        } else {
            if (b[0] < merged[0]) merged[0] = b[0];
            if (b[1] > merged[1]) merged[1] = b[1];
            if (b[2] > merged[2]) merged[2] = b[2];
            if (b[3] < merged[3]) merged[3] = b[3];
        }
    }

    return merged;
}

function getItemBounds(item) {
    try {
        return item.visibleBounds;
    } catch (e1) {
        try {
            return item.geometricBounds;
        } catch (e2) {
            return null;
        }
    }
}

function saveAiFile(doc, file) {
    doc.activate();
    var options = new IllustratorSaveOptions();
    options.pdfCompatible = true;
    options.compressed = true;
    doc.saveAs(file, options);
}

function getOutputFolder(doc) {
    try {
        if (doc.fullName && doc.fullName.parent && doc.fullName.parent.exists) {
            return doc.fullName.parent;
        }
    } catch (e) {}

    return Folder.selectDialog("\u9009\u62e9\u5bfc\u51fa AI \u6587\u4ef6\u7684\u4fdd\u5b58\u76ee\u5f55");
}

function getBaseName(doc) {
    var name = "selection";
    try {
        name = doc.name || name;
    } catch (e) {}

    return sanitizeFileName(name.replace(/\.[^\.]+$/, ""));
}

function sanitizeFileName(name) {
    return String(name).replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
}

function getUniqueFile(folder, baseName, extension) {
    var file = new File(folder.fsName + "/" + baseName + "." + extension);
    if (!file.exists) return file;

    for (var i = 1; i < 1000; i++) {
        var suffix = ("000" + i).slice(-3);
        file = new File(folder.fsName + "/" + baseName + "_" + suffix + "." + extension);
        if (!file.exists) return file;
    }

    return new File(folder.fsName + "/" + baseName + "_" + new Date().getTime() + "." + extension);
}
