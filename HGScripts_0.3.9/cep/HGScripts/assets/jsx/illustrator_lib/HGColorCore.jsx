#target illustrator

$.global.HGColorTools = $.global.HGColorTools || {};
var HGColorTools = $.global.HGColorTools;

HGColorTools.makeRGB = function (r, g, b) {
    var color = new RGBColor();
    color.red = r;
    color.green = g;
    color.blue = b;
    return color;
};

HGColorTools.makeRGBFromNumber = function (value) {
    return HGColorTools.makeRGB((value >> 16) & 255, (value >> 8) & 255, value & 255);
};

HGColorTools.pickCustomColor = function () {
    if (typeof $ !== "undefined" && typeof $.colorPicker === "function") {
        var picked = $.colorPicker();
        if (picked === -1) return null;
        return HGColorTools.makeRGBFromNumber(picked);
    }
    return null;
};

HGColorTools.roundColor = function (value) {
    return Math.round(Number(value) * 1000) / 1000;
};

HGColorTools.colorToKey = function (color) {
    if (!color || !color.typename || color.typename === "NoColor") return null;
    if (color.typename === "RGBColor") {
        return "RGB|" + HGColorTools.roundColor(color.red) + "|" + HGColorTools.roundColor(color.green) + "|" + HGColorTools.roundColor(color.blue);
    }
    if (color.typename === "CMYKColor") {
        return "CMYK|" + HGColorTools.roundColor(color.cyan) + "|" + HGColorTools.roundColor(color.magenta) + "|" +
            HGColorTools.roundColor(color.yellow) + "|" + HGColorTools.roundColor(color.black);
    }
    if (color.typename === "GrayColor") {
        return "GRAY|" + HGColorTools.roundColor(color.gray);
    }
    if (color.typename === "SpotColor") {
        var spotName = color.spot ? color.spot.name : "";
        return "SPOT|" + spotName + "|" + HGColorTools.roundColor(color.tint);
    }
    if (color.typename === "GradientColor") {
        var gradientName = color.gradient ? color.gradient.name : "";
        return "GRADIENT|" + gradientName;
    }
    if (color.typename === "PatternColor") {
        var patternName = color.pattern ? color.pattern.name : "";
        return "PATTERN|" + patternName;
    }
    return null;
};

HGColorTools.makeEmptySignature = function () {
    return {
        empty: true,
        hasFill: false,
        fillKey: null,
        hasStroke: false,
        strokeKey: null
    };
};

HGColorTools.shouldSkip = function (item) {
    try {
        if (!item || item.locked || item.hidden || item.guides) return true;
        if (item.typename === "PlacedItem" || item.typename === "RasterItem" || item.typename === "SymbolItem") return true;

        var parent = item.parent;
        while (parent && parent !== app && parent.typename !== "Document") {
            if (parent.typename === "Layer" && (parent.locked || !parent.visible)) return true;
            parent = parent.parent;
        }
    } catch (e) {
        return true;
    }
    return false;
};

HGColorTools.getPathPaintSignature = function (item) {
    try {
        var fillKey = null;
        var strokeKey = null;
        if (item.filled && item.fillColor && item.fillColor.typename !== "NoColor") {
            fillKey = HGColorTools.colorToKey(item.fillColor);
        }
        if (item.stroked && item.strokeColor && item.strokeColor.typename !== "NoColor") {
            strokeKey = HGColorTools.colorToKey(item.strokeColor);
        }
        if (!fillKey && !strokeKey) return HGColorTools.makeEmptySignature();
        return {
            empty: false,
            hasFill: !!fillKey,
            fillKey: fillKey,
            hasStroke: !!strokeKey,
            strokeKey: strokeKey
        };
    } catch (e) {
        return null;
    }
};

HGColorTools.hasOwnPaint = function (item) {
    var signature = HGColorTools.getPathPaintSignature(item);
    return !!(signature && !signature.empty);
};

