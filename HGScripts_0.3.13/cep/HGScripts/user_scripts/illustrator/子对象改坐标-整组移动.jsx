#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGBasisMoveToXY
// 子对象改坐标-整组移动 / Child Object Move to XY - Move Group
// 2026-11-12: mirror of 子对象改尺寸-整组缩放.jsx (size/scale -> coordinate/translate).
// 2026-11-13: AIP deployed (2026), CPP_DISPATCH_ENABLED -> true; D9 bridge wired.
//
// 坐标口径 (F4 / docs/decisions/2026-05-15-illustrator-size-panel-bounds.md):
//   - 定位点 = 对象边界中心（Illustrator 变换面板默认参考点）
//   - 原点 = 对象中心所在画板的左上角；X 向右为正、Y 向下为正
//   - bounds 按 includeStrokeInBounds 首选项在 geometricBounds / visibleBounds 间切换
//   - JSX 内部是 Y 向上的几何坐标，故 targetCenterY = artboard.top - targetY
//
// C11: JSX 独立完成输入与整组平移；AIP 有自己的原生输入，不依赖本脚本。
// C10: 一旦派发 AIP 菜单命令就立即返回，不再读写文档/选区。
// C5:  临时文件只是本次请求的传输层，marker 最后写、AIP 读后清理。
// J8:  日志只写统一 JSONL 通道，静默失败，不新增逐脚本插桩。

