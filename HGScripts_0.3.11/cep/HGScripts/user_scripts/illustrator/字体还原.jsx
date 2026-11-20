#target illustrator

// 字体还原.jsx — 读取「选择文字转曲」留在轮廓组 note 里的字体信息，重建可编辑文字。
// 原轮廓组保留不动，新文字放在它前面同一位置；已还原过的组幂等跳过。

(function () {
    var libRoot = new File($.fileName).parent;
    $.evalFile(new File(libRoot.fsName + "/../../assets/jsx/illustrator_lib/HGFontNote.jsx"));
    var HGFN = $.global.HGFontNote;

    if (!app.documents.length) {
        return;
    }

    var doc = app.activeDocument;
    var selectedItems = getSelectedItems(doc);
    var hasSelection = selectedItems.length > 0;

    var targets = hasSelection ? collectMarkedFromItems(selectedItems) : collectMarked(doc);
    if (targets.length === 0) {
        return;
    }

    var restored = 0;
    var already = 0;
    var failed = 0;
    var missingFonts = {};

    for (var i = 0; i < targets.length; i++) {
        var item = targets[i];

        if (HGFN.isRestored(item)) {
            already++;
            continue;
        }

        var info = HGFN.read(item);
        if (!info) {
            failed++;
            continue;
        }

        var font = null;
        if (info.font) {
            try {
                font = app.textFonts.getByName(info.font);
            } catch (eFont) {
                font = null;
            }
            if (!font) {
                missingFonts[info.font] = true;
                continue;
            }
        }

        var tf = createText(doc, item, info, font);
        if (tf) {
            HGFN.markRestored(item);
            restored++;
        } else {
            failed++;
        }
    }

    var missingList = [];
    for (var name in missingFonts) {
        if (missingFonts.hasOwnProperty(name)) missingList.push(name);
    }

    // 尽量不弹窗：全部顺利还原时静默；有缺字体或失败才汇总一次
    if (missingList.length > 0 || failed > 0) {
        var msg = [];
        if (restored > 0) msg.push("已还原 " + restored + " 处文字。");
        if (missingList.length > 0) {
            msg.push("本机缺少以下字体，对应轮廓未还原：\n" + missingList.join("\n"));
        }
        if (failed > 0) msg.push(failed + " 处还原失败（留痕信息损坏或对象异常）。");
        alert(msg.join("\n\n"));
    }

    function createText(doc, source, info, font) {
        try {
            var bounds = null;
            try { bounds = source.visibleBounds; } catch (e0) {}

            var tf = null;
            if (info.kind === "area" && bounds) {
                var w = Math.max(bounds[2] - bounds[0], 1);
                var h = Math.max(bounds[1] - bounds[3], 1);
                var layer = null;
                try { layer = source.layer; } catch (e1) {}
                if (!layer) layer = doc.activeLayer;
                var rect = layer.pathItems.rectangle(bounds[1], bounds[0], w, h);
                tf = doc.textFrames.areaText(rect);
            } else {
                // point；path 文字的原路径已转曲不可恢复，回落为点文字
                tf = doc.textFrames.add();
            }

            try { tf.contents = info.contents || ""; } catch (e2) {}

            applyStyle(tf, info, font);

            if (bounds) {
                try { tf.position = [bounds[0], bounds[1]]; } catch (e3) {}
            }

            try { tf.move(source, ElementPlacement.PLACEBEFORE); } catch (e4) {}

            return tf;
        } catch (e) {
            return null;
        }
    }

    function applyStyle(tf, info, font) {
        var attrs = null;
        try { attrs = tf.textRange.characterAttributes; } catch (e0) { return; }
        if (!attrs) return;

        if (font) {
            try { attrs.textFont = font; } catch (e1) {}
        }
        if (info.size > 0) {
            try { attrs.size = info.size; } catch (e2) {}
        }

        var color = parseColor(info.fill);
        if (color) {
            try { attrs.fillColor = color; } catch (e3) {}
        }
    }

    function parseColor(fill) {
        if (!fill) return null;
        var parts = String(fill).split(",");
        var type = parts[0];
        try {
            if (type === "CMYK" && parts.length === 5) {
                var c = new CMYKColor();
                c.cyan = parseFloat(parts[1]);
                c.magenta = parseFloat(parts[2]);
                c.yellow = parseFloat(parts[3]);
                c.black = parseFloat(parts[4]);
                return c;
            }
            if (type === "RGB" && parts.length === 4) {
                var r = new RGBColor();
                r.red = parseFloat(parts[1]);
                r.green = parseFloat(parts[2]);
                r.blue = parseFloat(parts[3]);
                return r;
            }
            if (type === "Gray" && parts.length === 2) {
                var g = new GrayColor();
                g.gray = parseFloat(parts[1]);
                return g;
            }
            if (type === "Spot" && parts.length >= 2) {
                var s = new SpotColor();
                s.spot = app.activeDocument.spots.getByName(parts.slice(1).join(","));
                return s;
            }
            if (type === "None") {
                return new NoColor();
            }
        } catch (e) {}
        return null;
    }

    function getSelectedItems(doc) {
        var result = [];
        var selection = null;
        try {
            selection = doc.selection;
        } catch (e) {
            return result;
        }
        if (!selection) return result;

        for (var i = 0; i < selection.length; i++) {
            try {
                if (selection[i]) result.push(selection[i]);
            } catch (e2) {}
        }
        return result;
    }

    function collectMarked(doc) {
        var result = [];
        collectFrom(doc, result);
        return result;
    }

    function collectMarkedFromItems(items) {
        var result = [];
        for (var i = 0; i < items.length; i++) {
            pushMarked(items[i], result);
        }
        return result;
    }

    function collectFrom(container, result) {
        var items = null;
        try {
            items = container.pageItems;
        } catch (e) {
            return;
        }
        if (!items) return;

        for (var i = 0; i < items.length; i++) {
            var item = null;
            try {
                item = items[i];
            } catch (e0) {
                continue;
            }
            pushMarked(item, result);
        }
    }

    function pushMarked(item, result) {
        if (!item || shouldSkip(item)) return;

        if (HGFN.has(item)) {
            result.push(item);
        }

        var type = getItemType(item);
        if (type === "GroupItem") {
            collectFrom(item, result);
        }
    }

    function shouldSkip(item) {
        try {
            if (!item || item.locked || item.hidden || item.guides) return true;
            if (item.layer && (item.layer.locked || !item.layer.visible)) return true;

            var parent = item.parent;
            while (parent && parent !== app && parent.typename !== "Document") {
                if (parent.locked === true || parent.hidden === true) return true;
                if (parent.typename === "Layer" && (parent.locked || !parent.visible)) return true;
                parent = parent.parent;
            }
        } catch (e) {
            return true;
        }
        return false;
    }

    function getItemType(item) {
        try {
            return item.typename || "Unknown";
        } catch (e) {
            return "Unknown";
        }
    }

})();
