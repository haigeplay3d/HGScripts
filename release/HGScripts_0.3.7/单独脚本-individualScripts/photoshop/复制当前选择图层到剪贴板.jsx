#target photoshop

(function () {
    var SCRIPT_NAME = "复制当前选择图层到剪贴板";
    var SLOW_THRESHOLD_MS = 700;

    function c2t(name) {
        return charIDToTypeID(name);
    }

    function pad2(value) {
        return value < 10 ? "0" + value : String(value);
    }

    function formatDate(date) {
        return date.getFullYear() + "-" +
            pad2(date.getMonth() + 1) + "-" +
            pad2(date.getDate()) + " " +
            pad2(date.getHours()) + ":" +
            pad2(date.getMinutes()) + ":" +
            pad2(date.getSeconds());
    }

    function writeLog(message) {
        try {
            var root = new Folder(Folder.userData.fsName + "/HGScripts/logs/photoshop");
            if (!root.exists) {
                root.create();
            }
            var file = new File(root.fsName + "/" + SCRIPT_NAME + ".log");
            file.encoding = "UTF-8";
            if (file.open("a")) {
                file.writeln("[" + formatDate(new Date()) + "] " + message);
                file.close();
            }
        } catch (ignore) {
        }
    }

    function selectAllFast() {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        ref.putProperty(c2t("Chnl"), c2t("fsel"));
        desc.putReference(c2t("null"), ref);
        desc.putEnumerated(c2t("T   "), c2t("Ordn"), c2t("Al  "));
        executeAction(c2t("setd"), desc, DialogModes.NO);
    }

    function deselectFast() {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        ref.putProperty(c2t("Chnl"), c2t("fsel"));
        desc.putReference(c2t("null"), ref);
        desc.putEnumerated(c2t("T   "), c2t("Ordn"), c2t("None"));
        executeAction(c2t("setd"), desc, DialogModes.NO);
    }

    function copyFast() {
        executeAction(c2t("copy"), undefined, DialogModes.NO);
    }

    function run() {
        if (!app.documents.length) {
            return;
        }

        var startedAt = new Date().getTime();

        try {
            selectAllFast();
            copyFast();
            deselectFast();
        } catch (err) {
            try {
                deselectFast();
            } catch (ignoreDeselect) {
            }
            writeLog("Failed. Method: actionManagerDirect, elapsedMs: " +
                (new Date().getTime() - startedAt) + ", error: " + err);
            return;
        }

        var elapsed = new Date().getTime() - startedAt;
        if (elapsed >= SLOW_THRESHOLD_MS) {
            writeLog("Slow. Method: actionManagerDirect, elapsedMs: " + elapsed + ".");
        }
    }

    run();
})();
