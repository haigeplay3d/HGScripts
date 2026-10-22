(function () {

    try {
        if (app.documents.length === 0) {
            return;
        }

        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length < 1) {
            return;
        }

        var originalSelection = copySelection(doc.selection);
        var target = doc.selection[0];
        var bounds = target.geometricBounds; // [left, top, right, bottom]
        var left = bounds[0];
        var top = bounds[1];
        var right = bounds[2];
        var bottom = bounds[3];
        var width = right - left;
        var height = top - bottom;

        if (!(width > 0) || !(height > 0)) {
            return;
        }

        var parentLayer = target.layer || doc.activeLayer;
        var rect = parentLayer.pathItems.rectangle(top, left, width, height);
        rect.name = "选择对象白色填充矩形";
        rect.filled = true;
        rect.fillColor = makeRGB(255, 255, 255);
        rect.stroked = false;

        try {
            rect.move(target, ElementPlacement.PLACEAFTER);
        } catch (moveError) {
        }

        rect.zOrder(ZOrderMethod.BRINGTOFRONT);

        restoreSelection(doc, originalSelection);
    } catch (error) {
    }
})();

function copySelection(selection) {
    var result = [];
    for (var i = 0; i < selection.length; i++) {
        result.push(selection[i]);
    }
    return result;
}

function restoreSelection(doc, items) {
    try {
        doc.selection = null;
        doc.selection = items;
    } catch (e1) {
        try {
            doc.selection = null;
            for (var i = 0; i < items.length; i++) {
                items[i].selected = true;
            }
        } catch (e2) {}
    }
}

function makeRGB(r, g, b) {
    var color = new RGBColor();
    color.red = r;
    color.green = g;
    color.blue = b;
    return color;
}

