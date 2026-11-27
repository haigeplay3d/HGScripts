// HGScriptUITheme.jsx
// Shared dark + green ScriptUI theme for HGScripts JSX dialogs/palettes.
// Palette mirrors native/aip/HGUITheme.h so JSX and C++ windows share one look.
// Load with $.evalFile then call $.global.HGScriptUITheme.apply(win).
//
// Windows note: ScriptUI buttons are painted by the OS chrome, so they cannot be
// reliably recolored to green here. Only text/edit/panel fills + fonts are themed
// (E24 borderless rule applies to the AIP native layer, not ScriptUI buttons).
// ASCII only: this file is evalFile'd by ExtendScript; keep it BOM-free.

(function () {
    // Colors as 0..1 RGBA, matching HGUITheme.h:
    var BG     = [0.2588, 0.2588, 0.2588, 1]; // #424242 window background
    var PANEL  = [0.2980, 0.2980, 0.2980, 1]; // #4c4c4c card / panel
    var FIELD  = [0.2196, 0.2196, 0.2196, 1]; // #383838 input field
    var TEXT   = [0.9569, 0.9569, 0.9569, 1]; // #f4f4f4 text
    var ACCENT = [0.3373, 0.7255, 0.5098, 1]; // #56b982 green
    var FONT_NAME = "Microsoft YaHei UI";

    var cachedFont = null;
    function getFont() {
        if (cachedFont) return cachedFont;
        try {
            cachedFont = ScriptUI.newFont(FONT_NAME, "regular", 12);
        } catch (e1) {
            try {
                cachedFont = ScriptUI.newFont("Microsoft YaHei", "regular", 12);
            } catch (e2) {
                cachedFont = null;
            }
        }
        return cachedFont;
    }

    function paint(control, bgColor, fgColor) {
        try {
            if (bgColor) {
                control.graphics.backgroundColor =
                    control.graphics.newBrush(control.graphics.BrushType.SOLID_COLOR, bgColor);
            }
        } catch (e) {}
        try {
            if (fgColor) {
                control.graphics.foregroundColor =
                    control.graphics.newPen(control.graphics.PenType.SOLID_COLOR, fgColor, 1);
            }
        } catch (e) {}
    }

    function setFont(control) {
        var f = getFont();
        if (!f) return;
        try { control.font = f; } catch (e) {}
    }

    function walk(control) {
        try {
            var children = control.children;
            if (!children) return;
            for (var i = 0; i < children.length; i++) {
                var ch = children[i];
                try {
                    var t = ch.type;
                    var customDrawn = (typeof ch.onDraw === "function");
                    if (!customDrawn) {
                        if (t === "statictext" || t === "checkbox" ||
                                t === "radiobutton" || t === "dropdownlist" || t === "listbox") {
                            paint(ch, PANEL, TEXT);
                            setFont(ch);
                        } else if (t === "edittext") {
                            paint(ch, FIELD, TEXT);
                            setFont(ch);
                        } else if (t === "panel" || t === "tabbedpanel" || t === "tab") {
                            paint(ch, PANEL, TEXT);
                        }
                        // button / iconbutton: OS chrome draws these; leave as-is.
                    } else {
                        // Custom-drawn control keeps its own look; still recurse children.
                        setFont(ch);
                    }
                } catch (e) {}
                walk(ch);
            }
        } catch (e) {}
    }

    function apply(win) {
        if (!win) return;
        try { paint(win, BG, TEXT); } catch (e) {}
        walk(win);
    }

    $.global.HGScriptUITheme = {
        apply: apply,
        ACCENT: ACCENT,
        TEXT: TEXT,
        MUTED: [0.7490, 0.7490, 0.7490, 1],
        BG: BG
    };
})();