HGColorTools.findFirstPaintSignature = function (item) {
    if (HGColorTools.shouldSkip(item)) return null;
    try {
        if (item.typename === "GroupItem") {
            var ownGroupSignature = HGColorTools.getPathPaintSignature(item);
            if (ownGroupSignature && !ownGroupSignature.empty) return ownGroupSignature;
            for (var i = 0; i < item.pageItems.length; i++) {
                var groupSignature = HGColorTools.findFirstPaintSignature(item.pageItems[i]);
                if (groupSignature) return groupSignature;
            }
            return null;
        }
        if (item.typename === "CompoundPathItem") {
            var ownCompoundSignature = HGColorTools.getPathPaintSignature(item);
            if (ownCompoundSignature && !ownCompoundSignature.empty) return ownCompoundSignature;
            for (var j = 0; j < item.pathItems.length; j++) {
                var compoundSignature = HGColorTools.getPathPaintSignature(item.pathItems[j]);
                if (compoundSignature) return compoundSignature;
            }
            return null;
        }
        if (item.typename === "TextFrame") return HGColorTools.getTextPaintSignature(item);
        if (item.typename === "PathItem") return HGColorTools.getPathPaintSignature(item);
    } catch (e) {}
    return null;
};

HGColorTools.getSingleColorSampleKey = function (signature) {
    if (!signature || signature.empty) return null;
    if (signature.hasFill && signature.hasStroke) {
        return signature.fillKey === signature.strokeKey ? signature.fillKey : null;
    }
    return signature.fillKey || signature.strokeKey;
};

HGColorTools.isSamePaintSignature = function (a, b) {
    if (!a || !b) return false;
    if (a.empty || b.empty) return a.empty === b.empty;
    return a.hasFill === b.hasFill && a.fillKey === b.fillKey &&
        a.hasStroke === b.hasStroke && a.strokeKey === b.strokeKey;
};

HGColorTools.isLoosePaintSignatureMatch = function (target, sample) {
    if (!target || !sample) return false;
    if (sample.empty) return target.empty;
    if (sample.hasFill && sample.hasStroke && sample.fillKey !== sample.strokeKey) {
        return HGColorTools.isSamePaintSignature(target, sample);
    }
    return HGColorTools.targetHasOnlySampleColor(target, sample.fillKey || sample.strokeKey);
};

HGColorTools.targetHasOnlySampleColor = function (signature, sampleKey) {
    if (!signature || signature.empty || !sampleKey) return false;
    if (signature.hasFill && signature.fillKey !== sampleKey) return false;
    if (signature.hasStroke && signature.strokeKey !== sampleKey) return false;
    return signature.hasFill || signature.hasStroke;
};

HGColorTools.makeColorStats = function () {
    return {
        groups: 0,
        compounds: 0,
        paths: 0,
        textFrames: 0,
        fillSet: 0,
        strokeSet: 0,
        opacitySet: 0,
        appearanceTargets: 0,
        errors: 0
    };
};

HGColorTools.copySelection = function (selection) {
    var result = [];
    for (var i = 0; i < selection.length; i++) {
        result.push(selection[i]);
    }
    return result;
};

HGColorTools.restoreSelection = function (doc, items) {
    try {
        doc.selection = null;
        for (var i = 0; i < items.length; i++) {
            try {
                items[i].selected = true;
            } catch (e) {}
        }
    } catch (outer) {}
};

HGColorTools.resetOneOpacity = function (item, stats) {
    try {
        if (item && item.opacity !== undefined && item.opacity !== 100) {
            item.opacity = 100;
            if (stats) stats.opacitySet++;
        }
    } catch (e) {
        if (stats) stats.errors++;
    }
};

HGColorTools.isOpacityContainer = function (item) {
    try {
        return item &&
            (item.typename === "GroupItem" ||
                item.typename === "CompoundPathItem" ||
                item.typename === "PathItem" ||
                item.typename === "TextFrame");
    } catch (e) {
        return false;
    }
};

HGColorTools.resetOpacity = function (item, stats) {
    var current = item;
    var depth = 0;
    while (current && depth < 80) {
        if (HGColorTools.isOpacityContainer(current)) {
            HGColorTools.resetOneOpacity(current, stats);
        }

        try {
            current = current.parent;
        } catch (e) {
            break;
        }
        depth++;
    }
};

HGColorTools.hasExistingStrokeAppearance = function (item) {
    try {
        var width = Number(item.strokeWidth);
        if (isNaN(width) || !isFinite(width) || width <= 0) return false;
    } catch (widthError) {
        return false;
    }

    try {
        return item.strokeColor && item.strokeColor.typename !== "NoColor";
    } catch (colorError) {
        return false;
    }
};

