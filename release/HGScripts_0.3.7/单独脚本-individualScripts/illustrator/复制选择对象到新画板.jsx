#target illustrator

(function () {
    if (app.documents.length === 0) {
        alert("\u8bf7\u5148\u6253\u5f00\u4e00\u4e2a Illustrator \u6587\u6863");
        return;
    }

    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) {
        alert("\u8bf7\u5148\u9009\u4e2d\u9700\u8981\u590d\u5236\u5230\u65b0\u753b\u677f\u7684\u5bf9\u8c61");
        return;
    }

    var oldIndex = doc.artboards.getActiveArtboardIndex();
    var oldRect = doc.artboards[oldIndex].artboardRect;
    var gap = 20;
    var artboardWidth = oldRect[2] - oldRect[0];
    var offsetX = artboardWidth + gap;
    var newRect = [
        oldRect[0] + offsetX,
        oldRect[1],
        oldRect[2] + offsetX,
        oldRect[3]
    ];

    var selectedItems = [];
    for (var i = 0; i < doc.selection.length; i++) {
        selectedItems.push(doc.selection[i]);
    }

    var newArtboard = doc.artboards.add(newRect);
    var newIndex = doc.artboards.length - 1;
    try {
        newArtboard.name = doc.artboards[oldIndex].name + "_copy";
    } catch (e) {}

    var duplicates = [];
    for (var j = 0; j < selectedItems.length; j++) {
        try {
            var copy = selectedItems[j].duplicate();
            copy.translate(offsetX, 0);
            duplicates.push(copy);
        } catch (e2) {}
    }

    doc.artboards.setActiveArtboardIndex(newIndex);
    doc.selection = null;

    for (var k = 0; k < duplicates.length; k++) {
        try {
            duplicates[k].selected = true;
        } catch (e3) {}
    }
})();
