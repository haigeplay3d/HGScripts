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