HGColorTools.containsTextFrame = function (item, depth) {
    if (!item || depth > 80) return false;
    try {
        if (item.typename === "TextFrame") return true;
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                if (HGColorTools.containsTextFrame(item.pageItems[i], depth + 1)) return true;
            }
        }
    } catch (e) {}
    return false;
};

HGColorTools.readSelectionAppearance = function (doc, items) {
    var result = {
        hasFill: items.length > 0,
        hasStroke: false
    };

    if (items.length !== 1) return result;
    if (HGColorTools.containsTextFrame(items[0], 0)) return result;

    try {
        if (!doc.defaultStroked) return result;
    } catch (strokedError) {
        return result;
    }

    try {
        var width = Number(doc.defaultStrokeWidth);
        if (isNaN(width) || !isFinite(width) || width <= 0) return result;
    } catch (widthError) {
        return result;
    }

    try {
        if (!doc.defaultStrokeColor || doc.defaultStrokeColor.typename === "NoColor") return result;
    } catch (colorError) {
        return result;
    }

    result.hasStroke = true;
    return result;
};

HGColorTools.applySelectionAppearanceDefaults = function (doc, items, color, selectionAppearance, stats) {
    try {
        doc.selection = null;
        for (var i = 0; i < items.length; i++) {
            try {
                if (!items[i].locked && !items[i].hidden) {
                    items[i].selected = true;
                    stats.appearanceTargets++;
                    HGColorTools.resetOpacity(items[i], stats);
                }
            } catch (selectError) {
                stats.errors++;
            }
        }

        if (selectionAppearance.hasFill) {
            doc.defaultFilled = true;
            doc.defaultFillColor = color;
            stats.fillSet++;
        }
        if (selectionAppearance.hasStroke) {
            doc.defaultStroked = true;
            doc.defaultStrokeColor = color;
            stats.strokeSet++;
        }
    } catch (e) {
        stats.errors++;
    }
};

HGColorTools.applySelectedContainerAppearance = function (item, color, stats, depth) {
    if (!item || depth > 80 || HGColorTools.shouldSkip(item)) return;
    try {
        if (item.typename === "GroupItem" || item.typename === "CompoundPathItem") {
            try {
                item.fillColor = color;
                if (stats) stats.fillSet++;
                HGColorTools.resetOpacity(item, stats);
            } catch (fillError) {}

            try {
                if (HGColorTools.hasExistingStrokeAppearance(item)) {
                    item.strokeColor = color;
                    if (stats) stats.strokeSet++;
                    HGColorTools.resetOpacity(item, stats);
                }
            } catch (strokeError) {}
        }

        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                HGColorTools.applySelectedContainerAppearance(item.pageItems[i], color, stats, depth + 1);
            }
        } else if (item.typename === "CompoundPathItem") {
            for (var j = 0; j < item.pathItems.length; j++) {
                HGColorTools.applySelectedContainerAppearance(item.pathItems[j], color, stats, depth + 1);
            }
        }
    } catch (e) {
        if (stats) stats.errors++;
    }
};

HGColorTools.applySelectedToColor = function (doc, color, revision) {
    var originalSelection = HGColorTools.copySelection(doc.selection);
    var selectionAppearance = HGColorTools.readSelectionAppearance(doc, originalSelection);
    var stats = HGColorTools.makeColorStats();

    HGColorTools.applySelectionAppearanceDefaults(doc, originalSelection, color, selectionAppearance, stats);
    for (var i = 0; i < originalSelection.length; i++) {
        HGColorTools.applySelectedContainerAppearance(originalSelection[i], color, stats, 0);
        HGColorTools.applyColor(originalSelection[i], color, stats);
    }

    HGColorTools.restoreSelection(doc, originalSelection);
};

HGColorTools.expandSelectedAppearance = function (doc) {
    if (!doc || !doc.selection || doc.selection.length === 0) return [];

    var oldLevel = app.userInteractionLevel;
    try {
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
        app.executeMenuCommand("expandStyle");
        try {
            app.executeMenuCommand("outline");
        } catch (outlineError) {}
        try {
            app.executeMenuCommand("expandStyle");
        } catch (expandAgainError) {}
    } catch (e) {
    } finally {
        app.userInteractionLevel = oldLevel;
    }

    var afterSelection = HGColorTools.copySelection(doc.selection || []);
    return afterSelection;
};

