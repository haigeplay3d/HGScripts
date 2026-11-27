#target illustrator

$.global.HGColorTools = $.global.HGColorTools || {};
var HGColorTools = $.global.HGColorTools;

HGColorTools.getCppMode = function () {
    try {
        if ($.global && typeof $.global.HGSCRIPTS_CPP_MODE !== "undefined") {
            var globalMode = String($.global.HGSCRIPTS_CPP_MODE).toLowerCase();
            if (globalMode === "cpp" || globalMode === "jsx") return globalMode;
        }
        if (typeof HGSCRIPTS_CPP_MODE !== "undefined") {
            var mode = String(HGSCRIPTS_CPP_MODE).toLowerCase();
            if (mode === "cpp" || mode === "jsx") return mode;
        }
    } catch (e) {}
    return "auto";
};

HGColorTools.tryCppCommand = function (command) {
    if (HGColorTools.getCppMode() === "jsx") {
        return false;
    }

    try {
        app.executeMenuCommand(command);
        return true;
    } catch (e) {
        return false;
    }
};

// 往面板状态栏写一条过程提示（run_hint.json）。纯辅助：写失败静默，不影响主流程。
HGColorTools.setStatusHint = function (text, level) {
    var runId = "";
    var hintPath = "";
    var dbg = [];
    try {
        if ($.global && typeof $.global.HGSCRIPTS_RUN_ID !== "undefined") {
            runId = String($.global.HGSCRIPTS_RUN_ID);
        }
        dbg.push("runId=[" + runId + "]");
        if (!runId) return;

        if ($.global && typeof $.global.HGSCRIPTS_RUN_HINT_PATH !== "undefined") {
            hintPath = String($.global.HGSCRIPTS_RUN_HINT_PATH);
        }
        dbg.push("hintPath=[" + hintPath + "]");
        if (!hintPath) return;

        var file = new File(hintPath);
        file.encoding = "UTF-8";
        if (!file.open("w")) {
            dbg.push("open FAILED err=" + file.error);
            return;
        }

        var hint = {
            runId: runId,
            level: level || "info",
            text: text || "",
            updatedAt: new Date().getTime()
        };
        var json = "";
        if (typeof JSON !== "undefined" && JSON.stringify) {
            json = JSON.stringify(hint);
        } else {
            function escHint(v) {
                return String(v)
                    .replace(/\\/g, "\\\\")
                    .replace(/"/g, "\\\"")
                    .replace(/\r/g, "\\r")
                    .replace(/\n/g, "\\n");
            }
            json = "{\"runId\":\"" + escHint(hint.runId) + "\",\"level\":\"" + escHint(hint.level) + "\",\"text\":\"" + escHint(hint.text) + "\",\"updatedAt\":" + hint.updatedAt + "}";
        }
        file.write(json);
        file.close();
        dbg.push("OK text=[" + (text || "") + "]");
    } catch (e) {
        dbg.push("EXC " + e);
    } finally {
        try {
            var dir = hintPath ? (new File(hintPath)).parent.fsName : "";
            if (!dir) dir = Folder.temp.fsName;
            var lf = new File(dir + "/hint_debug.log");
            lf.encoding = "UTF-8";
            if (lf.open("a")) {
                lf.writeln(new Date().toString() + " | " + dbg.join(" | "));
                lf.close();
            }
        } catch (e2) {}
    }
};

