#target illustrator

(function () {
    if (app.documents.length === 0) return;

    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) return;

    var originalSelection = copySelection(doc.selection);
    var bounds = getSelectionVisibleBounds(doc.selection);
    if (!bounds) return;

    var left = bounds[0];
    var top = bounds[1];
    var right = bounds[2];
    var bottom = bounds[3];
    var width = right - left;
    var height = top - bottom;

    if (!(width > 0) || !(height > 0)) return;

    var rect = doc.pathItems.rectangle(top, left, width, height);
    rect.name = "Selection_Bounds_Rect";
    rect.filled = false;
    rect.stroked = true;
    rect.strokeWidth = 1;
    rect.strokeColor = makeRGB(255, 255, 255);

    restoreSelection(doc, originalSelection);
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

function getSelectionVisibleBounds(selection) {
    var merged = null;

    for (var i = 0; i < selection.length; i++) {
        var itemBounds = getItemVisibleBounds(selection[i]);
        if (!itemBounds) continue;

        if (!merged) {
            merged = [
                itemBounds[0],
                itemBounds[1],
                itemBounds[2],
                itemBounds[3]
            ];
        } else {
            if (itemBounds[0] < merged[0]) merged[0] = itemBounds[0];
            if (itemBounds[1] > merged[1]) merged[1] = itemBounds[1];
            if (itemBounds[2] > merged[2]) merged[2] = itemBounds[2];
            if (itemBounds[3] < merged[3]) merged[3] = itemBounds[3];
        }
    }

    return merged;
}

function getItemVisibleBounds(item) {
    if (!item || item.locked || item.hidden) return null;

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

function makeRGB(r, g, b) {
    var color = new RGBColor();
    color.red = r;
    color.green = g;
    color.blue = b;
    return color;
}
