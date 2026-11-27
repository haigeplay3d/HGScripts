function main() {
    if (app.documents.length === 0) {
        alert("\u8bf7\u5148\u6253\u5f00\u4e00\u4e2a Illustrator \u6587\u6863");
        return;
    }

    var raw = prompt("\u8bf7\u8f93\u5165 UPC-A \u6570\u5b57\uff0811 \u6216 12 \u4f4d\uff09", "036000291452");
    if (raw === null) return;

    raw = String(raw).replace(/\s+/g, "");
    if (!/^\d{11,12}$/.test(raw)) {
        alert("\u8f93\u5165\u5fc5\u987b\u662f 11 \u6216 12 \u4f4d\u6570\u5b57");
        return;
    }

    var upc = normalizeUPC(raw);
    if (!upc) {
        alert("\u6821\u9a8c\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u8f93\u5165");
        return;
    }

    var moduleWidth = readPositiveNumber(
        "\u8bf7\u8f93\u5165\u6700\u5c0f\u6761\u5bbd\uff08pt\uff09",
        "1"
    );
    if (moduleWidth === null) return;

    var barHeight = readPositiveNumber(
        "\u8bf7\u8f93\u5165\u6761\u7801\u9ad8\u5ea6\uff08pt\uff09",
        "72"
    );
    if (barHeight === null) return;

    var doc = app.activeDocument;
    var artIdx = doc.artboards.getActiveArtboardIndex();
    var ab = doc.artboards[artIdx];
    var rect = ab.artboardRect;
    var artCenterX = (rect[0] + rect[2]) / 2;
    var artCenterY = (rect[1] + rect[3]) / 2;

    var pattern = buildPattern(upc);
    var totalWidth = pattern.length * moduleWidth;
    var startLeft = artCenterX - totalWidth / 2;
    var topY = artCenterY + barHeight / 2;
    var guardExtra = Math.max(8, barHeight * 0.12);

    var group = doc.groupItems.add();
    group.name = "UPC-A " + upc;

    var black = new RGBColor();
    black.red = 0;
    black.green = 0;
    black.blue = 0;

    drawBars(doc, group, pattern, startLeft, topY, moduleWidth, barHeight, guardExtra, black);
    drawDigits(doc, group, upc, startLeft, topY, moduleWidth, barHeight, guardExtra);
}

function readPositiveNumber(message, defaultValue) {
    var input = prompt(message, defaultValue);
    if (input === null) return null;

    var value = parseFloat(String(input).replace(/,/g, "."));
    if (!(value > 0)) {
        alert("\u5fc5\u987b\u8f93\u5165\u5927\u4e8e 0 \u7684\u6570\u503c");
        return null;
    }

    return value;
}

function normalizeUPC(input) {
    if (!/^\d{11,12}$/.test(input)) return null;

    if (input.length === 11) {
        return input + String(calcCheckDigit(input));
    }

    var body = input.slice(0, 11);
    var expect = calcCheckDigit(body);
    return body + String(expect);
}

function calcCheckDigit(s11) {
    var sumOdd = 0;
    var sumEven = 0;

    for (var i = 0; i < 11; i++) {
        var digit = parseInt(s11.charAt(i), 10);
        if ((i % 2) === 0) {
            sumOdd += digit;
        } else {
            sumEven += digit;
        }
    }

    var total = sumOdd * 3 + sumEven;
    return (10 - (total % 10)) % 10;
}

function buildPattern(upc) {
    var leftEncodings = [
        "0001101", "0011001", "0010011", "0111101", "0100011",
        "0110001", "0101111", "0111011", "0110111", "0001011"
    ];
    var rightEncodings = [
        "1110010", "1100110", "1101100", "1000010", "1011100",
        "1001110", "1010000", "1000100", "1001000", "1110100"
    ];

    var bits = repeat("0", 9) + "101";
    for (var i = 0; i < 6; i++) {
        bits += leftEncodings[parseInt(upc.charAt(i), 10)];
    }

    bits += "01010";
    for (var j = 6; j < 12; j++) {
        bits += rightEncodings[parseInt(upc.charAt(j), 10)];
    }

    return bits + "101" + repeat("0", 9);
}