HGColorTools.snapshotRasterItems = function (doc) {
    var items = [];
    if (!doc) return items;
    try {
        for (var i = 0; i < doc.pageItems.length; i++) {
            if (doc.pageItems[i] && doc.pageItems[i].typename === "RasterItem") {
                items.push(doc.pageItems[i]);
            }
        }
    } catch (e) {}
    return items;
};

HGColorTools.containsItemRef = function (items, item) {
    if (!items || !item) return false;
    for (var i = 0; i < items.length; i++) {
        try {
            if (items[i] === item) return true;
        } catch (e) {}
    }
    return false;
};

HGColorTools.hasVectorSibling = function (item) {
    if (!item) return false;
    try {
        var parent = item.parent;
        if (!parent || !parent.pageItems) return false;
        for (var i = 0; i < parent.pageItems.length; i++) {
            var sibling = parent.pageItems[i];
            if (!sibling || sibling === item) continue;
            if (sibling.typename === "PathItem" || sibling.typename === "CompoundPathItem" || sibling.typename === "TextFrame" || sibling.typename === "GroupItem") {
                return true;
            }
        }
    } catch (e) {}
    return false;
};

HGColorTools.removeGeneratedTransparentRasters = function (doc, originalRasters, stats) {
    if (!doc) return 0;
    var removed = 0;
    try {
        for (var i = doc.pageItems.length - 1; i >= 0; i--) {
            var item = doc.pageItems[i];
            if (!item || item.typename !== "RasterItem") continue;
            try {
                if (Number(item.opacity) >= 99.9) continue;
            } catch (opacityError) {}
            if (HGColorTools.containsItemRef(originalRasters, item) && !HGColorTools.hasVectorSibling(item)) continue;
            try {
                item.remove();
                removed++;
            } catch (removeError) {
                if (stats) stats.errors++;
            }
        }
    } catch (e) {
        if (stats) stats.errors++;
    }
    if (stats) stats.generatedRastersRemoved = (stats.generatedRastersRemoved || 0) + removed;
    return removed;
};

HGColorTools.expandSelectionThenApplySelectedToColor = function (doc, color, revision) {
    HGColorTools.expandSelectedAppearance(doc);
    if (!doc.selection || doc.selection.length === 0) {
        return;
    }
    HGColorTools.applySelectedToColor(doc, color, revision + "-expanded");
};

HGColorTools.applyColor = function (item, color, stats) {
    if (HGColorTools.shouldSkip(item)) return;
    try {
        if (item.typename === "GroupItem") {
            if (stats) stats.groups++;
            HGColorTools.applyOwnColor(item, color, stats);
            for (var i = 0; i < item.pageItems.length; i++) HGColorTools.applyColor(item.pageItems[i], color, stats);
            return;
        }
        if (item.typename === "CompoundPathItem") {
            if (stats) stats.compounds++;
            HGColorTools.applyOwnColor(item, color, stats);
            for (var j = 0; j < item.pathItems.length; j++) HGColorTools.applyColor(item.pathItems[j], color, stats);
            return;
        }
        if (item.typename === "TextFrame") {
            if (stats) stats.textFrames++;
            HGColorTools.applyColorToText(item, color);
            HGColorTools.resetOpacity(item, stats);
            return;
        }
        if (item.typename === "PathItem" && stats) stats.paths++;
        var changed = false;
        if (item.filled && item.fillColor && item.fillColor.typename !== "NoColor") {
            item.fillColor = color;
            changed = true;
            if (stats) stats.fillSet++;
        }
        if (item.stroked && item.strokeColor && item.strokeColor.typename !== "NoColor") {
            item.strokeColor = color;
            changed = true;
            if (stats) stats.strokeSet++;
        }
        if (changed) HGColorTools.resetOpacity(item, stats);
    } catch (e) {}
};

HGColorTools.applyOwnColor = function (item, color, stats) {
    var changed = false;
    try {
        if (item.filled && item.fillColor && item.fillColor.typename !== "NoColor") {
            item.fillColor = color;
            changed = true;
            if (stats) stats.fillSet++;
        }
    } catch (fillError) {}

    try {
        if (HGColorTools.hasExistingStrokeAppearance(item)) {
            item.strokeColor = color;
            changed = true;
            if (stats) stats.strokeSet++;
        }
    } catch (e) {}

    if (changed) HGColorTools.resetOpacity(item, stats);
};

