#target photoshop

(function () {
    var SCRIPT_NAME = "粘贴剪贴板到当前图层蒙版";
    var SLOW_THRESHOLD_MS = 900;

    function c2t(name) {
        return charIDToTypeID(name);
    }

    function s2t(name) {
        return stringIDToTypeID(name);
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

    function createRevealAllLayerMask() {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        desc.putClass(c2t("Nw  "), c2t("Chnl"));
        ref.putEnumerated(c2t("Chnl"), c2t("Chnl"), c2t("Msk "));
        desc.putReference(c2t("At  "), ref);
        desc.putEnumerated(c2t("Usng"), c2t("UsrM"), c2t("RvlA"));
        executeAction(c2t("Mk  "), desc, DialogModes.NO);
    }

    function tryCreateLayerMask() {
        try {
            createRevealAllLayerMask();
        } catch (ignoreExistingMask) {
        }
    }

    function selectLayerMaskChannel(makeVisible) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        ref.putEnumerated(c2t("Chnl"), c2t("Chnl"), c2t("Msk "));
        desc.putReference(c2t("null"), ref);
        desc.putBoolean(c2t("MkVs"), !!makeVisible);
        executeAction(c2t("slct"), desc, DialogModes.NO);
    }

    function pasteInPlaceFast() {
        var desc = new ActionDescriptor();

        desc.putBoolean(s2t("inPlace"), true);
        desc.putEnumerated(c2t("AntA"), c2t("Annt"), c2t("Anno"));
        executeAction(c2t("past"), desc, DialogModes.NO);
    }

    function deselectFast() {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        ref.putProperty(c2t("Chnl"), c2t("fsel"));
        desc.putReference(c2t("null"), ref);
        desc.putEnumerated(c2t("T   "), c2t("Ordn"), c2t("None"));
        executeAction(c2t("setd"), desc, DialogModes.NO);
    }

    function getCompositeChannelCharId() {
        try {
            if (app.activeDocument.mode === DocumentMode.CMYK) {
                return "CMYK";
            }
            if (app.activeDocument.mode === DocumentMode.GRAYSCALE) {
                return "Gry ";
            }
            if (app.activeDocument.mode === DocumentMode.LAB) {
                return "Lab ";
            }
        } catch (ignore) {
        }

        return "RGB ";
    }

    function selectCompositeChannel() {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        ref.putEnumerated(c2t("Chnl"), c2t("Chnl"), c2t(getCompositeChannelCharId()));
        desc.putReference(c2t("null"), ref);
        executeAction(c2t("slct"), desc, DialogModes.NO);
    }

    function run() {
        if (!app.documents.length) {
            return;
        }

        var startedAt = new Date().getTime();

        try {
            tryCreateLayerMask();
            selectLayerMaskChannel(true);
            pasteInPlaceFast();
            deselectFast();
            selectCompositeChannel();
        } catch (err) {
            try {
                deselectFast();
            } catch (ignoreDeselect) {
            }
            try {
                selectCompositeChannel();
            } catch (ignoreComposite) {
            }

            writeLog("Failed. Method: pasteClipboardToMask, elapsedMs: " +
                (new Date().getTime() - startedAt) + ", error: " + err);
            return;
        }

        var elapsed = new Date().getTime() - startedAt;
        if (elapsed >= SLOW_THRESHOLD_MS) {
            writeLog("Slow. Method: pasteClipboardToMask, elapsedMs: " + elapsed + ".");
        }
    }

    run();
})();
