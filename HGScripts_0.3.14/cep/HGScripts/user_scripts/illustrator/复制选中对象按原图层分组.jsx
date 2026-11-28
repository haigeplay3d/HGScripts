#target illustrator
//
// HGScripts / 复制选中对象按原图层分组
// ------------------------------------------------------------------
// 中文：把当前选中的对象各复制一份，按「原件所在的图层」归堆，每堆打成一个组
//       （组名 = 原图层名），再新建一个随机 6 字母命名的最上层图层，
//       把所有新组放进去。原对象、原图层、原组一律不动。
// EN:   Duplicate the current selection, group the copies by the layer each
//       original sits on (group name = that layer's name), then place all
//       groups into a new top-most layer named with 6 random letters.
//       Originals, their layers and their groups are left untouched.
//
// 完整说明见同名的 .md / .en.md。
// Build marker: HG-GroupByLayerCopy-1.0
// 日志：只写 ExtendScript 控制台（$.writeln），不弹窗、不落盘、不保存文档。
//

(function () {
    var TAG = "HG-GroupByLayerCopy-1.0";

    // AGENTS_custom「运行日志」+ J8：隐藏日志，不打扰用户，不写独立日志文件。
    function log(msg) {
        try { $.writeln("[" + TAG + "] " + msg); } catch (ignore) {}
    }

    function letters(n) {
        var s = "";
        for (var i = 0; i < n; i++) {
            s += String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
        return s;
    }

    function layerNameExists(doc, name) {
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === name) return true;
        }
        return false;
    }

    function pickLayerName(doc) {
        var name = letters(6);
        for (var i = 0; i < 60 && layerNameExists(doc, name); i++) {
            name = letters(6);
        }
        return name;
    }

    // 向上找所属图层：对象可能嵌在组 / 复合路径里。
    function owningLayer(item) {
        var p = item;
        for (var i = 0; p && i < 64; i++) {
            if (p.typename === "Layer") return p;
            p = p.parent;
        }
        return null;
    }

    // 深度优先收集图层名，顺序 = 图层面板从上到下（含子图层）。
    // 用「名字」而不是对象引用做键：ExtendScript 的 DOM 代理不适合做 === 比较。
    function collectLayerNames(container, out, seen) {
        for (var i = 0; i < container.layers.length; i++) {
            var L = container.layers[i];
            var key = "#" + L.name;
            if (!seen[key]) {
                seen[key] = true;
                out.push(L.name);
            }
            collectLayerNames(L, out, seen);
        }
    }

    function contains(arr, value) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === value) return true;
        }
        return false;
    }

    function run() {
        if (app.documents.length === 0) {
            log("SKIP no-document");
            return;
        }
        var doc = app.activeDocument;
        var i;

        // 先快照选区：后面的 duplicate() 会改变 doc.selection。
        var selected = [];
        for (i = 0; i < doc.selection.length; i++) {
            selected.push(doc.selection[i]);
        }
        log("START selected=" + selected.length);
        if (selected.length === 0) {
            log("SKIP empty-selection");
            return;
        }

        // 按「原件所在图层名」归堆；同名图层合并为一个组。
        var buckets = {};
        var bucketOrder = [];
        var skipped = 0;
        for (i = 0; i < selected.length; i++) {
            var L = owningLayer(selected[i]);
            if (!L) { skipped++; continue; }
            var key = "#" + L.name;
            if (!buckets[key]) {
                buckets[key] = { name: L.name, items: [] };
                bucketOrder.push(key);
            }
            buckets[key].items.push(selected[i]);
        }

        // 组的排布按图层面板从上到下，尽量还原原来的前后遮挡。
        var layerNames = [];
        collectLayerNames(doc, layerNames, {});
        var plan = [];
        for (i = 0; i < layerNames.length; i++) {
            var k = "#" + layerNames[i];
            if (buckets[k] && !contains(plan, k)) plan.push(k);
        }
        for (i = 0; i < bucketOrder.length; i++) {
            if (!contains(plan, bucketOrder[i])) plan.push(bucketOrder[i]);
        }

        // layers.add() 落在活动图层之上：先把活动层设为最顶层，新层即最顶层。
        try {
            if (doc.layers.length > 0) doc.activeLayer = doc.layers[0];
        } catch (eActive) {
            log("WARN set-active-layer " + eActive);
        }
        var newLayer = doc.layers.add();
        newLayer.name = pickLayerName(doc);
        newLayer.visible = true;
        newLayer.locked = false;
        doc.activeLayer = newLayer;
        log("LAYER name=" + newLayer.name + " groups=" + plan.length + " skipped=" + skipped);

        var used = {};   // 组名去重（防御极端情况）
        var made = [];   // 新组（保持图层面板从上到下），最后设为选中
        var copied = 0;
        var failed = 0;

        // 实机修正 2026-11-12：groupItems.add() 每次把新组放在图层**最上层**，
        // 按面板上→下顺序建会让原最下层图层的组压在最上面，整组顺序颠倒。
        // 因此按原图层**从下往上**建，最后建的（原最上层）才留在最上面。
        for (i = plan.length - 1; i >= 0; i--) {
            var b = buckets[plan[i]];
            var g = newLayer.groupItems.add();
            var gname = b.name;
            if (used["#" + gname]) {
                var n = 2;
                while (used["#" + (gname + " (" + n + ")")]) n++;
                gname = gname + " (" + n + ")";
            }
            used["#" + gname] = true;
            g.name = gname;

            for (var j = 0; j < b.items.length; j++) {
                try {
                    // 两步走：先复制（副本暂留原图层），再把副本移进新组。
                    // 原对象始终不动。
                    var dup = b.items[j].duplicate();
                    dup.move(g, ElementPlacement.PLACEATEND);
                    copied++;
                } catch (eItem) {
                    failed++;
                    log("ERROR item layer=" + b.name + " index=" + j + " " + eItem);
                }
            }
            made.unshift(g);   // 让 made 与图层面板一样保持从上到下
            log("GROUP name=" + gname + " items=" + b.items.length);
        }

        // 不弹窗的可见反馈：选中新组，图层面板里一眼能看出结果。
        try { doc.selection = made; } catch (eSel) { log("WARN select " + eSel); }

        log("DONE layer=" + newLayer.name + " groups=" + made.length +
            " copied=" + copied + " failed=" + failed + " skipped=" + skipped);
    }

    try {
        run();
    } catch (e) {
        log("FATAL " + (e && e.message ? e.message : e));
    }
})();
