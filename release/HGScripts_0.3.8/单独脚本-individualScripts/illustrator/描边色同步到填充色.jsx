#target illustrator

(function () {
    if (!app.documents.length) {
        return;
    }

    var selection = app.activeDocument.selection;
    if (!selection || !selection.length) {
        return;
    }

    for (var i = 0; i < selection.length; i++) {
        syncItem(selection[i], "strokeToFill");
    }

    function syncItem(item, mode) {
        if (!item) {
            return;
        }

        try {
            if (item.locked || item.hidden) {
                return;
            }
        } catch (e) {}

        try {
            switch (item.typename) {
                case "GroupItem":
                    syncCollection(item.pageItems, mode);
                    break;
                case "CompoundPathItem":
                    syncCollection(item.pathItems, mode);
                    break;
                case "PathItem":
                    syncPath(item, mode);
                    break;
                case "TextFrame":
                    syncTextFrame(item, mode);
                    break;
                default:
                    break;
            }
        } catch (err) {}
    }

    function syncCollection(items, mode) {
        if (!items) {
            return;
        }
        for (var i = 0; i < items.length; i++) {
            syncItem(items[i], mode);
        }
    }

    function syncPath(pathItem, mode) {
        if (!pathItem.filled || !pathItem.stroked) {
            return;
        }
        if (mode === "fillToStroke") {
            if (hasRealColor(pathItem.fillColor) && hasRealColor(pathItem.strokeColor)) {
                pathItem.strokeColor = cloneColor(pathItem.fillColor);
            }
        } else {
            if (hasRealColor(pathItem.fillColor) && hasRealColor(pathItem.strokeColor)) {
                pathItem.fillColor = cloneColor(pathItem.strokeColor);
            }
        }
    }

    function syncTextFrame(textFrame, mode) {
        var chars = textFrame.textRange.characters;
        for (var i = 0; i < chars.length; i++) {
            syncTextRange(chars[i], mode);
        }
    }

    function syncTextRange(textRange, mode) {
        var attrs = textRange.characterAttributes;
        if (!attrs) {
            return;
        }
        if (mode === "fillToStroke") {
            if (hasRealColor(attrs.fillColor) && hasRealColor(attrs.strokeColor)) {
                attrs.strokeColor = cloneColor(attrs.fillColor);
            }
        } else {
            if (hasRealColor(attrs.fillColor) && hasRealColor(attrs.strokeColor)) {
                attrs.fillColor = cloneColor(attrs.strokeColor);
            }
        }
    }

    function hasRealColor(color) {
        return color && color.typename && color.typename !== "NoColor";
    }

    function cloneColor(color) {
        if (!color || !color.typename) {
            return color;
        }

        var next;
        switch (color.typename) {
            case "RGBColor":
                next = new RGBColor();
                next.red = color.red;
                next.green = color.green;
                next.blue = color.blue;
                return next;
            case "CMYKColor":
                next = new CMYKColor();
                next.cyan = color.cyan;
                next.magenta = color.magenta;
                next.yellow = color.yellow;
                next.black = color.black;
                return next;
            case "GrayColor":
                next = new GrayColor();
                next.gray = color.gray;
                return next;
            case "SpotColor":
                next = new SpotColor();
                next.spot = color.spot;
                next.tint = color.tint;
                return next;
            default:
                return color;
        }
    }
})();
