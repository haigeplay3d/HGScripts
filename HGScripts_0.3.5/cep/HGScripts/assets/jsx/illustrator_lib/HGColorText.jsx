#target illustrator

$.global.HGColorTools = $.global.HGColorTools || {};
var HGColorTools = $.global.HGColorTools;

HGColorTools.getTextPaintSignature = function (textFrame) {
    try {
        var signature = null;
        var chars = textFrame.textRange.characters;

        if (chars && chars.length > 0) {
            for (var i = 0; i < chars.length; i++) {
                signature = HGColorTools.mergeTextRangeSignature(signature, chars[i]);
                if (signature === false) return null;
            }
        } else {
            signature = HGColorTools.mergeTextRangeSignature(signature, textFrame.textRange);
            if (signature === false) return null;
        }

        if (!signature || (!signature.fillKey && !signature.strokeKey)) {
            return HGColorTools.makeEmptySignature();
        }

        signature.empty = false;
        signature.hasFill = !!signature.fillKey;
        signature.hasStroke = !!signature.strokeKey;
        return signature;
    } catch (e) {
        return null;
    }
};

HGColorTools.mergeTextRangeSignature = function (signature, textRange) {
    try {
        var attrs = textRange.characterAttributes;
        var fillKey = HGColorTools.colorToKey(attrs.fillColor);
        var strokeKey = HGColorTools.colorToKey(attrs.strokeColor);

        if (!signature) {
            return {
                empty: true,
                hasFill: false,
                fillKey: fillKey,
                hasStroke: false,
                strokeKey: strokeKey
            };
        }

        if (signature.fillKey !== fillKey || signature.strokeKey !== strokeKey) {
            return false;
        }
        return signature;
    } catch (e) {
        return false;
    }
};

HGColorTools.applyColorToText = function (textFrame, color) {
    try {
        var chars = textFrame.textRange.characters;
        if (chars && chars.length > 0) {
            for (var i = 0; i < chars.length; i++) {
                HGColorTools.applyColorToTextRange(chars[i], color);
            }
            return;
        }
        HGColorTools.applyColorToTextRange(textFrame.textRange, color);
    } catch (e) {}
};

HGColorTools.applyColorToTextRange = function (textRange, color) {
    try {
        var attrs = textRange.characterAttributes;
        if (attrs.fillColor && attrs.fillColor.typename !== "NoColor") {
            attrs.fillColor = color;
        }
        if (attrs.strokeColor && attrs.strokeColor.typename !== "NoColor") {
            attrs.strokeColor = color;
        }
    } catch (e) {}
};

HGColorTools.applyMatchedColorToText = function (textFrame, sampleKey, matchedColor, otherColor) {
    try {
        var chars = textFrame.textRange.characters;
        if (chars && chars.length > 0) {
            for (var i = 0; i < chars.length; i++) {
                HGColorTools.applyMatchedColorToTextRange(chars[i], sampleKey, matchedColor, otherColor);
            }
            return;
        }
        HGColorTools.applyMatchedColorToTextRange(textFrame.textRange, sampleKey, matchedColor, otherColor);
    } catch (e) {}
};

HGColorTools.applyMatchedColorToTextRange = function (textRange, sampleKey, matchedColor, otherColor) {
    try {
        var attrs = textRange.characterAttributes;
        var fillKey = HGColorTools.colorToKey(attrs.fillColor);
        var strokeKey = HGColorTools.colorToKey(attrs.strokeColor);
        if (fillKey) attrs.fillColor = fillKey === sampleKey ? matchedColor : otherColor;
        if (strokeKey) attrs.strokeColor = strokeKey === sampleKey ? matchedColor : otherColor;
    } catch (e) {}
};