function drawBars(doc, group, pattern, startLeft, topY, moduleWidth, barHeight, guardExtra, fillColor) {
    var leftGuardStart = 9;
    var leftGuardEnd = 12;
    var centerGuardStart = 54;
    var centerGuardEnd = 59;
    var rightGuardStart = 101;
    var rightGuardEnd = 104;

    var x = startLeft;
    for (var i = 0; i < pattern.length; i++) {
        if (pattern.charAt(i) === "1") {
            var height = barHeight;
            if ((i >= leftGuardStart && i < leftGuardEnd) ||
                (i >= centerGuardStart && i < centerGuardEnd) ||
                (i >= rightGuardStart && i < rightGuardEnd)) {
                height = barHeight + guardExtra;
            }

            var bar = doc.pathItems.rectangle(topY, x, moduleWidth, height);
            bar.filled = true;
            bar.fillColor = fillColor;
            bar.stroked = false;
            bar.moveToBeginning(group);
        }
        x += moduleWidth;
    }
}

function drawDigits(doc, group, upc, startLeft, topY, moduleWidth, barHeight, guardExtra) {
    var digitSize = Math.max(9, Math.min(12, barHeight * 0.14));
    var textTop = topY - barHeight - Math.max(2, moduleWidth * 1.5);
    var font = findBarcodeFont();

    addTextAtTopCenter(doc, group, upc.charAt(0), moduleX(startLeft, moduleWidth, 4.5), textTop, digitSize, font);
    addTextAtTopCenter(doc, group, upc.substr(1, 5), moduleX(startLeft, moduleWidth, 33), textTop, digitSize, font);
    addTextAtTopCenter(doc, group, upc.substr(6, 5), moduleX(startLeft, moduleWidth, 80), textTop, digitSize, font);
    addTextAtTopCenter(doc, group, upc.charAt(11), moduleX(startLeft, moduleWidth, 108.5), textTop, digitSize, font);
}

function moduleX(startLeft, moduleWidth, moduleIndex) {
    return startLeft + moduleIndex * moduleWidth;
}

function addTextAtTopCenter(doc, group, contents, targetCenterX, targetTopY, size, font) {
    var textFrame = doc.textFrames.add();
    textFrame.contents = contents;

    try {
        textFrame.textRange.characterAttributes.size = size;
        textFrame.textRange.paragraphAttributes.justification = Justification.CENTER;
        if (font) textFrame.textRange.characterAttributes.textFont = font;
    } catch (e) {}

    textFrame.position = [0, 0];
    centerTextByBounds(textFrame, targetCenterX, targetTopY);
    textFrame.moveToBeginning(group);
}

function centerTextByBounds(textFrame, targetCenterX, targetTopY) {
    try {
        var bounds = textFrame.visibleBounds;
        var currentCenterX = (bounds[0] + bounds[2]) / 2;
        var currentTopY = bounds[1];
        textFrame.translate(targetCenterX - currentCenterX, targetTopY - currentTopY);
    } catch (e1) {
        try {
            var fallbackBounds = textFrame.geometricBounds;
            var fallbackCenterX = (fallbackBounds[0] + fallbackBounds[2]) / 2;
            var fallbackTopY = fallbackBounds[1];
            textFrame.translate(targetCenterX - fallbackCenterX, targetTopY - fallbackTopY);
        } catch (e2) {
            textFrame.position = [targetCenterX, targetTopY];
        }
    }
}

function findBarcodeFont() {
    var names = [
        "OCR-B 10 BT",
        "OCR B Std",
        "OCRB",
        "OCR-B",
        "OCR-B-10-BT",
        "Courier New",
        "CourierStd",
        "Courier",
        "ArialMT",
        "MyriadPro-Regular"
    ];

    for (var i = 0; i < names.length; i++) {
        try {
            return app.textFonts.getByName(names[i]);
        } catch (e) {}
    }

    return null;
}

function repeat(ch, count) {
    var out = "";
    for (var i = 0; i < count; i++) {
        out += ch;
    }
    return out;
}

main();
