#target illustrator

(function () {
    var SCRIPT_NAME = "six_items_2x3_maximize";
    var COLS = 3;
    var ROWS = 2;
    var REQUIRED_COUNT = COLS * ROWS;
    var MARGIN_PT = 20;
    var GAP_PT = 20;
    var MIN_SIZE_PT = 0.01;

    if (app.documents.length === 0) {
        return;
    }

    var doc = app.activeDocument;
    var oldCoordinateSystem = app.coordinateSystem;

    try {
        app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

        var artboardIndex = doc.artboards.getActiveArtboardIndex();
        var artboardRect = doc.artboards[artboardIndex].artboardRect;
        var items = collectSelectedItems(doc);

        if (items.length === 0) {
            items = collectTopLevelItemsOnArtboard(doc, artboardRect);
        }

        if (items.length !== REQUIRED_COUNT) {
            return;
        }

        var sortedItems = sortItemsByVisualPosition(items);
        var layout = makeLayout(artboardRect);
        var scale = getUniformScale(sortedItems, layout.cellWidth, layout.cellHeight);

        if (!(scale > 0)) {
            return;
        }

        for (var i = 0; i < sortedItems.length; i++) {
            resizeAroundCenter(sortedItems[i], scale);
        }

        for (var row = 0; row < ROWS; row++) {
            for (var col = 0; col < COLS; col++) {
                var index = row * COLS + col;
                moveItemCenterTo(sortedItems[index], layout.centers[index].x, layout.centers[index].y);
            }
        }

        doc.selection = null;
        for (var j = 0; j < sortedItems.length; j++) {
            try {
                sortedItems[j].selected = true;
            } catch (selectError) {}
        }

    } catch (e) {
    } finally {
        try {
            app.coordinateSystem = oldCoordinateSystem;
        } catch (restoreError) {}
    }

    function collectSelectedItems(doc) {
        var result = [];
        if (!doc.selection || doc.selection.length === 0) {
            return result;
        }

        for (var i = 0; i < doc.selection.length; i++) {
            var item = doc.selection[i];
            if (isUsableItem(item)) {
                result.push(item);
            }
        }
        return result;
    }

    function collectTopLevelItemsOnArtboard(doc, artboardRect) {
        var result = [];

        for (var i = 0; i < doc.pageItems.length; i++) {
            var item = doc.pageItems[i];
            if (!isUsableItem(item) || !isTopLevelItem(item)) {
                continue;
            }

            var bounds = getItemBounds(item);
            if (!bounds) {
                continue;
            }

            var center = getBoundsCenter(bounds);
            if (isPointInRect(center.x, center.y, artboardRect)) {
                result.push(item);
            }
        }

        return result;
    }

    function isTopLevelItem(item) {
        try {
            return item.parent && item.parent.typename === "Layer";
        } catch (e) {
            return false;
        }
    }

    function isUsableItem(item) {
        if (!item) {
            return false;
        }

        try {
            if (item.locked || item.hidden) {
                return false;
            }
            if (item.layer && (item.layer.locked || !item.layer.visible)) {
                return false;
            }
        } catch (e1) {
            return false;
        }

        var bounds = getItemBounds(item);
        if (!bounds) {
            return false;
        }

        return getBoundsWidth(bounds) > MIN_SIZE_PT && getBoundsHeight(bounds) > MIN_SIZE_PT;
    }

    function sortItemsByVisualPosition(items) {
        var copy = [];
        for (var i = 0; i < items.length; i++) {
            copy.push(items[i]);
        }

        copy.sort(function (a, b) {
            var ca = getBoundsCenter(getItemBounds(a));
            var cb = getBoundsCenter(getItemBounds(b));
            if (Math.abs(ca.y - cb.y) > MIN_SIZE_PT) {
                return cb.y - ca.y;
            }
            return ca.x - cb.x;
        });

        var topRow = copy.slice(0, COLS);
        var bottomRow = copy.slice(COLS);

        topRow.sort(sortByLeft);
        bottomRow.sort(sortByLeft);

        return topRow.concat(bottomRow);
    }

    function sortByLeft(a, b) {
        var ba = getItemBounds(a);
        var bb = getItemBounds(b);
        return ba[0] - bb[0];
    }

    function makeLayout(artboardRect) {
        var left = artboardRect[0];
        var top = artboardRect[1];
        var right = artboardRect[2];
        var bottom = artboardRect[3];
        var width = right - left;
        var height = top - bottom;
        var margin = MARGIN_PT;
        var gap = GAP_PT;
        var usableWidth = width - margin * 2;
        var usableHeight = height - margin * 2;
        var cellWidth = (usableWidth - gap * (COLS - 1)) / COLS;
        var cellHeight = (usableHeight - gap * (ROWS - 1)) / ROWS;
        var gridLeft = left + margin;
        var gridTop = top - margin;
        var centers = [];

        for (var row = 0; row < ROWS; row++) {
            for (var col = 0; col < COLS; col++) {
                centers.push({
                    x: gridLeft + col * (cellWidth + gap) + cellWidth / 2,
                    y: gridTop - row * (cellHeight + gap) - cellHeight / 2
                });
            }
        }

        return {
            cellWidth: cellWidth,
            cellHeight: cellHeight,
            centers: centers
        };
    }

    function getUniformScale(items, cellWidth, cellHeight) {
        var scale = Number.MAX_VALUE;

        for (var i = 0; i < items.length; i++) {
            var bounds = getItemBounds(items[i]);
            var width = getBoundsWidth(bounds);
            var height = getBoundsHeight(bounds);
            if (!(width > MIN_SIZE_PT) || !(height > MIN_SIZE_PT)) {
                return 0;
            }

            var itemScale = Math.min(cellWidth / width, cellHeight / height);
            if (itemScale < scale) {
                scale = itemScale;
            }
        }

        return scale;
    }

    function resizeAroundCenter(item, scale) {
        var percent = scale * 100;
        try {
            item.resize(
                percent,
                percent,
                true,
                true,
                true,
                true,
                percent,
                Transformation.CENTER
            );
        } catch (e) {
            item.resize(percent, percent);
        }
    }

    function moveItemCenterTo(item, targetX, targetY) {
        var bounds = getItemBounds(item);
        if (!bounds) {
            return;
        }

        var center = getBoundsCenter(bounds);
        item.translate(targetX - center.x, targetY - center.y);
    }

    function getItemBounds(item) {
        try {
            return [
                item.visibleBounds[0],
                item.visibleBounds[1],
                item.visibleBounds[2],
                item.visibleBounds[3]
            ];
        } catch (e1) {
            try {
                return [
                    item.geometricBounds[0],
                    item.geometricBounds[1],
                    item.geometricBounds[2],
                    item.geometricBounds[3]
                ];
            } catch (e2) {
                return null;
            }
        }
    }

    function getBoundsCenter(bounds) {
        return {
            x: (bounds[0] + bounds[2]) / 2,
            y: (bounds[1] + bounds[3]) / 2
        };
    }

    function getBoundsWidth(bounds) {
        return bounds[2] - bounds[0];
    }

    function getBoundsHeight(bounds) {
        return bounds[1] - bounds[3];
    }

    function isPointInRect(x, y, rect) {
        return x >= rect[0] && x <= rect[2] && y <= rect[1] && y >= rect[3];
    }

})();