HGColorTools.applyMatchedColor = function (item, sampleKey, matchedColor, otherColor, stats) {
    if (HGColorTools.shouldSkip(item)) return;
    try {
        if (item.typename === "GroupItem") {
            if (stats) stats.groups++;
            HGColorTools.applyOwnMatchedColor(item, sampleKey, matchedColor, otherColor, stats);
            for (var i = 0; i < item.pageItems.length; i++) HGColorTools.applyMatchedColor(item.pageItems[i], sampleKey, matchedColor, otherColor, stats);
            return;
        }
        if (item.typename === "CompoundPathItem") {
            if (stats) stats.compounds++;
            HGColorTools.applyOwnMatchedColor(item, sampleKey, matchedColor, otherColor, stats);
            for (var j = 0; j < item.pathItems.length; j++) HGColorTools.applyMatchedColor(item.pathItems[j], sampleKey, matchedColor, otherColor, stats);
            return;
        }
        if (item.typename === "TextFrame") {
            if (stats) stats.textFrames++;
            HGColorTools.applyMatchedColorToText(item, sampleKey, matchedColor, otherColor);
            HGColorTools.resetOpacity(item, stats);
            return;
        }
        if (item.typename === "PathItem" && stats) stats.paths++;
        var changed = false;
        if (item.filled && item.fillColor && item.fillColor.typename !== "NoColor") {
            item.fillColor = HGColorTools.colorToKey(item.fillColor) === sampleKey ? matchedColor : otherColor;
            changed = true;
            if (stats) stats.fillSet++;
        }
        if (item.stroked && item.strokeColor && item.strokeColor.typename !== "NoColor") {
            item.strokeColor = HGColorTools.colorToKey(item.strokeColor) === sampleKey ? matchedColor : otherColor;
            changed = true;
            if (stats) stats.strokeSet++;
        }
        if (changed) HGColorTools.resetOpacity(item, stats);
    } catch (e) {}
};

HGColorTools.applyOwnMatchedColor = function (item, sampleKey, matchedColor, otherColor, stats) {
    var changed = false;
    try {
        if (item.filled && item.fillColor && item.fillColor.typename !== "NoColor") {
            item.fillColor = HGColorTools.colorToKey(item.fillColor) === sampleKey ? matchedColor : otherColor;
            changed = true;
            if (stats) stats.fillSet++;
        }
        if (item.stroked && item.strokeColor && item.strokeColor.typename !== "NoColor") {
            item.strokeColor = HGColorTools.colorToKey(item.strokeColor) === sampleKey ? matchedColor : otherColor;
            changed = true;
            if (stats) stats.strokeSet++;
        }
    } catch (e) {}
    if (changed) HGColorTools.resetOpacity(item, stats);
};

HGColorTools.isClearlyUnavailable = function (item) {
    try {
        if (!item || item.locked || item.hidden || item.guides) return true;
        if (item.typename === "PlacedItem" || item.typename === "RasterItem" || item.typename === "SymbolItem") return true;
        var parent = item.parent;
        while (parent && parent !== app && parent.typename !== "Document") {
            try {
                if (parent.typename === "Layer" && (parent.locked || !parent.visible)) return true;
            } catch (parentError) {}
            parent = parent.parent;
        }
    } catch (e) {
        return false;
    }
    return false;
};

HGColorTools.applyMatchedColorVisibleFallback = function (item, sampleKey, matchedColor, otherColor, stats, depth) {
    if (!item || depth > 120 || HGColorTools.isClearlyUnavailable(item)) return;
    try {
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                HGColorTools.applyMatchedColorVisibleFallback(item.pageItems[i], sampleKey, matchedColor, otherColor, stats, depth + 1);
            }
            return;
        }
        if (item.typename === "CompoundPathItem") {
            for (var j = 0; j < item.pathItems.length; j++) {
                HGColorTools.applyMatchedColorVisibleFallback(item.pathItems[j], sampleKey, matchedColor, otherColor, stats, depth + 1);
            }
            return;
        }
        if (item.typename === "TextFrame") {
            HGColorTools.applyMatchedColorToText(item, sampleKey, matchedColor, otherColor);
            HGColorTools.resetOpacity(item, stats);
            return;
        }
        if (item.typename !== "PathItem") return;
        var changed = false;
        if (item.filled && item.fillColor && item.fillColor.typename !== "NoColor") {
            item.fillColor = HGColorTools.colorToKey(item.fillColor) === sampleKey ? matchedColor : otherColor;
            changed = true;
            if (stats) stats.fillSet++;
        }
        if (item.stroked && item.strokeColor && item.strokeColor.typename !== "NoColor") {
            item.strokeColor = HGColorTools.colorToKey(item.strokeColor) === sampleKey ? matchedColor : otherColor;
            changed = true;
            if (stats) stats.strokeSet++;
        }
        if (changed) HGColorTools.resetOpacity(item, stats);
    } catch (e) {
        if (stats) stats.errors++;
    }
};

