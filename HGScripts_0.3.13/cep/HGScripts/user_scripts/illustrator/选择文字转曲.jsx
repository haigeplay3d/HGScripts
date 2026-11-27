#target illustrator
// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGTextToOutlines

(function () {
    var OUTLINE_MENU_COMMAND = "outline";

    var libRoot = new File($.fileName).parent;
    $.evalFile(new File(libRoot.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
    $.evalFile(new File(libRoot.fsName + "/../../assets/jsx/illustrator_lib/HGFontNote.jsx"));
    var HGB = $.global.HGColorTools;
    var HGFN = $.global.HGFontNote;

    if (!app.documents.length) {
        return;
    }

    var doc = app.activeDocument;
    var selectedItems = getSelectedItems(doc);
    var hasSelection = selectedItems.length > 0;

    var targets = hasSelection ? collectFromItems(selectedItems) : collectTextFrames(doc);
    if (targets.length === 0) {
        return;
    }

    if (HGB.tryCppCommand("HGTextToOutlines")) {
        // 2026-11-08 根因：executeMenuCommand 调用插件菜单命令是【延迟执行】的——
        // 命令要等本脚本彻底跑完、引擎空闲后才真正执行（实测延迟约 10 秒）。
        // 这里一旦重扫文档并 DOM 转曲，就会吃掉选区；等延迟的 C++ 醒来时读到空选区，
        // 便误判「无选中」而整篇转曲。所以 C++ 接手后必须立即返回，绝不再碰文档；
        // 蒙版帧与 CreateOutline 失败的兜底已全部收进 C++ 内部完成。
        return;
    }

    outlineByDom(doc, targets);

    function outlineByDom(doc, frames) {
        var leftovers = [];

        for (var i = 0; i < frames.length; i++) {
            if (!outlineOne(frames[i])) {
                leftovers.push(frames[i]);
            }
        }

        if (leftovers.length > 0) {
            outlineByMenu(doc, leftovers);
        }
    }

    function outlineOne(frame) {
        try {
            if (typeof frame.createOutline !== "function") {
                return false;
            }
            var info = HGFN.capture(frame);
            var group = frame.createOutline();
            if (group && info) {
                HGFN.write(group, info);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // createOutline 失败的个别对象：逐帧走官方菜单命令，转曲后从新选中对象补挂 note
    function outlineByMenu(doc, frames) {
        for (var i = 0; i < frames.length; i++) {
            try {
                var info = HGFN.capture(frames[i]);
                doc.selection = null;
                frames[i].selected = true;
                app.executeMenuCommand(OUTLINE_MENU_COMMAND);
                if (info) {
                    attachAfterMenu(doc, info);
                }
            } catch (e) {}
        }
        return true;
    }

    function attachAfterMenu(doc, info) {
        var sel = null;
        try {
            sel = doc.selection;
        } catch (e) {
            return;
        }
        if (!sel || !sel.length) return;
        for (var i = 0; i < sel.length; i++) {
            try {
                if (sel[i] && !HGFN.has(sel[i])) {
                    HGFN.write(sel[i], info);
                    return;
                }
            } catch (e2) {}
        }
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

    function collectTextFrames(doc) {
        var result = [];
        collectFrom(doc, result);
        return result;
    }

    function collectFromItems(items) {
        var result = [];
        for (var i = 0; i < items.length; i++) {
            pushTextItem(items[i], result);
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
            pushTextItem(item, result);
        }
    }

    function pushTextItem(item, result) {
        if (!item || shouldSkip(item)) return;

        var type = getItemType(item);
        if (type === "TextFrame") {
            result.push(item);
        } else if (type === "GroupItem") {
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
