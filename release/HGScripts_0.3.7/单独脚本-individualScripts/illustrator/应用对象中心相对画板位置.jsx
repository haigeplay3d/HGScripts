#target illustrator

(function () {
    var MEMORY_FILE_NAME = "artboard_center_memory.json";
    var MOVE_EPSILON_PT = 0.01;

    if (!app.documents.length) {
        return;
    }

    var doc = app.activeDocument;
    var items = collectSelection(doc.selection);
    if (!items.length) {
        return;
    }

    var memory = readMemory();
    if (!memory) {
        return;
    }

    var oldCoordinateSystem = app.coordinateSystem;
    var oldArtboardIndex = doc.artboards.getActiveArtboardIndex();

    try {
        app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

        var documentBounds = getSelectionBounds(items);
        if (!documentBounds) {
            return;
        }

        var documentCenter = getBoundsCenter(documentBounds);
        var artboardIndex = findArtboardIndexByPoint(doc, documentCenter.x, documentCenter.y);

        doc.artboards.setActiveArtboardIndex(artboardIndex);
        app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;

        var currentBounds = getSelectionBounds(items);
        if (!currentBounds) {
            return;
        }

        var currentCenter = getBoundsCenter(currentBounds);
        var dx = memory.relativeCenterX - currentCenter.x;
        var dy = memory.relativeCenterY - currentCenter.y;

        if (Math.abs(dx) < MOVE_EPSILON_PT) {
            dx = 0;
        }
        if (Math.abs(dy) < MOVE_EPSILON_PT) {
            dy = 0;
        }
        if (dx === 0 && dy === 0) {
            return;
        }

        for (var i = 0; i < items.length; i++) {
            moveItem(items[i], dx, dy);
        }
    } finally {
        try {
            app.coordinateSystem = oldCoordinateSystem;
            doc.artboards.setActiveArtboardIndex(oldArtboardIndex);
        } catch (e) {}
    }

    function collectSelection(selection) {
        var result = [];
        if (!selection || !selection.length) {
            return result;
        }

        for (var i = 0; i < selection.length; i++) {
            try {
                if (!selection[i].locked && !selection[i].hidden) {
                    result.push(selection[i]);
                }
            } catch (e) {}
        }
        return result;
    }

    function moveItem(item, dx, dy) {
        try {
            if (!item.locked && !item.hidden) {
                item.translate(dx, dy);
            }
        } catch (e) {}
    }

    function getSelectionBounds(items) {
        var result = null;
        for (var i = 0; i < items.length; i++) {
            var itemBounds = getItemBounds(items[i]);
            if (!itemBounds) {
                continue;
            }
            result = result ? unionBounds(result, itemBounds) : itemBounds;
        }
        return result;
    }

    function getItemBounds(item) {
        try {
            if (item.locked || item.hidden || !item.geometricBounds) {
                return null;
            }

            return [
                item.geometricBounds[0],
                item.geometricBounds[1],
                item.geometricBounds[2],
                item.geometricBounds[3]
            ];
        } catch (e) {
            return null;
        }
    }

    function unionBounds(a, b) {
        return [
            Math.min(a[0], b[0]),
            Math.max(a[1], b[1]),
            Math.max(a[2], b[2]),
            Math.min(a[3], b[3])
        ];
    }

    function getBoundsCenter(bounds) {
        return {
            x: (bounds[0] + bounds[2]) / 2,
            y: (bounds[1] + bounds[3]) / 2
        };
    }

    function findArtboardIndexByPoint(doc, x, y) {
        var nearestIndex = 0;
        var nearestDistance = Number.MAX_VALUE;

        for (var i = 0; i < doc.artboards.length; i++) {
            var rect = doc.artboards[i].artboardRect;
            if (x >= rect[0] && x <= rect[2] && y <= rect[1] && y >= rect[3]) {
                return i;
            }

            var centerX = (rect[0] + rect[2]) / 2;
            var centerY = (rect[1] + rect[3]) / 2;
            var offsetX = x - centerX;
            var offsetY = y - centerY;
            var distance = offsetX * offsetX + offsetY * offsetY;
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }

        return nearestIndex;
    }

    function readMemory() {
        var file = getMemoryFile();
        if (!file.exists) {
            return null;
        }

        file.encoding = "UTF-8";
        file.open("r");
        var text = file.read();
        file.close();

        var relativeCenterX = readNumber(text, "relativeCenterX");
        var relativeCenterY = readNumber(text, "relativeCenterY");
        if (isNaN(relativeCenterX) || isNaN(relativeCenterY)) {
            return null;
        }

        return {
            relativeCenterX: relativeCenterX,
            relativeCenterY: relativeCenterY
        };
    }

    function readNumber(text, key) {
        var match = text.match(new RegExp("\"" + key + "\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)"));
        return match ? parseFloat(match[1]) : NaN;
    }

    function getMemoryFile() {
        var root = getExtensionRoot();
        return new File(root.fsName + "/data/" + MEMORY_FILE_NAME);
    }

    function getExtensionRoot() {
        var folder = new File($.fileName).parent;
        while (folder && folder.exists) {
            if (folder.name === "HGScripts_dev" || folder.name === "HGScripts") {
                return folder;
            }
            folder = folder.parent;
        }
        return new File($.fileName).parent.parent;
    }
})();