(function () {
    var SCRIPT_NAME = text("子对象改坐标-整组移动", "Child Object Move to XY - Move Group");
    var CPP_COMMAND = "HGBasisMoveToXY";
    var BUILD_MARKER = "HGBasisMove-jsx-2026-11-12";
    var EPSILON = 0.0001;
    var eventSeq = 0;

    // AIP 2026 已部署（2026-11-13）。executeMenuCommand 遇到未知命令会静默失败
    // （不抛异常），所以这个闸门只在插件确实在宿主里时才允许置 true；
    // 回退插件时把它改回 false，auto/cpp 立即回落到 JSX 自己的实现（C4）。
    var CPP_DISPATCH_ENABLED = true;

    // D9: 复用既有桥接层，不新增。桥接缺失时 JSX 自己完成全部功能（C4/C11）。
    var cppBridge = null;
    try {
        HGColorTools_load();
        cppBridge = $.global.HGColorTools;
    } catch (bridgeError) {
        cppBridge = null;
    }

    function text(zh, en) {
        try { if (/^en/i.test(String($.global.HGSCRIPTS_LANGUAGE || ""))) return en; } catch (ignore) {}
        return zh;
    }

    // 加载统一深色主题库（与 AIP 原生窗口 HGUITheme.h 同一套配色）。缺失时静默降级。
    function HGUILoadTheme() {
        try {
            if ($.global.HGScriptUITheme) return $.global.HGScriptUITheme;
            var root = new File($.fileName).parent;
            $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGScriptUITheme.jsx"));
            return $.global.HGScriptUITheme;
        } catch (e) { return null; }
    }

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

    var artboardRect = getArtboardRectForItem(doc, basisItem);
    var basisBoundsBefore = getItemBounds(basisItem);
    if (!artboardRect || !basisBoundsBefore) {
        return;
    }

    var moveTarget = getTopmostParentGroup(basisItem);
    if (!moveTarget) {
        moveTarget = basisItem;
    }
    if (!canEdit(moveTarget)) {
        return;
    }

    var currentX = getBoundsCenterX(basisBoundsBefore) - artboardRect.left;
    var currentY = artboardRect.top - getBoundsCenterY(basisBoundsBefore);

    logEvent("start", "INFO", "move.begin", "开始", 0, 0);

    // C5: 先清残留 marker，避免稍后 AIP 菜单直点复用上一次的目标值。
    clearBasisMoveTargetFiles();

    var scriptedTargetRequest = getScriptedTargetRequest();
    if (!scriptedTargetRequest && getHGScriptsCppMode() !== "jsx") {
        // 无面板传值：AIP 弹它自己的输入框（C11），JSX 保持静默。
        if (tryRunCppPlugin()) {
            logEvent("end", "INFO", "cpp.dispatch", "已派发插件命令", 0, 0);
            return; // C10
        }
    }

    var targetRequest = scriptedTargetRequest || showTargetDialog(currentX, currentY);
    if (!targetRequest) {
        return;
    }

    var moveSpec = resolveMoveSpec(targetRequest, basisBoundsBefore, artboardRect);
    if (!moveSpec) {
        return;
    }

    // 面板传值或强制 cpp 模式：把目标坐标写进本次请求的临时文件再派发。
    if (CPP_DISPATCH_ENABLED && writeBasisMoveTarget(moveSpec) && tryRunCppPlugin()) {
        logEvent("end", "INFO", "cpp.dispatch", "已派发插件命令", moveSpec.dx, moveSpec.dy);
        return; // C10
    }
    clearBasisMoveTargetFiles();

    // AIP 不在 / 命令未部署 / 桥接失败：JSX 自己完成全部功能（C4 回落、C11）。
    logEvent("step", "INFO", "jsx.run", "由脚本独立完成整组平移", moveSpec.dx, moveSpec.dy);
    if (!moveWholeTarget(doc, selectionSnapshot, moveTarget, moveSpec.dx, moveSpec.dy)) {
        logEvent("error", "ERROR", "move.failed", "整组平移失败", moveSpec.dx, moveSpec.dy);
        return;
    }
    logEvent("end", "INFO", "move.done", "整组平移完成", moveSpec.dx, moveSpec.dy);

    // ------------------------------------------------------------------
    // 业务：把最外层父组平移 dx/dy，让基准子对象的中心落到目标坐标。
    // ------------------------------------------------------------------

    function moveWholeTarget(doc, selectionSnapshot, item, dx, dy) {
        // 纯平移用 translate 即可，不需要 Action，也不会动选区。
        try {
            item.translate(dx, dy);
            try { app.redraw(); } catch (redrawError) {}
            restoreSelection(doc, selectionSnapshot);
            return true;
        } catch (translateError) {
            logEvent("fallback", "WARN", "move.nativeAction", "translate 失败，改用原生 Action", dx, dy);
        }

        // 兜底：与「子对象对齐画板-整组移动」相同的已验证 Action move 口径。
        if (moveByNativeAction(doc, selectionSnapshot, item, dx, dy)) {
            return true;
        }
        return false;
    }

    function moveByNativeAction(doc, selectionSnapshot, item, dx, dy) {
        var oldInteractionLevel = null;
        var changedInteractionLevel = false;

        try {
            oldInteractionLevel = app.userInteractionLevel;
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
            changedInteractionLevel = true;

            doc.selection = null;
            item.selected = true;

            runMoveAction("HGBasisXYMoveTempSet", "HGBasisXYMove", dx, dy);
            restoreSelection(doc, selectionSnapshot);
            return true;
        } catch (e) {
            try { restoreSelection(doc, selectionSnapshot); } catch (restoreError) {}
            return false;
        } finally {
            if (changedInteractionLevel) {
                try { app.userInteractionLevel = oldInteractionLevel; } catch (interactionError) {}
            }
        }
    }

    function runMoveAction(actionSetName, actionName, dx, dy) {
        var actionFile = null;
        try {
            try { app.unloadAction(actionSetName, ""); } catch (unloadBeforeError) {}

            actionFile = File(Folder.temp + "/HGBasisXYMoveTempAction.aia");
            actionFile.encoding = "UTF-8";
            if (!actionFile.open("w")) {
                throw new Error("cannot open temp action file");
            }
            actionFile.write(buildMoveActionText(actionSetName, actionName, dx, dy));
            actionFile.close();

            app.loadAction(actionFile);
            app.doScript(actionName, actionSetName);
        } finally {
            try { app.unloadAction(actionSetName, ""); } catch (unloadAfterError) {}
            if (actionFile) {
                try { if (actionFile.exists) actionFile.remove(); } catch (removeError) {}
            }
        }
    }

    function buildMoveActionText(actionSetName, actionName, dx, dy) {
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
            "\t\t/internalName (adobe_move)",
            "\t\t/localizedName [ 4",
            "\t\t\t4d6f7665",
            "\t\t]",
            "\t\t/isOpen 0",
            "\t\t/isOn 1",
            "\t\t/hasDialog 1",
            "\t\t/showDialog 0",
            "\t\t/parameterCount 5",
            "\t\t/parameter-1 {",
            "\t\t\t/key 1752136302",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (unit real)",
            "\t\t\t/value " + actionNumber(dx),
            "\t\t\t/unit 592476268",
            "\t\t}",
            "\t\t/parameter-2 {",
            "\t\t\t/key 1987339116",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (unit real)",
            "\t\t\t/value " + actionNumber(dy),
            "\t\t\t/unit 592476268",
            "\t\t}",
            "\t\t/parameter-3 {",
            "\t\t\t/key 1868720756",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (boolean)",
            "\t\t\t/value 1",
            "\t\t}",
            "\t\t/parameter-4 {",
            "\t\t\t/key 1885434990",
            "\t\t\t/showInPalette -1",
            "\t\t\t/type (boolean)",
            "\t\t\t/value 1",
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

    function asciiHex(value) {
        var result = "";
        for (var i = 0; i < value.length; i++) {
            var hex = value.charCodeAt(i).toString(16);
            if (hex.length < 2) hex = "0" + hex;
            result += hex;
        }
        return result;
    }

    function actionNumber(value) {
        var n = Number(value);
        if (isNaN(n)) return "0";
        return String(Math.round(n * 1000000) / 1000000);
    }

    // ------------------------------------------------------------------
    // 选区与边界（沿用「子对象改尺寸-整组缩放.jsx」的已验证实现）
    // ------------------------------------------------------------------

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
            result.push({ item: items[i], uuid: getItemUuid(items[i]) });
        }
        return result;
    }

    function getItemUuid(item) {
        try { if (item.uuid) return String(item.uuid); } catch (e) {}
        return "";
    }

    function resolveSelectionItems(doc, snapshot) {
        var result = [];
        for (var i = 0; i < snapshot.length; i++) {
            var item = null;
            var uuid = snapshot[i].uuid;
            if (uuid) {
                try {
                    if (doc.getPageItemFromUuid) item = doc.getPageItemFromUuid(uuid);
                } catch (uuidError) { item = null; }
            }
            if (!item) item = snapshot[i].item;
            if (isLiveItem(item)) result.push(item);
        }
        return result;
    }

    function isLiveItem(item) {
        try {
            if (!item || !item.typename) return false;
            var b = item.geometricBounds;
            return !!b;
        } catch (e) { return false; }
    }

    function restoreSelection(doc, snapshot) {
        try { app.redraw(); } catch (redrawError) {}

        var items = resolveSelectionItems(doc, snapshot);
        if (!items.length) return;

        try {
            doc.selection = null;
            doc.selection = items;
            if (doc.selection && doc.selection.length === items.length) return;
        } catch (setSelectionError) {}

        try {
            doc.selection = null;
            for (var i = 0; i < items.length; i++) {
                try { items[i].selected = true; } catch (e) {}
            }
        } catch (fallbackError) {}
    }

    function getTopmostParentGroup(item) {
        try {
            var parent = item.typename === "GroupItem" ? item : item.parent;
            var topGroup = null;
            while (parent && parent !== app) {
                if (parent.typename === "GroupItem") topGroup = parent;
                if (parent.typename === "Layer" || parent.typename === "Document") break;
                parent = parent.parent;
            }
            return topGroup;
        } catch (e) { return null; }
    }

    function getItemBounds(item) {
        try {
            var b = usePreviewBounds() ? item.visibleBounds : item.geometricBounds;
            return {
                left: Number(b[0]), top: Number(b[1]),
                right: Number(b[2]), bottom: Number(b[3])
            };
        } catch (e1) {
            try {
                var b2 = item.visibleBounds;
                return {
                    left: Number(b2[0]), top: Number(b2[1]),
                    right: Number(b2[2]), bottom: Number(b2[3])
                };
            } catch (e2) { return null; }
        }
    }

    function usePreviewBounds() {
        try {
            return app.preferences.getBooleanPreference("includeStrokeInBounds") === true;
        } catch (e) { return false; }
    }

    function getBoundsCenterX(bounds) { return (bounds.left + bounds.right) / 2; }
    function getBoundsCenterY(bounds) { return (bounds.top + bounds.bottom) / 2; }

    function getArtboardRectForItem(doc, item) {
        // 与 HGBasisArtboardAlignCore.jsx 一致：优先对象中心所在画板，否则最近画板。
        var bounds = getItemBounds(item);
        if (!bounds) return null;
        var cx = getBoundsCenterX(bounds);
        var cy = getBoundsCenterY(bounds);
        var nearestIndex = 0;
        var nearestDistance = Number.MAX_VALUE;

        try {
            for (var i = 0; i < doc.artboards.length; i++) {
                var r = doc.artboards[i].artboardRect;
                var left = Number(r[0]), top = Number(r[1]);
                var right = Number(r[2]), bottom = Number(r[3]);
                if (cx >= left && cx <= right && cy <= top && cy >= bottom) {
                    return makeArtboardRect(r);
                }
                var dx = cx - (left + right) / 2;
                var dy = cy - (top + bottom) / 2;
                var distance = dx * dx + dy * dy;
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = i;
                }
            }
            return makeArtboardRect(doc.artboards[nearestIndex].artboardRect);
        } catch (e) {
            return null;
        }
    }

    function makeArtboardRect(r) {
        return {
            left: Number(r[0]), top: Number(r[1]),
            right: Number(r[2]), bottom: Number(r[3])
        };
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
        } catch (e) { return false; }
        return true;
    }

    // ------------------------------------------------------------------
    // 输入：两个框预填当前坐标，改哪个就动哪个轴，留空 = 该轴不动
    // ------------------------------------------------------------------

    function getScriptedTargetRequest() {
        var xValue = NaN;
        var yValue = NaN;
        try {
            if (typeof HGBASIS_MOVE_TARGET_X !== "undefined") {
                xValue = parseLengthToPoints(String(HGBASIS_MOVE_TARGET_X));
            }
        } catch (e) {}
        try {
            if (typeof HGBASIS_MOVE_TARGET_Y !== "undefined") {
                yValue = parseLengthToPoints(String(HGBASIS_MOVE_TARGET_Y));
            }
        } catch (e2) {}

        if (isNaN(xValue) && isNaN(yValue)) return null;
        return {
            hasX: !isNaN(xValue), hasY: !isNaN(yValue),
            targetX: xValue, targetY: yValue
        };
    }

    function showTargetDialog(currentX, currentY) {
        try {
            var dialog = new Window("dialog", SCRIPT_NAME);
            dialog.orientation = "column";
            dialog.alignChildren = "fill";

            var hint = dialog.add("statictext", undefined,
                text("只改一个：只沿该轴移动；留空 = 该轴不动。\n两个都改：同时改 X 和 Y。\n以对象中心所在画板的左上角为原点，Y 向下为正；定位点是对象中心。",
                     "Change one field to move on that axis only; leave a field empty to keep that axis.\nChange both for a two-axis move.\nOrigin is the top-left of the object's artboard, Y points down; the anchor is the object center."),
                { multiline: true });
            hint.preferredSize.width = 360;

            var inputPanel = dialog.add("panel", undefined, text("目标坐标", "Target Coordinates"));
            inputPanel.orientation = "column";
            inputPanel.alignChildren = "fill";

            var xGroup = inputPanel.add("group");
            xGroup.orientation = "row";
            xGroup.alignChildren = "center";
            xGroup.add("statictext", undefined, "X");
            var xInput = xGroup.add("edittext", undefined, fmt(currentX));
            xInput.characters = 12;

            var yGroup = inputPanel.add("group");
            yGroup.orientation = "row";
            yGroup.alignChildren = "center";
            yGroup.add("statictext", undefined, "Y");
            var yInput = yGroup.add("edittext", undefined, fmt(currentY));
            yInput.characters = 12;

            var buttonGroup = dialog.add("group");
            buttonGroup.alignment = "right";
            buttonGroup.add("button", undefined, text("确定", "OK"), { name: "ok" });
            buttonGroup.add("button", undefined, text("取消", "Cancel"), { name: "cancel" });

            xInput.active = true;
            var hgTheme = HGUILoadTheme();
            if (hgTheme) hgTheme.apply(dialog);
            if (dialog.show() !== 1) return null;

            var xText = trim(xInput.text);
            var yText = trim(yInput.text);
            if (!xText && !yText) return null;

            var xValue = xText ? parseLengthToPoints(xText) : NaN;
            var yValue = yText ? parseLengthToPoints(yText) : NaN;
            // 非法输入静默放弃，不弹错误窗（A14 / F3）。
            if (xText && isNaN(xValue)) return null;
            if (yText && isNaN(yValue)) return null;

            return {
                hasX: !isNaN(xValue), hasY: !isNaN(yValue),
                targetX: xValue, targetY: yValue
            };
        } catch (dialogError) {
            return null;
        }
    }

    function resolveMoveSpec(request, bounds, ab) {
        if (!request.hasX && !request.hasY) return null;

        var centerX = getBoundsCenterX(bounds);
        var centerY = getBoundsCenterY(bounds);
        var dx = request.hasX ? (ab.left + request.targetX) - centerX : 0;
        var dy = request.hasY ? (ab.top - request.targetY) - centerY : 0;

        if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return null;

        return {
            dx: dx,
            dy: dy,
            hasX: request.hasX,
            hasY: request.hasY,
            targetX: request.targetX,
            targetY: request.targetY
        };
    }

    function parseLengthToPoints(input) {
        var value = trim(String(input));
        var match = value.match(/^([+-]?[0-9]+(?:\.[0-9]+)?)\s*(px|pt|mm|毫米|cm|厘米|in|inch|英寸)?$/i);
        if (!match) return NaN;

        var n = parseFloat(match[1]);
        var unit = match[2] ? String(match[2]).toLowerCase() : "px";

        if (unit === "px" || unit === "pt") return n;
        if (unit === "mm" || unit === "毫米") return n * 72 / 25.4;
        if (unit === "cm" || unit === "厘米") return n * 72 / 2.54;
        if (unit === "in" || unit === "inch" || unit === "英寸") return n * 72;
        return NaN;
    }

    function fmt(value) {
        var n = Number(value);
        if (isNaN(n)) return "0";
        return String(Math.round(n * 1000) / 1000);
    }

    function trim(value) {
        return String(value).replace(/^\s+|\s+$/g, "");
    }

    // ------------------------------------------------------------------
    // C5 临时文件协议 / C10 派发
    // ------------------------------------------------------------------

    function tryRunCppPlugin() {
        if (!CPP_DISPATCH_ENABLED) return false;
        if (getHGScriptsCppMode() === "jsx") return false;
        if (!cppBridge || typeof cppBridge.tryCppCommand !== "function") return false;
        // 只派发。AIP 要等本脚本返回后才执行（C10），脚本内不得轮询结果。
        // D9: 走既有 HGCppBridge.tryCppCommand，它内部同样按 CPP_MODE 分流。
        try {
            return cppBridge.tryCppCommand(CPP_COMMAND) === true;
        } catch (e) {
            return false;
        }
    }

    function HGColorTools_load() {
        var root = new File($.fileName).parent;
        $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
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

    function writeBasisMoveTarget(moveSpec) {
        try {
            if (moveSpec.hasX) {
                if (!writeTextFile(new File(Folder.temp + "/HGBasisMoveTargetX.txt"), String(moveSpec.targetX))) return false;
            }
            if (moveSpec.hasY) {
                if (!writeTextFile(new File(Folder.temp + "/HGBasisMoveTargetY.txt"), String(moveSpec.targetY))) return false;
            }
            // request marker 必须最后写（C5）。
            if (!writeTextFile(new File(Folder.temp + "/HGBasisMoveRequestFromHGScripts.txt"), String(new Date().getTime()))) return false;
            return true;
        } catch (e) { return false; }
    }

    function writeTextFile(file, value) {
        try {
            file.encoding = "UTF-8";
            if (!file.open("w")) return false;
            file.write(String(value));
            file.close();
            return true;
        } catch (e) { return false; }
    }

    function clearBasisMoveTargetFiles() {
        removeFile(new File(Folder.temp + "/HGBasisMoveRequestFromHGScripts.txt"));
        removeFile(new File(Folder.temp + "/HGBasisMoveTargetX.txt"));
        removeFile(new File(Folder.temp + "/HGBasisMoveTargetY.txt"));
    }

    function removeFile(file) {
        try { if (file.exists) file.remove(); } catch (e) {}
    }

    // ------------------------------------------------------------------
    // J8 统一 JSONL 通道：静默失败、低噪、不写路径、不影响主流程
    // ------------------------------------------------------------------

    function logEvent(phase, level, event, message, dx, dy) {
        try {
            var dir = resolveRuntimeDir();
            if (!dir) return;
            if (!dir.exists) {
                try { dir.create(); } catch (createError) { return; }
            }

            var file = new File(dir.fsName + "/hgscripts_events.jsonl");
            rotateIfNeeded(dir, file);

            var ms = new Date().getTime();
            var runId = "";
            try {
                if ($.global && typeof $.global.HGSCRIPTS_RUN_ID !== "undefined") {
                    runId = String($.global.HGSCRIPTS_RUN_ID);
                }
            } catch (idError) {}

            eventSeq++;
            var attrs = "{\"standalone\":" + (runId ? "false" : "true") +
                ",\"dx\":" + actionNumber(dx) + ",\"dy\":" + actionNumber(dy) + "}";
            var line = "{" +
                "\"ts\":\"" + isoUtc(ms) + "\"," +
                "\"tsMs\":" + ms + "," +
                "\"runId\":\"" + jsonEscape(runId) + "\"," +
                "\"seq\":" + eventSeq + "," +
                "\"layer\":\"jsx\"," +
                "\"tool\":\"HGBasisMoveToXY\"," +
                "\"phase\":\"" + phase + "\"," +
                "\"level\":\"" + level + "\"," +
                "\"event\":\"" + event + "\"," +
                "\"message\":\"" + jsonEscape(message || "") + "\"," +
                "\"attrs\":" + attrs + "," +
                "\"build\":\"" + BUILD_MARKER + "\"" +
                "}";

            if (line.length > 4096) return;
            file.encoding = "UTF-8";
            if (!file.open("a")) return;
            file.writeln(line);
            file.close();
        } catch (ignore) {
            // 硬约束：任何写入异常都吞掉，不弹窗、不改变主流程。
        }
    }

    function resolveRuntimeDir() {
        // 优先复用面板注入的 run_hint 路径的父目录，与 run_*.json 同源。
        try {
            if ($.global && typeof $.global.HGSCRIPTS_RUN_HINT_PATH !== "undefined") {
                var parent = (new File(String($.global.HGSCRIPTS_RUN_HINT_PATH))).parent;
                if (parent && parent.exists) return parent;
            }
        } catch (e) {}
        try {
            var appData = $.getenv("APPDATA");
            if (appData) return new Folder(appData + "/HGScripts/runtime");
        } catch (e2) {}
        return null;
    }

    function rotateIfNeeded(dir, file) {
        try {
            if (!file.exists || file.length <= 524288) return;
            var oldest = new File(dir.fsName + "/hgscripts_events.3.jsonl");
            if (oldest.exists) oldest.remove();
            for (var i = 2; i >= 1; i--) {
                var src = new File(dir.fsName + "/hgscripts_events." + i + ".jsonl");
                if (src.exists) src.rename("hgscripts_events." + (i + 1) + ".jsonl");
            }
            file.rename("hgscripts_events.1.jsonl");
        } catch (rotationError) {}
    }

    function isoUtc(ms) {
        var d = new Date(ms);
        function two(n) { return n < 10 ? "0" + n : String(n); }
        function three(n) { return n < 10 ? "00" + n : (n < 100 ? "0" + n : String(n)); }
        return d.getUTCFullYear() + "-" + two(d.getUTCMonth() + 1) + "-" + two(d.getUTCDate()) +
            "T" + two(d.getUTCHours()) + ":" + two(d.getUTCMinutes()) + ":" + two(d.getUTCSeconds()) +
            "." + three(d.getUTCMilliseconds()) + "Z";
    }

    function jsonEscape(value) {
        return String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }
})();
