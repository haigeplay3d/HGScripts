#target illustrator

// HGFontNote.jsx — 转曲留痕共用库（Trae CN 维护）
// 契约：note 单行 `__hg_orig={"v":1,"font":"主字体全名","fonts":["..."],"size":12.0,
//       "contents":"原文","fill":"CMYK,c,m,y,k|RGB,r,g,b|Gray,g|Spot,name|None","kind":"point|area|path"}`
// 多行 note 以 \n 分隔；写入幂等（已含 __hg_orig= 行则跳过）。
// 还原完成后追加 `__hg_restored=1` 行，幂等跳过。
// JSX 与 C++ 共用同一契约；C++ 侧见 HGAllTextToOutlinesCommand.cpp。

$.global.HGFontNote = $.global.HGFontNote || (function () {
    var NOTE_KEY = "__hg_orig=";
    var RESTORED_KEY = "__hg_restored=";

    function getNote(item) {
        try {
            return item.note || "";
        } catch (e) {
            return "";
        }
    }

    function findLine(note, key) {
        if (!note) return null;
        var lines = String(note).split("\n");
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.length >= key.length && line.substring(0, key.length) === key) {
                return line.substring(key.length);
            }
        }
        return null;
    }

    function appendLine(item, line) {
        var note = getNote(item);
        item.note = note ? note + "\n" + line : line;
    }

    function has(item) {
        return findLine(getNote(item), NOTE_KEY) !== null;
    }

    function read(item) {
        var payload = findLine(getNote(item), NOTE_KEY);
        if (payload === null) return null;
        try {
            var obj = eval("(" + payload + ")");
            if (obj && obj.v === 1) return obj;
        } catch (e) {}
        return null;
    }

    function isRestored(item) {
        return findLine(getNote(item), RESTORED_KEY) !== null;
    }

    function markRestored(item) {
        if (!item || isRestored(item)) return false;
        try {
            appendLine(item, RESTORED_KEY + "1");
            return true;
        } catch (e) {
            return false;
        }
    }

    function quote(s) {
        return "\"" + String(s)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n") + "\"";
    }

    function toJSON(obj) {
        var parts = [];
        for (var k in obj) {
            if (!obj.hasOwnProperty(k)) continue;
            var v = obj[k];
            if (v === null || v === undefined) continue;
            var val;
            if (typeof v === "number") {
                val = String(v);
            } else if (v instanceof Array) {
                var arr = [];
                for (var i = 0; i < v.length; i++) arr.push(quote(v[i]));
                val = "[" + arr.join(",") + "]";
            } else {
                val = quote(v);
            }
            parts.push(quote(k) + ":" + val);
        }
        return "{" + parts.join(",") + "}";
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    function serializeColor(c) {
        if (!c) return "";
        var t = "";
        try { t = c.typename; } catch (e) { return ""; }
        try {
            if (t === "CMYKColor") {
                return "CMYK," + round2(c.cyan) + "," + round2(c.magenta) + "," + round2(c.yellow) + "," + round2(c.black);
            }
            if (t === "RGBColor") {
                return "RGB," + round2(c.red) + "," + round2(c.green) + "," + round2(c.blue);
            }
            if (t === "GrayColor") {
                return "Gray," + round2(c.gray);
            }
            if (t === "SpotColor") {
                return "Spot," + c.spot.name;
            }
            if (t === "NoColor") {
                return "None";
            }
        } catch (e2) {
            return "";
        }
        return t || "";
    }

    // 从 TextFrame 捕获留痕信息；失败返回 null（不影响转曲主流程）
    function capture(frame) {
        try {
            var info = { v: 1 };

            try {
                info.contents = String(frame.contents || "");
            } catch (e0) {
                info.contents = "";
            }

            var kind = "point";
            try {
                if (frame.kind === TextType.AREATEXT) kind = "area";
                else if (frame.kind === TextType.PATHTEXT) kind = "path";
            } catch (e1) {}
            info.kind = kind;

            var fonts = [];
            var seen = {};
            try {
                var ranges = frame.textRanges;
                for (var i = 0; i < ranges.length; i++) {
                    try {
                        var fn = ranges[i].characterAttributes.textFont.name;
                        if (fn && !seen[fn]) {
                            seen[fn] = true;
                            fonts.push(fn);
                        }
                    } catch (e2) {}
                }
            } catch (e3) {}

            var attrs = frame.textRange.characterAttributes;

            var mainFont = "";
            try { mainFont = attrs.textFont.name; } catch (e4) {}
            if (!mainFont && fonts.length) mainFont = fonts[0];
            if (mainFont && !seen[mainFont]) {
                fonts.splice(0, 0, mainFont);
                seen[mainFont] = true;
            }
            info.font = mainFont;
            info.fonts = fonts;

            try { info.size = attrs.size; } catch (e5) { info.size = 0; }

            var fill = "";
            try { fill = serializeColor(attrs.fillColor); } catch (e6) {}
            if (fill) info.fill = fill;

            return info;
        } catch (e) {
            return null;
        }
    }

    function buildLine(info) {
        return NOTE_KEY + toJSON(info);
    }

    // 幂等写入；返回是否成功（已存在也视为成功）
    function write(item, info) {
        if (!item || !info) return false;
        if (has(item)) return true;
        try {
            appendLine(item, buildLine(info));
            return true;
        } catch (e) {
            return false;
        }
    }

    return {
        NOTE_KEY: NOTE_KEY,
        RESTORED_KEY: RESTORED_KEY,
        has: has,
        read: read,
        capture: capture,
        write: write,
        isRestored: isRestored,
        markRestored: markRestored,
        serializeColor: serializeColor
    };
})();