HGColorTools.collectMatches = function (items, sample, mode, matches, seen, visited) {
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (HGColorTools.shouldSkip(item) || HGColorTools.markVisited(item, visited)) continue;
        try {
            if (item.typename === "GroupItem") {
                var groupSignature = HGColorTools.getPathPaintSignature(item);
                var groupOk = mode === "loose" ? HGColorTools.isLoosePaintSignatureMatch(groupSignature, sample) : HGColorTools.isSamePaintSignature(groupSignature, sample);
                if (groupOk) HGColorTools.pushUnique(item, matches, seen);
                HGColorTools.collectMatches(item.pageItems, sample, mode, matches, seen, visited);
            } else if (item.typename === "CompoundPathItem") {
                var compoundSignature = HGColorTools.getPathPaintSignature(item);
                var compoundOk = mode === "loose" ? HGColorTools.isLoosePaintSignatureMatch(compoundSignature, sample) : HGColorTools.isSamePaintSignature(compoundSignature, sample);
                if (compoundOk) HGColorTools.pushUnique(item, matches, seen);
                HGColorTools.collectMatches(item.pathItems, sample, mode, matches, seen, visited);
            } else {
                var signature = item.typename === "TextFrame" ? HGColorTools.getTextPaintSignature(item) : HGColorTools.getPathPaintSignature(item);
                var ok = mode === "loose" ? HGColorTools.isLoosePaintSignatureMatch(signature, sample) : HGColorTools.isSamePaintSignature(signature, sample);
                if (ok) HGColorTools.pushUnique(item, matches, seen);
            }
        } catch (e) {}
    }
};

HGColorTools.collectSingleColorMatches = function (items, sampleKey, matches, seen, visited) {
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (HGColorTools.shouldSkip(item) || HGColorTools.markVisited(item, visited)) continue;
        try {
            if (item.typename === "GroupItem") {
                if (HGColorTools.targetHasOnlySampleColor(HGColorTools.getPathPaintSignature(item), sampleKey)) HGColorTools.pushUnique(item, matches, seen);
                HGColorTools.collectSingleColorMatches(item.pageItems, sampleKey, matches, seen, visited);
            } else if (item.typename === "CompoundPathItem") {
                if (HGColorTools.targetHasOnlySampleColor(HGColorTools.getPathPaintSignature(item), sampleKey)) HGColorTools.pushUnique(item, matches, seen);
                HGColorTools.collectSingleColorMatches(item.pathItems, sampleKey, matches, seen, visited);
            } else {
                var signature = item.typename === "TextFrame" ? HGColorTools.getTextPaintSignature(item) : HGColorTools.getPathPaintSignature(item);
                if (HGColorTools.targetHasOnlySampleColor(signature, sampleKey)) HGColorTools.pushUnique(item, matches, seen);
            }
        } catch (e) {}
    }
};

HGColorTools.collectProcessable = function (item, out) {
    if (HGColorTools.shouldSkip(item)) return;
        try {
            if (item.typename === "GroupItem") {
                if (HGColorTools.hasOwnPaint(item)) out.push(item);
                for (var i = 0; i < item.pageItems.length; i++) HGColorTools.collectProcessable(item.pageItems[i], out);
                return;
            }
            if (item.typename === "CompoundPathItem") {
                if (HGColorTools.hasOwnPaint(item)) out.push(item);
                for (var j = 0; j < item.pathItems.length; j++) HGColorTools.collectProcessable(item.pathItems[j], out);
                return;
        }
        if (item.typename === "TextFrame" || item.typename === "PathItem") out.push(item);
    } catch (e) {}
};

