#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGBasisScaleToWidth / HGBasisScaleToHeight / HGBasisScaleToSize

(function () {
    var SCRIPT_NAME = "手选基准缩放";
    var EPSILON = 0.01;

    if (!app.documents.length) {
        return;
    }

    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length !== 1) {
        return;
    }

    var selectionSnapshot = captureSelection(doc.selection);
    var basisItem = selectionSnapshot.length ? selectionSnapshot[0].item : doc.selection[0];
    if (!basisItem) {
        return;
    }

    var scriptedTargetRequest = getScriptedTargetRequest();
    if (!scriptedTargetRequest && getHGScriptsCppMode() !== "jsx") {
        if (tryRunCppPlugin("size")) {
            restoreSelection(doc, selectionSnapshot);
            return;
        }
    }

    var targetRequest = scriptedTargetRequest || showTargetDialog();
    if (!targetRequest) {
        return;
    }

    var basisBoundsBefore = getItemBounds(basisItem);
    if (!basisBoundsBefore) {
        return;
    }

    var scaleTarget = getTopmostParentGroup(basisItem);
    if (!scaleTarget) {
        scaleTarget = basisItem;
    }

    if (!canEdit(scaleTarget)) {
        return;
    }

    var targetSpec = resolveTargetSpec(targetRequest, basisBoundsBefore);
    if (!targetSpec || !(targetSpec.scaleXPercent > EPSILON) || !(targetSpec.scaleYPercent > EPSILON)) {
        return;
    }

    if (writeBasisScaleTarget(targetSpec) && tryRunCppPlugin(targetSpec.axis)) {
        restoreBasisCenter(scaleTarget, basisItem, basisBoundsBefore);
        restoreSelection(doc, selectionSnapshot);
        return;
    }

    clearBasisScaleTargetFiles();
    if (!resizeWholeTarget(doc, selectionSnapshot, scaleTarget, basisItem, basisBoundsBefore, targetSpec.scaleXPercent, targetSpec.scaleYPercent)) {
        return;
    }


    function resizeWholeTarget(doc, selectionSnapshot, item, basisItem, basisBoundsBefore, scaleXPercent, scaleYPercent) {
        if (scaleByNativeAction(doc, selectionSnapshot, item, basisItem, basisBoundsBefore, scaleXPercent, scaleYPercent)) {
            return true;
        }

        var lineScalePercent = getLineScalePercent(scaleXPercent, scaleYPercent);
        try {
            item.resize(
                scaleXPercent,
                scaleYPercent,
                true,
                true,
                true,
                true,
                lineScalePercent,
                Transformation.CENTER
            );
            restoreBasisCenter(item, basisItem, basisBoundsBefore);
            restoreSelection(doc, selectionSnapshot);
            return true;
        } catch (e1) {
            try {
                item.resize(scaleXPercent, scaleYPercent);
                restoreBasisCenter(item, basisItem, basisBoundsBefore);
                restoreSelection(doc, selectionSnapshot);
                return true;
            } catch (e2) {
                return false;
            }
        }
    }

    function scaleByNativeAction(doc, selectionSnapshot, item, basisItem, basisBoundsBefore, scaleXPercent, scaleYPercent) {
        var oldInteractionLevel = null;
        var changedInteractionLevel = false;

        try {
            oldInteractionLevel = app.userInteractionLevel;
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
            changedInteractionLevel = true;

            doc.selection = null;
            item.selected = true;

            var actionSetName = "HGBasisScaleTempSet";
            var actionName = "HGBasisScale";
            runScaleAction(actionSetName, actionName, scaleXPercent, scaleYPercent);

            restoreBasisCenter(item, basisItem, basisBoundsBefore);
            restoreSelection(doc, selectionSnapshot);

            return true;
        } catch (e) {
            try {
                restoreSelection(doc, selectionSnapshot);
            } catch (restoreError) {}
            return false;
        } finally {
            if (changedInteractionLevel) {
                try {
                    app.userInteractionLevel = oldInteractionLevel;
                } catch (interactionError) {}
            }
        }
    }

    function runScaleAction(actionSetName, actionName, scaleXPercent, scaleYPercent) {
        var actionFile = null;
        try {
            try {
                app.unloadAction(actionSetName, "");
            } catch (unloadBeforeError) {}

            actionFile = File(Folder.temp + "/HGBasisScaleTempAction.aia");
            actionFile.encoding = "UTF-8";
            if (!actionFile.open("w")) {
                throw new Error("cannot open temp action file");
            }
            actionFile.write(buildScaleActionText(actionSetName, actionName, scaleXPercent, scaleYPercent));
            actionFile.close();

            app.loadAction(actionFile);
            app.doScript(actionName, actionSetName);
        } finally {
            try {
                app.unloadAction(actionSetName, "");
            } catch (unloadAfterError) {}

            if (actionFile) {
                try {
                    if (actionFile.exists) actionFile.remove();
                } catch (removeError) {}
            }
        }
    }

    function buildScaleActionText(actionSetName, actionName, scaleXPercent, scaleYPercent) {
        var percentXText = actionNumber(scaleXPercent);
        var percentYText = actionNumber(scaleYPercent);
        return [
            "/version 3",
            "/name [ " + actionSetName.length,
            "\t" + asciiHex(actionSetName),
            "]",
            "/isOpen 0",
            "/actionCount 1",
            "/action-1 {",
            "\t/name [ " + actionName.length,
            "\t\t" + asciiHex(actionName),
            "\t]",
            "\t/keyIndex 0",
            "\t/colorIndex 0",
            "\t/isOpen 0",
            "\t/eventCount 1",
            "\t/event-1 {",
            "\t\t/useRulersIn1stQuadrant 0",
            "\t\t/internalName (adobe_scale)",
            "\t\t/localizedName [ 5",
            "\t\t\t5363616c65",
            "\t\t]",
            "\t\t/isOpen 0",
            "\t\t/isOn 1",
            "\t\t/hasDialog 1",
            "\t\t/showDialog 0",
            "\t\t/parameterCount 5",
            "\t\t/parameter-1 {",
            "\t\t\t/key 1970169453",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (boolean)",
            "\t\t\t/value 0",
            "\t\t}",
            "\t\t/parameter-2 {",
            "\t\t\t/key 1818848869",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (boolean)",
            "\t\t\t/value 1",
            "\t\t}",
            "\t\t/parameter-3 {",
            "\t\t\t/key 1752136302",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (unit real)",
            "\t\t\t/value " + percentXText,
            "\t\t\t/unit 592474723",
            "\t\t}",
            "\t\t/parameter-4 {",
            "\t\t\t/key 1987339116",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (unit real)",
            "\t\t\t/value " + percentYText,
            "\t\t\t/unit 592474723",
            "\t\t}",
            "\t\t/parameter-5 {",
            "\t\t\t/key 1668247673",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (boolean)",
            "\t\t\t/value 0",
            "\t\t}",
            "\t}",
            "}"
        ].join("\n");
    }

    function selectionToArray(selection) {
        var result = [];
        try {
            if (!selection) return result;
            for (var i = 0; i < selection.length; i++) {
                result.push(selection[i]);
            }
        } catch (e) {}
        return result;
    }

    function captureSelection(selection) {
        var items = selectionToArray(selection);
        var result = [];
        for (var i = 0; i < items.length; i++) {
            result.push({
                item: items[i],
                uuid: getItemUuid(items[i])
            });
        }
        return result;
    }

    function getItemUuid(item) {
        try {
            if (item.uuid) return String(item.uuid);
        } catch (e) {}
        return "";
    }

    function resolveSelectionItems(doc, snapshot) {
        var result = [];
        for (var i = 0; i < snapshot.length; i++) {
            var item = null;
            var uuid = snapshot[i].uuid;

            if (uuid) {
                try {
                    if (doc.getPageItemFromUuid) {
                        item = doc.getPageItemFromUuid(uuid);
                    }
                } catch (uuidError) {
                    item = null;
                }
            }

            if (!item) {
                item = snapshot[i].item;
            }

            if (isLiveItem(item)) {
                result.push(item);
            }
        }
        return result;
    }

    function isLiveItem(item) {
        try {
            if (!item || !item.typename) return false;
            var b = item.geometricBounds;
            return !!b;
        } catch (e) {
            return false;
        }
    }

    function restoreSelection(doc, snapshot) {
        try {
            app.redraw();
        } catch (redrawError) {}

        var items = resolveSelectionItems(doc, snapshot);
        if (!items.length) return;

        try {
            doc.selection = null;
            doc.selection = items;
            if (doc.selection && doc.selection.length === items.length) return;
        } catch (setSelectionError) {
        }

        try {
            doc.selection = null;
            for (var i = 0; i < items.length; i++) {
                try {
                    items[i].selected = true;
                } catch (e) {}
            }
        } catch (fallbackError) {
        }
    }

    function asciiHex(text) {
        var result = "";
        for (var i = 0; i < text.length; i++) {
            var hex = text.charCodeAt(i).toString(16);
            if (hex.length < 2) hex = "0" + hex;
            result += hex;
        }
        return result;
    }

    function actionNumber(value) {
        var n = Number(value);
        if (isNaN(n)) return "100";
        return String(Math.round(n * 1000000) / 1000000);
    }

    function getTopmostParentGroup(item) {
        try {
            var parent = item.typename === "GroupItem" ? item : item.parent;
            var topGroup = null;

            while (parent && parent !== app) {
                if (parent.typename === "GroupItem") {
                    topGroup = parent;
                }

                if (parent.typename === "Layer" || parent.typename === "Document") {
                    break;
                }

                parent = parent.parent;
            }

            return topGroup;
        } catch (e) {
            return null;
        }
    }

    function getItemWidth(item) {
        var bounds = getItemBounds(item);
        if (!bounds) return 0;
        return getBoundsWidth(bounds);
    }

    function getBoundsWidth(bounds) {
        if (!bounds) return 0;
        return Math.abs(bounds.right - bounds.left);
    }

    function getBoundsHeight(bounds) {
        if (!bounds) return 0;
        return Math.abs(bounds.top - bounds.bottom);
    }

    function getBasisSizeForAxis(bounds, axis) {
        return axis === "height" ? getBoundsHeight(bounds) : getBoundsWidth(bounds);
    }

    function getLineScalePercent(scaleXPercent, scaleYPercent) {
        var scaleX = Math.abs(Number(scaleXPercent));
        var scaleY = Math.abs(Number(scaleYPercent));
        var lineScale = Math.sqrt(scaleX * scaleY);
        if (!(lineScale > 0)) return 100;
        return lineScale;
    }

    function restoreBasisCenter(targetItem, basisItem, oldBounds) {
        try {
            var newBounds = getItemBounds(basisItem);
            if (!newBounds) return false;

            var dx = getBoundsCenterX(oldBounds) - getBoundsCenterX(newBounds);
            var dy = getBoundsCenterY(oldBounds) - getBoundsCenterY(newBounds);
            if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return true;

            targetItem.translate(dx, dy);
            try {
                app.redraw();
            } catch (redrawError) {}
            return true;
        } catch (e) {
            return false;
        }
    }

    function getBoundsCenterX(bounds) {
        return (bounds.left + bounds.right) / 2;
    }

    function getBoundsCenterY(bounds) {
        return (bounds.top + bounds.bottom) / 2;
    }

    function getItemBounds(item) {
        try {
            var b = usePreviewBounds() ? item.visibleBounds : item.geometricBounds;
            return {
                left: Number(b[0]),
                top: Number(b[1]),
                right: Number(b[2]),
                bottom: Number(b[3])
            };
        } catch (e1) {
            try {
                var b2 = item.visibleBounds;
                return {
                    left: Number(b2[0]),
                    top: Number(b2[1]),
                    right: Number(b2[2]),
                    bottom: Number(b2[3])
                };
            } catch (e2) {
                return null;
            }
        }
    }

    function usePreviewBounds() {
        try {
            return app.preferences.getBooleanPreference("includeStrokeInBounds") === true;
        } catch (e) {
            return false;
        }
    }

    function canEdit(item) {
        try {
            if (!item || item.locked || item.hidden) return false;

            var parent = item.parent;
            while (parent && parent !== app && parent.typename !== "Document") {
                if (parent.locked === true || parent.hidden === true) return false;
                if (parent.typename === "Layer" && (parent.locked || !parent.visible)) return false;
                parent = parent.parent;
            }
        } catch (e) {
            return false;
        }
        return true;
    }

    function getTargetRequest() {
        var scriptedRequest = getScriptedTargetRequest();
        if (scriptedRequest) {
            return scriptedRequest;
        }

        return showTargetDialog();
    }

    function getScriptedTargetRequest() {
        var widthValue = NaN;
        var heightValue = NaN;

        try {
            if (typeof HGBASIS_SCALE_TARGET_WIDTH !== "undefined") {
                widthValue = parseLengthToPoints(String(HGBASIS_SCALE_TARGET_WIDTH));
            }
        } catch (e) {}

        try {
            if (typeof HGBASIS_SCALE_TARGET_HEIGHT !== "undefined") {
                heightValue = parseLengthToPoints(String(HGBASIS_SCALE_TARGET_HEIGHT));
            }
        } catch (heightError) {}

        if (!(widthValue > EPSILON) && !(heightValue > EPSILON)) return null;

        return {
            width: widthValue,
            height: heightValue
        };
    }

    function showTargetDialog() {
        try {
            var dialog = new Window("dialog", SCRIPT_NAME);
            dialog.orientation = "column";
            dialog.alignChildren = "fill";

            var hint = dialog.add("statictext", undefined, "只填一个：等比缩放。宽度和高度都填：非等比缩放到指定宽高。", { multiline: true });
            hint.preferredSize.width = 320;

            var inputPanel = dialog.add("panel", undefined, "目标尺寸");
            inputPanel.orientation = "column";
            inputPanel.alignChildren = "fill";

            var widthGroup = inputPanel.add("group");
            widthGroup.orientation = "row";
            widthGroup.alignChildren = "center";
            widthGroup.add("statictext", undefined, "宽度");
            var widthInput = widthGroup.add("edittext", undefined, "");
            widthInput.characters = 12;

            var heightGroup = inputPanel.add("group");
            heightGroup.orientation = "row";
            heightGroup.alignChildren = "center";
            heightGroup.add("statictext", undefined, "高度");
            var heightInput = heightGroup.add("edittext", undefined, "");
            heightInput.characters = 12;

            var buttonGroup = dialog.add("group");
            buttonGroup.alignment = "right";
            buttonGroup.add("button", undefined, "确定", { name: "ok" });
            buttonGroup.add("button", undefined, "取消", { name: "cancel" });

            widthInput.active = true;
            if (dialog.show() !== 1) return null;

            var widthValue = parseOptionalLengthToPoints(widthInput.text);
            var heightValue = parseOptionalLengthToPoints(heightInput.text);
            if (!(widthValue > EPSILON) && !(heightValue > EPSILON)) return null;

            return {
                width: widthValue,
                height: heightValue
            };
        } catch (dialogError) {
            var fallbackInput = prompt("输入目标尺寸：", "", SCRIPT_NAME);
            if (fallbackInput === null) return null;
            var fallbackValue = parseLengthToPoints(fallbackInput);
            if (isNaN(fallbackValue)) return null;
            return {
                width: fallbackValue,
                height: NaN
            };
        }
    }

    function resolveTargetSpec(targetRequest, basisBounds) {
        var currentWidth = getBoundsWidth(basisBounds);
        var currentHeight = getBoundsHeight(basisBounds);
        var hasWidth = targetRequest.width > EPSILON && currentWidth > EPSILON;
        var hasHeight = targetRequest.height > EPSILON && currentHeight > EPSILON;

        if (hasWidth && hasHeight) {
            return {
                axis: "size",
                widthValue: targetRequest.width,
                heightValue: targetRequest.height,
                scaleXPercent: targetRequest.width / currentWidth * 100,
                scaleYPercent: targetRequest.height / currentHeight * 100
            };
        }

        if (hasHeight) {
            var heightScalePercent = targetRequest.height / currentHeight * 100;
            return {
                axis: "height",
                widthValue: NaN,
                heightValue: targetRequest.height,
                scaleXPercent: heightScalePercent,
                scaleYPercent: heightScalePercent
            };
        }

        if (hasWidth) {
            var widthScalePercent = targetRequest.width / currentWidth * 100;
            return {
                axis: "width",
                widthValue: targetRequest.width,
                heightValue: NaN,
                scaleXPercent: widthScalePercent,
                scaleYPercent: widthScalePercent
            };
        }

        return null;
    }

    function tryRunCppPlugin(axis) {
        var mode = getHGScriptsCppMode();
        if (mode === "jsx") {
            return false;
        }

        try {
            var command = axis === "size" ? "HGBasisScaleToSize" : (axis === "height" ? "HGBasisScaleToHeight" : "HGBasisScaleToWidth");
            var beforeStatus = readTextFile(new File(Folder.userData.fsName + "/HGScripts/runtime/run_status.json"));
            app.executeMenuCommand(command);
            return waitForCppRunStatus(command, beforeStatus);
        } catch (e) {
            return false;
        }
    }

    function waitForCppRunStatus(command, beforeStatus) {
        var statusFile = new File(Folder.userData.fsName + "/HGScripts/runtime/run_status.json");
        for (var i = 0; i < 10; i++) {
            var statusText = readTextFile(statusFile);
            if (statusText && statusText !== beforeStatus &&
                statusText.indexOf("\"command\":\"" + command + "\"") >= 0 &&
                statusText.indexOf("\"source\":\"cpp\"") >= 0) {
                return statusText.indexOf("\"ok\":false") < 0;
            }
            try {
                $.sleep(50);
            } catch (sleepError) {}
        }
        return false;
    }

    function getHGScriptsCppMode() {
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
    }

    function writeBasisScaleTarget(targetSpec) {
        try {
            if (targetSpec.axis === "width" || targetSpec.axis === "size") {
                if (!writeTextFile(new File(Folder.temp + "/HGBasisScaleTargetWidth.txt"), String(targetSpec.widthValue))) return false;
            }
            if (targetSpec.axis === "height" || targetSpec.axis === "size") {
                if (!writeTextFile(new File(Folder.temp + "/HGBasisScaleTargetHeight.txt"), String(targetSpec.heightValue))) return false;
            }
            if (!writeTextFile(new File(Folder.temp + "/HGBasisScaleRequestFromHGScripts.txt"), String(new Date().getTime()))) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function writeTextFile(file, text) {
        try {
            file.encoding = "UTF-8";
            if (!file.open("w")) return false;
            file.write(String(text));
            file.close();
            return true;
        } catch (e) {
            return false;
        }
    }

    function readTextFile(file) {
        try {
            file.encoding = "UTF-8";
            if (!file.exists || !file.open("r")) return "";
            var text = file.read();
            file.close();
            return String(text);
        } catch (e) {
            return "";
        }
    }

    function clearBasisScaleTargetFiles() {
        removeFile(new File(Folder.temp + "/HGBasisScaleRequestFromHGScripts.txt"));
        removeFile(new File(Folder.temp + "/HGBasisScaleTargetWidth.txt"));
        removeFile(new File(Folder.temp + "/HGBasisScaleTargetHeight.txt"));
    }

    function removeFile(file) {
        try {
            if (file.exists) file.remove();
        } catch (e) {}
    }

    function parseLengthToPoints(input) {
        var text = trim(String(input));
        var match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*(px|pt|mm|毫米|cm|厘米|in|inch|英寸)?$/i);
        if (!match) return NaN;

        var value = parseFloat(match[1]);
        var unit = match[2] ? String(match[2]).toLowerCase() : "px";

        if (unit === "px" || unit === "pt") return value;
        if (unit === "mm" || unit === "毫米") return value * 72 / 25.4;
        if (unit === "cm" || unit === "厘米") return value * 72 / 2.54;
        if (unit === "in" || unit === "inch" || unit === "英寸") return value * 72;

        return NaN;
    }

    function parseOptionalLengthToPoints(input) {
        var text = trim(String(input));
        if (!text) return NaN;
        return parseLengthToPoints(text);
    }

    function describeItem(item) {
        if (!item) return "null";
        return getType(item) +
            "(name=" + safeProp(item, "name") +
            ", clipped=" + safeProp(item, "clipped") +
            ", clipping=" + safeProp(item, "clipping") +
            ", bounds=" + boundsToText(getItemBounds(item)) +
            ")";
    }

    function getParentChain(item) {
        var chain = [];
        try {
            var current = item;
            var guard = 0;
            while (current && current !== app && guard < 30) {
                chain.push(getType(current) + "(" + safeProp(current, "name") + ")");
                if (current.typename === "Document") break;
                current = current.parent;
                guard++;
            }
        } catch (e) {
            chain.push("error=" + e);
        }
        return chain.join(" > ");
    }

    function boundsToText(bounds) {
        if (!bounds) return "null";
        return "[l=" + fmt(bounds.left) + ",t=" + fmt(bounds.top) + ",r=" + fmt(bounds.right) + ",b=" + fmt(bounds.bottom) + ",w=" + fmt(Math.abs(bounds.right - bounds.left)) + ",h=" + fmt(Math.abs(bounds.top - bounds.bottom)) + "]";
    }

    function getType(item) {
        try {
            return item && item.typename ? item.typename : String(item);
        } catch (e) {
            return "Unknown";
        }
    }

    function safeProp(item, propName) {
        try {
            var value = item[propName];
            if (value === undefined) return "undefined";
            if (value === null) return "null";
            return String(value);
        } catch (e) {
            return "ERR";
        }
    }

    function fmt(value) {
        var n = Number(value);
        if (isNaN(n)) return String(value);
        return String(Math.round(n * 1000) / 1000);
    }

    function trim(value) {
        return String(value).replace(/^\s+|\s+$/g, "");
    }
})();

