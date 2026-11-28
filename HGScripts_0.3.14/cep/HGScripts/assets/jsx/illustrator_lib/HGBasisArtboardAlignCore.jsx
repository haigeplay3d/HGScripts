#target illustrator

(function () {
    $.global.HGBasisArtboardAlignCore = {
        run: run
    };

    var EPSILON = 0.01;

    function run(mode) {

        var spec = getModeSpec(mode);
        if (!spec) {
            return;
        }

        if (!app.documents.length) {
            return;
        }

        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length === 0) {
            return;
        }

        if (doc.selection.length !== 1) {
            return;
        }

        var basisItem = doc.selection[0];
        if (!basisItem) {
            return;
        }

        var basisBounds = getItemBounds(basisItem);
        if (!basisBounds) {
            return;
        }

        var moveTarget = getTopmostParentGroup(basisItem);
        if (!moveTarget) {
            moveTarget = basisItem;
        }

        if (!canEdit(moveTarget)) {
            return;
        }

        var artboardInfo = getArtboardInfoByItem(doc, basisItem);
        if (!artboardInfo) {
            return;
        }

        var delta = getMoveDelta(spec, basisBounds, artboardInfo.rect);
        if (!delta) {
            return;
        }

        if (Math.abs(delta.dx) < EPSILON) delta.dx = 0;
        if (Math.abs(delta.dy) < EPSILON) delta.dy = 0;

        if (delta.dx === 0 && delta.dy === 0) {
            return;
        }


        if (!moveWholeTarget(doc, basisItem, moveTarget, delta.dx, delta.dy)) {
            return;
        }

    }

    function getModeSpec(mode) {
        var specs = {
            left: { axis: "x", itemAnchor: "left", artboardAnchor: "left" },
            hcenter: { axis: "x", itemAnchor: "centerX", artboardAnchor: "centerX" },
            right: { axis: "x", itemAnchor: "right", artboardAnchor: "right" },
            top: { axis: "y", itemAnchor: "top", artboardAnchor: "top" },
            vcenter: { axis: "y", itemAnchor: "centerY", artboardAnchor: "centerY" },
            bottom: { axis: "y", itemAnchor: "bottom", artboardAnchor: "bottom" }
        };

        return specs[mode] || null;
    }

    function getMoveDelta(spec, itemBounds, artboardRect) {
        var itemValue = getBoundsAnchor(itemBounds, spec.itemAnchor);
        var artboardValue = getArtboardAnchor(artboardRect, spec.artboardAnchor);
        if (isNaN(itemValue) || isNaN(artboardValue)) return null;

        var offset = artboardValue - itemValue;
        if (spec.axis === "x") {
            return { dx: offset, dy: 0 };
        }

        return { dx: 0, dy: offset };
    }

    function getBoundsAnchor(bounds, anchor) {
        if (anchor === "left") return bounds.left;
        if (anchor === "right") return bounds.right;
        if (anchor === "top") return bounds.top;
        if (anchor === "bottom") return bounds.bottom;
        if (anchor === "centerX") return (bounds.left + bounds.right) / 2;
        if (anchor === "centerY") return (bounds.top + bounds.bottom) / 2;
        return NaN;
    }

    function getArtboardAnchor(rect, anchor) {
        var left = Number(rect[0]);
        var top = Number(rect[1]);
        var right = Number(rect[2]);
        var bottom = Number(rect[3]);

        if (anchor === "left") return left;
        if (anchor === "right") return right;
        if (anchor === "top") return top;
        if (anchor === "bottom") return bottom;
        if (anchor === "centerX") return (left + right) / 2;
        if (anchor === "centerY") return (top + bottom) / 2;
        return NaN;
    }

    function getArtboardInfoByItem(doc, item) {
        var bounds = getItemBounds(item);
        if (!bounds) return null;

        var centerX = (bounds.left + bounds.right) / 2;
        var centerY = (bounds.top + bounds.bottom) / 2;
        var index = findArtboardIndexByPoint(doc, centerX, centerY);

        try {
            return {
                index: index,
                rect: doc.artboards[index].artboardRect
            };
        } catch (e) {
            return null;
        }
    }

    function findArtboardIndexByPoint(doc, x, y) {
        var nearestIndex = 0;
        var nearestDistance = Number.MAX_VALUE;

        for (var i = 0; i < doc.artboards.length; i++) {
            var rect = doc.artboards[i].artboardRect;
            var left = Number(rect[0]);
            var top = Number(rect[1]);
            var right = Number(rect[2]);
            var bottom = Number(rect[3]);

            if (x >= left && x <= right && y <= top && y >= bottom) {
                return i;
            }

            var centerX = (left + right) / 2;
            var centerY = (top + bottom) / 2;
            var dx = x - centerX;
            var dy = y - centerY;
            var distance = dx * dx + dy * dy;
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }

        return nearestIndex;
    }

    function getTopmostParentGroup(item) {
        try {
            var parent = item.typename === "GroupItem" ? item : item.parent;
            var topGroup = null;

            while (parent && parent !== app) {
                if (parent.typename === "GroupItem") {
                    topGroup = parent;
                }

                if (parent.typename === "Layer" || parent.typename === "Document") {
                    break;
                }

                parent = parent.parent;
            }

            return topGroup;
        } catch (e) {
            return null;
        }
    }

    function getItemBounds(item) {
        try {
            var b = usePreviewBounds() ? item.visibleBounds : item.geometricBounds;
            return {
                left: Number(b[0]),
                top: Number(b[1]),
                right: Number(b[2]),
                bottom: Number(b[3])
            };
        } catch (e1) {
            try {
                var b2 = item.visibleBounds;
                return {
                    left: Number(b2[0]),
                    top: Number(b2[1]),
                    right: Number(b2[2]),
                    bottom: Number(b2[3])
                };
            } catch (e2) {
                return null;
            }
        }
    }

    function usePreviewBounds() {
        try {
            return app.preferences.getBooleanPreference("includeStrokeInBounds") === true;
        } catch (e) {
            return false;
        }
    }

    function canEdit(item) {
        try {
            if (!item || item.locked || item.hidden) return false;

            var parent = item.parent;
            while (parent && parent !== app && parent.typename !== "Document") {
                if (parent.locked === true || parent.hidden === true) return false;
                if (parent.typename === "Layer" && (parent.locked || !parent.visible)) return false;
                parent = parent.parent;
            }
        } catch (e) {
            return false;
        }
        return true;
    }

    function moveWholeTarget(doc, basisItem, item, dx, dy) {
        var basisUuid = getItemUuid(basisItem);

        if (moveByNativeAction(doc, basisItem, item, dx, dy, basisUuid)) {
            return true;
        }

        try {
            item.translate(dx, dy);
            restoreBasisSelection(doc, basisItem, basisUuid);
            return true;
        } catch (e) {
            return false;
        }
    }

    function moveByNativeAction(doc, basisItem, item, dx, dy, basisUuid) {
        var oldInteractionLevel = null;
        var changedInteractionLevel = false;

        try {
            oldInteractionLevel = app.userInteractionLevel;
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
            changedInteractionLevel = true;

            doc.selection = null;
            item.selected = true;

            runMoveAction("HGBasisMoveTempSet", "HGBasisMove", dx, dy);

            restoreBasisSelection(doc, basisItem, basisUuid);

            return true;
        } catch (e) {
            return false;
        } finally {
            if (changedInteractionLevel) {
                try {
                    app.userInteractionLevel = oldInteractionLevel;
                } catch (interactionError) {}
            }
        }
    }

    function getItemUuid(item) {
        try {
            if (item && item.uuid) return String(item.uuid);
        } catch (e) {}

        return "";
    }

    function restoreBasisSelection(doc, basisItem, basisUuid) {
        var restoredItem = null;

        try {
            app.redraw();
        } catch (redrawBeforeError) {}

        if (basisUuid) {
            try {
                if (doc.getPageItemFromUuid) {
                    restoredItem = doc.getPageItemFromUuid(basisUuid);
                }
            } catch (uuidError) {
            }
        }

        if (!restoredItem) {
            restoredItem = basisItem;
        }

        try {
            doc.selection = null;
            restoredItem.selected = true;
            try {
                app.redraw();
            } catch (redrawAfterError) {}
            return true;
        } catch (selectError) {
        }

        try {
            doc.selection = null;
            doc.selection = [restoredItem];
            return getSelectionCount(doc) > 0;
        } catch (arraySelectError) {
        }

        return false;
    }

    function getSelectionCount(doc) {
        try {
            if (doc.selection) return doc.selection.length;
        } catch (e) {}

        return 0;
    }

    function runMoveAction(actionSetName, actionName, dx, dy) {
        var actionFile = null;
        try {
            try {
                app.unloadAction(actionSetName, "");
            } catch (unloadBeforeError) {}

            actionFile = File(Folder.temp + "/HGBasisMoveTempAction.aia");
            actionFile.encoding = "UTF-8";
            if (!actionFile.open("w")) {
                throw new Error("cannot open temp action file");
            }
            actionFile.write(buildMoveActionText(actionSetName, actionName, dx, dy));
            actionFile.close();

            app.loadAction(actionFile);
            app.doScript(actionName, actionSetName);
        } finally {
            try {
                app.unloadAction(actionSetName, "");
            } catch (unloadAfterError) {}

            if (actionFile) {
                try {
                    if (actionFile.exists) actionFile.remove();
                } catch (removeError) {}
            }
        }
    }

    function buildMoveActionText(actionSetName, actionName, dx, dy) {
        return [
            "/version 3",
            "/name [ " + actionSetName.length,
            "\t" + asciiHex(actionSetName),
            "]",
            "/isOpen 0",
            "/actionCount 1",
            "/action-1 {",
            "\t/name [ " + actionName.length,
            "\t\t" + asciiHex(actionName),
            "\t]",
            "\t/keyIndex 0",
            "\t/colorIndex 0",
            "\t/isOpen 0",
            "\t/eventCount 1",
            "\t/event-1 {",
            "\t\t/useRulersIn1stQuadrant 0",
            "\t\t/internalName (adobe_move)",
            "\t\t/localizedName [ 4",
            "\t\t\t4d6f7665",
            "\t\t]",
            "\t\t/isOpen 0",
            "\t\t/isOn 1",
            "\t\t/hasDialog 1",
            "\t\t/showDialog 0",
            "\t\t/parameterCount 5",
            "\t\t/parameter-1 {",
            "\t\t\t/key 1752136302",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (unit real)",
            "\t\t\t/value " + actionNumber(dx),
            "\t\t\t/unit 592476268",
            "\t\t}",
            "\t\t/parameter-2 {",
            "\t\t\t/key 1987339116",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (unit real)",
            "\t\t\t/value " + actionNumber(dy),
            "\t\t\t/unit 592476268",
            "\t\t}",
            "\t\t/parameter-3 {",
            "\t\t\t/key 1868720756",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (boolean)",
            "\t\t\t/value 1",
            "\t\t}",
            "\t\t/parameter-4 {",
            "\t\t\t/key 1885434990",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (boolean)",
            "\t\t\t/value 1",
            "\t\t}",
            "\t\t/parameter-5 {",
            "\t\t\t/key 1668247673",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (boolean)",
            "\t\t\t/value 0",
            "\t\t}",
            "\t}",
            "}"
        ].join("\n");
    }

    function describeItem(item) {
        if (!item) return "null";
        return getType(item) +
            "(name=" + safeProp(item, "name") +
            ", clipped=" + safeProp(item, "clipped") +
            ", clipping=" + safeProp(item, "clipping") +
            ", bounds=" + boundsToText(getItemBounds(item)) +
            ")";
    }

    function getType(item) {
        try {
            return item && item.typename ? item.typename : String(item);
        } catch (e) {
            return "Unknown";
        }
    }

    function safeProp(item, propName) {
        try {
            var value = item[propName];
            if (value === undefined) return "undefined";
            if (value === null) return "null";
            return String(value);
        } catch (e) {
            return "ERR";
        }
    }

    function boundsToText(bounds) {
        if (!bounds) return "null";
        return "[l=" + fmt(bounds.left) + ",t=" + fmt(bounds.top) + ",r=" + fmt(bounds.right) + ",b=" + fmt(bounds.bottom) + ",w=" + fmt(Math.abs(bounds.right - bounds.left)) + ",h=" + fmt(Math.abs(bounds.top - bounds.bottom)) + "]";
    }

    function asciiHex(text) {
        var result = "";
        for (var i = 0; i < text.length; i++) {
            var hex = text.charCodeAt(i).toString(16);
            if (hex.length < 2) hex = "0" + hex;
            result += hex;
        }
        return result;
    }

    function actionNumber(value) {
        var n = Number(value);
        if (isNaN(n)) return "0.0";

        var text = String(Math.round(n * 1000000) / 1000000);
        if (text.indexOf(".") < 0) text += ".0";
        return text;
    }

    function fmt(value) {
        var n = Number(value);
        if (isNaN(n)) return String(value);
        return String(Math.round(n * 1000) / 1000);
    }

})();