HGColorTools.applySelectionMask = function (doc, selectedColor, otherColor) {
    var stats = HGColorTools.makeColorStats();
    var selectedItems = [];
    for (var i = 0; i < doc.selection.length; i++) HGColorTools.collectProcessable(doc.selection[i], selectedItems);
    var selectedMap = {};
    for (var j = 0; j < selectedItems.length; j++) selectedMap[HGColorTools.getItemKey(selectedItems[j])] = true;

    var artRect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
    for (var k = 0; k < doc.pageItems.length; k++) {
        HGColorTools.applyOtherColorInArtboard(doc.pageItems[k], artRect, selectedMap, otherColor, stats);
    }
    for (var n = 0; n < selectedItems.length; n++) HGColorTools.applyColor(selectedItems[n], selectedColor, stats);
};

HGColorTools.applyOtherColorInArtboard = function (item, artRect, selectedMap, otherColor, stats) {
    if (HGColorTools.shouldSkip(item)) return;
    try {
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) HGColorTools.applyOtherColorInArtboard(item.pageItems[i], artRect, selectedMap, otherColor, stats);
            return;
        }
        if (item.typename === "CompoundPathItem") {
            for (var j = 0; j < item.pathItems.length; j++) HGColorTools.applyOtherColorInArtboard(item.pathItems[j], artRect, selectedMap, otherColor, stats);
            return;
        }
        if (!HGColorTools.isItemCenterInArtboard(item, artRect)) return;
        if (selectedMap[HGColorTools.getItemKey(item)]) return;
        HGColorTools.applyColor(item, otherColor, stats);
    } catch (e) {}
};

HGColorTools.applySameMask = function (doc, sampleKey, matchedColor, otherColor) {
    var stats = HGColorTools.makeColorStats();
    var artRect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
    for (var i = 0; i < doc.pageItems.length; i++) {
        HGColorTools.applySameMaskInArtboard(doc.pageItems[i], artRect, sampleKey, matchedColor, otherColor, stats);
    }
};

HGColorTools.applySameMaskInArtboard = function (item, artRect, sampleKey, matchedColor, otherColor, stats) {
    if (HGColorTools.shouldSkip(item)) return;
    try {
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) HGColorTools.applySameMaskInArtboard(item.pageItems[i], artRect, sampleKey, matchedColor, otherColor, stats);
            return;
        }
        if (item.typename === "CompoundPathItem") {
            for (var j = 0; j < item.pathItems.length; j++) HGColorTools.applySameMaskInArtboard(item.pathItems[j], artRect, sampleKey, matchedColor, otherColor, stats);
            return;
        }
        if (!HGColorTools.isItemCenterInArtboard(item, artRect)) return;
        HGColorTools.applyMatchedColor(item, sampleKey, matchedColor, otherColor, stats);
    } catch (e) {}
};

HGColorTools.isItemCenterInArtboard = function (item, artRect) {
    try {
        var bounds = item.visibleBounds || item.geometricBounds;
        var cx = (bounds[0] + bounds[2]) / 2;
        var cy = (bounds[1] + bounds[3]) / 2;
        return cx >= artRect[0] && cx <= artRect[2] && cy <= artRect[1] && cy >= artRect[3];
    } catch (e) {
        return false;
    }
};

HGColorTools.markVisited = function (item, visited) {
    var key = HGColorTools.getItemKey(item);
    if (visited[key]) return true;
    visited[key] = true;
    return false;
};

HGColorTools.pushUnique = function (item, list, seen) {
    var key = HGColorTools.getItemKey(item);
    if (seen[key]) return;
    seen[key] = true;
    list.push(item);
};

HGColorTools.getItemKey = function (item) {
    try {
        return item.uuid || item.typename + "|" + item.name + "|" + item.geometricBounds.join(",");
    } catch (e) {
        return String(new Date().getTime()) + "|" + Math.random();
    }
};

HGColorTools.selectItems = function (doc, items) {
    try {
        doc.selection = null;
        doc.selection = items;
    } catch (e) {
        doc.selection = null;
        for (var i = 0; i < items.length; i++) {
            try {
                items[i].selected = true;
            } catch (inner) {}
        }
    }
};

