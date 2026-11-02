#target illustrator
#targetengine "HGPaperCupGenerator"
// hgscripts-title: 纸杯展开
// Standalone JSX. All geometry is in mm until it reaches Illustrator's DOM.
var HGPaperCup = (function () {
    var PT = 72 / 25.4;
    var TAU = 2 * Math.PI;

    function text(zh, en) {
        try { if (/^en/i.test(String($.global.HGSCRIPTS_LANGUAGE || ""))) return en; } catch (ignore) {}
        return zh;
    }
    function fail(zh, en) { throw new Error(text(zh, en)); }
    function parseNumber(value, label, allowZero) {
        var s = String(value).replace(/[０-９]/g, function (c) { return String(c.charCodeAt(0) - 65296); });
        s = s.replace(/．/g, ".").replace(/^\s+|\s+$/g, "").replace(/\s*(mm|毫米)$/i, "");
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) {
            fail(label + "：请输入有效数字，单位为毫米。", label + ": enter a valid number in mm.");
        }
        var n = Number(s);
        if (!isFinite(n) || n < 0 || (!allowZero && n === 0)) {
            fail(label + "：数值必须" + (allowZero ? "大于或等于零。" : "大于零。"),
                label + (allowZero ? ": must be zero or greater." : ": must be greater than zero."));
        }
        return n;
    }
    function resolveDimensions(input) {
        var d = input.topDiameter, b = input.bottomDiameter;
        if (typeof d !== "number" || !isFinite(d) || d <= 0 || d > 2000 ||
                typeof b !== "number" || !isFinite(b) || b <= 0 || b > 2000) {
            fail("上下口直径需大于 0 且不超过 2000 mm。", "Diameters must be greater than 0 and no more than 2000 mm.");
        }
        if (d < b) fail("上口直径不能小于下口直径。", "Top diameter must be at least the bottom diameter.");
        var mode = typeof input.heightMode === "undefined" ? "height" : input.heightMode;
        if (mode !== "height" && mode !== "slant") fail("高度输入方式无效。", "Invalid height input mode.");
        var half = (d - b) / 2, h, s;
        if (mode === "slant") {
            s = input.slant;
            if (typeof s !== "number" || !isFinite(s) || s <= half) {
                fail("S 斜坡长度必须大于上下口半径之差，才能形成有高度的杯身。",
                    "S slope length must exceed the difference between the opening radii.");
            }
            // Factoring avoids cancellation near a completely flattened cone.
            h = Math.sqrt((s - half) * (s + half));
            if (h > 2000 && h <= 2000 + 1e-9) h = 2000;
        } else {
            h = input.height;
            s = Math.sqrt(h * h + half * half);
        }
        if (typeof h !== "number" || !isFinite(h) || h <= 0 || h > 2000 || !isFinite(s)) {
            fail("H 实际高度需大于 0 且不超过 2000 mm。", "H actual height must be greater than 0 and no more than 2000 mm.");
        }
        return { height: h, slant: s, heightMode: mode };
    }
    function validate(input) {
        var dimensions = resolveDimensions(input);
        var keys = ["topDiameter", "bottomDiameter", "height", "overlap", "bleed"];
        var p = {};
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i], n = key === "height" ? dimensions.height : input[key];
            if (key === "bleed" && typeof n === "undefined") n = 0;
            if (typeof n !== "number" || !isFinite(n) || n < 0 ||
                    (key !== "overlap" && key !== "bleed" && n === 0) || n > 2000) {
                fail("直径和 H 实际高度需大于 0；搭接与出血不小于 0；这几项均不得超过 2000 mm。",
                    "Diameters and H actual height must be > 0; overlap and bleed >= 0; each of these fields must be <= 2000 mm.");
            }
            p[key] = n;
        }
        if (p.topDiameter < p.bottomDiameter) {
            fail("上口直径不能小于下口直径。", "Top diameter must be at least the bottom diameter.");
        }
        p.slant = dimensions.slant; p.heightMode = dimensions.heightMode;
        p.annotations = input.annotations !== false;
        p.centerLine = typeof input.centerLine === "undefined" ? p.annotations : input.centerLine === true;
        p.overlapSide = typeof input.overlapSide === "undefined" ? "right" : input.overlapSide;
        if (p.overlapSide !== "left" && p.overlapSide !== "right") {
            fail("搭接位置请选择左侧或右侧。", "Choose left or right for the overlap.");
        }
        var counts = ["radialDivisions", "concentricDivisions"];
        for (i = 0; i < counts.length; i++) {
            key = counts[i]; n = typeof input[key] === "undefined" ? 1 : input[key];
            if (typeof n !== "number" || !isFinite(n) || n !== Math.floor(n) || n < 1 || n > 100) {
                fail("等份数需为 1 到 100 的整数；1 表示不加等分线。", "Divisions must be an integer from 1 to 100; 1 adds no division lines.");
            }
            p[key] = n;
        }
        p.showCenter = input.showCenter === true;
        p.centerMark = input.centerMark === true;
        p.dimensions = input.dimensions === true;
        return p;
    }
    function node(x, y) { return { anchor: [x, y], left: [x, y], right: [x, y] }; }
    // y uses cos(t)-1 = -2 sin(t/2)^2, avoiding catastrophic cancellation
    // when a nearly cylindrical cup has a very distant cone apex.
    function arc(radius, baseY, from, to) {
        var maxStep = Math.min(Math.PI / 4, Math.pow(0.0001 / Math.max(radius, 1), 1 / 6));
        var count = Math.max(1, Math.ceil(Math.abs(to - from) / maxStep));
        var step = (to - from) / count, nodes = [];
        for (var i = 0; i <= count; i++) {
            var t = from + step * i, sh = Math.sin(t / 2);
            var n = node(radius * Math.sin(t), baseY - 2 * radius * sh * sh);
            var k = (4 / 3) * Math.tan(step / 4);
            if (i > 0) n.left = [n.anchor[0] - k * radius * Math.cos(t), n.anchor[1] + k * radius * Math.sin(t)];
            if (i < count) n.right = [n.anchor[0] + k * radius * Math.cos(t), n.anchor[1] - k * radius * Math.sin(t)];
            nodes.push(n);
        }
        return nodes;
    }
    function shape(name, role, closed, nodes) { return { name: name, role: role, closed: closed, nodes: nodes }; }
    function point(radius, baseY, angle) {
        var s = Math.sin(angle / 2);
        return node(radius * Math.sin(angle), baseY - 2 * radius * s * s);
    }
    function boundsOf(paths) {
        var b = [Infinity, -Infinity, -Infinity, Infinity];
        for (var i = 0; i < paths.length; i++) {
            var ns = paths[i].nodes;
            for (var j = 0; j < ns.length; j++) {
                // Include handles: a conservative bound keeps the entire curve on canvas.
                var points = [ns[j].anchor, ns[j].left, ns[j].right];
                for (var k = 0; k < points.length; k++) {
                    var p = points[k];
                    if (!isFinite(p[0]) || !isFinite(p[1])) fail("尺寸计算超出范围。", "Geometry exceeds the supported range.");
                    b[0] = Math.min(b[0], p[0]); b[1] = Math.max(b[1], p[1]);
                    b[2] = Math.max(b[2], p[0]); b[3] = Math.min(b[3], p[1]);
                }
            }
        }
        return b;
    }
    function marker(model, name, role, x, y) {
        // The cross is always 4 mm wide/tall, independent of allowance and bleed.
        model.paths.push(shape(name + " H", role, false, [node(x - 2, y), node(x + 2, y)]));
        model.paths.push(shape(name + " V", role, false, [node(x, y - 2), node(x, y + 2)]));
    }
    function dimensionLine(model, name, a, b) {
        model.paths.push(shape(name, "dimension", false, [node(a[0], a[1]), node(b[0], b[1])]));
    }
    function dimensionArrows(model, name, a, b) {
        dimensionLine(model, name, a, b);
        var dx = b[0] - a[0], dy = b[1] - a[1], length = Math.sqrt(dx * dx + dy * dy);
        if (length < 0.001) return;
        dx /= length; dy /= length;
        var size = Math.min(2, length / 4), wing = size * 0.42;
        model.paths.push(shape(name + " A", "dimension", false, [
            node(a[0] + size * dx - wing * dy, a[1] + size * dy + wing * dx), node(a[0], a[1]),
            node(a[0] + size * dx + wing * dy, a[1] + size * dy - wing * dx)]));
        model.paths.push(shape(name + " B", "dimension", false, [
            node(b[0] - size * dx - wing * dy, b[1] - size * dy + wing * dx), node(b[0], b[1]),
            node(b[0] - size * dx + wing * dy, b[1] - size * dy - wing * dx)]));
    }
    function dimensionLabel(model, content, position, rotation) {
        model.labels.push({ text: content, position: position, rotation: rotation || 0, kind: "dimension" });
    }
    function addDimensions(model) {
        var p = model.parameters, l = model.slant;
        var topText = text("上弧长 ", "Top arc ") + number(model.measurements.topArc) + " mm";
        var bottomText = text("下弧长 ", "Bottom arc ") + number(model.measurements.bottomArc) + " mm";
        var wallText = text("S 斜坡长度 ", "S Slope length ") + number(l) + " mm";
        if (model.kind === "cylinder") {
            var w = model.measurements.topArc, left = -w / 2, right = w / 2;
            var gap = Math.max(7, p.bleed + 4), sideGap = gap + 2;
            var wallSide = p.overlapSide === "left" && p.overlap > 0 ? 1 : -1;
            var edge = wallSide > 0 ? right : left, dimX = edge + wallSide * sideGap;
            dimensionArrows(model, "上弧尺寸 / Top dimension", [left, l + gap], [right, l + gap]);
            dimensionArrows(model, "下弧尺寸 / Bottom dimension", [left, -gap], [right, -gap]);
            dimensionArrows(model, "S 尺寸 / S dimension", [dimX, 0], [dimX, l]);
            dimensionLine(model, "上左引线 / Top left witness", [left, l], [left, l + gap + 2]);
            dimensionLine(model, "上右引线 / Top right witness", [right, l], [right, l + gap + 2]);
            dimensionLine(model, "下左引线 / Bottom left witness", [left, 0], [left, -gap - 2]);
            dimensionLine(model, "下右引线 / Bottom right witness", [right, 0], [right, -gap - 2]);
            dimensionLine(model, "S 上引线 / S top witness", [edge, l], [dimX + 2 * wallSide, l]);
            dimensionLine(model, "S 下引线 / S bottom witness", [edge, 0], [dimX + 2 * wallSide, 0]);
            dimensionLabel(model, topText, [0, l + gap + 6], 0);
            dimensionLabel(model, bottomText, [0, -gap - 3], 0);
            dimensionLabel(model, wallText, [dimX + 3 * wallSide, l / 2], 90);
        } else {
            var ri = model.innerRadius, ro = model.outerRadius, a = model.angle / 2;
            gap = Math.max(7, p.bleed + 4);
            var innerGap = Math.min(gap, ri / 3); sideGap = Math.max(10, p.bleed + 4);
            model.paths.push(shape("上弧尺寸 / Top dimension", "dimension", false, arc(ro + gap, l + gap, -a, a)));
            model.paths.push(shape("下弧尺寸 / Bottom dimension", "dimension", false, arc(ri - innerGap, -innerGap, -a, a)));
            for (var side = -1; side <= 1; side += 2) {
                var angle = side * a;
                dimensionLine(model, "上弧引线 / Top witness", point(ro, l, angle).anchor, point(ro + gap + 2, l + gap + 2, angle).anchor);
                dimensionLine(model, "下弧引线 / Bottom witness", point(ri, 0, angle).anchor, point(ri - innerGap, -innerGap, angle).anchor);
            }
            // Offset the S dimension from the side opposite the allowance.
            wallSide = p.overlapSide === "left" && p.overlap > 0 ? 1 : -1;
            var sa = wallSide * a, nx = wallSide * Math.cos(sa), ny = -wallSide * Math.sin(sa);
            var inner = point(ri, 0, sa).anchor, outer = point(ro, l, sa).anchor;
            var s0 = [inner[0] + sideGap * nx, inner[1] + sideGap * ny];
            var s1 = [outer[0] + sideGap * nx, outer[1] + sideGap * ny];
            dimensionArrows(model, "S 尺寸 / S dimension", s0, s1);
            dimensionLine(model, "S 下引线 / S bottom witness", inner, [s0[0] + 2 * nx, s0[1] + 2 * ny]);
            dimensionLine(model, "S 上引线 / S top witness", outer, [s1[0] + 2 * nx, s1[1] + 2 * ny]);
            var rotation = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) * 180 / Math.PI;
            if (rotation > 90) rotation -= 180;
            if (rotation < -90) rotation += 180;
            dimensionLabel(model, topText, [0, l + gap + 6], 0);
            dimensionLabel(model, bottomText, [0, -innerGap - 3], 0);
            dimensionLabel(model, wallText, [(s0[0] + s1[0]) / 2 + 3 * nx, (s0[1] + s1[1]) / 2 + 3 * ny], rotation);
        }
    }
    function calculate(input) {
        var p = validate(input), delta = p.topDiameter - p.bottomDiameter;
        var l = p.slant;
        var model = { parameters: p, slant: l, innerRadius: null, outerRadius: null, angle: 0, paths: [], labels: [],
            circleCenter: null, bodyCenter: [0, l / 2], centerUnavailable: false,
            measurements: { topArc: Math.PI * p.topDiameter, bottomArc: Math.PI * p.bottomDiameter, wall: l } };
        var cut, body, width, i, side = p.overlapSide === "left" ? -1 : 1;
        if (delta === 0) {
            model.kind = "cylinder";
            width = Math.PI * p.topDiameter;
            if (p.overlap >= width) fail("搭接宽度应小于杯身周长。", "Overlap must be less than the cup circumference.");
            var left = -width / 2, right = width / 2;
            body = [node(left, l), node(right, l), node(right, 0), node(left, 0)];
            cut = [node(left - (side < 0 ? p.overlap : 0), l), node(right + (side > 0 ? p.overlap : 0), l),
                node(right + (side > 0 ? p.overlap : 0), 0), node(left - (side < 0 ? p.overlap : 0), 0)];
            model.paths.push(shape("裁切轮廓 / Cut", "cut", true, cut));
            if (p.overlap > 0) model.paths.push(shape("侧缝参考 / Seam", "seam", false,
                [node(side * width / 2, 0), node(side * width / 2, l)]));
            if (p.bleed > 0) model.paths.push(shape("出血轮廓（不含搭接） / Body bleed", "bleed", true,
                [node(left - p.bleed, l + p.bleed), node(right + p.bleed, l + p.bleed),
                    node(right + p.bleed, -p.bleed), node(left - p.bleed, -p.bleed)]));
            for (i = 1; i < p.radialDivisions; i++) {
                var x = left + width * i / p.radialDivisions;
                model.paths.push(shape("径向等分 " + i + " / Radial division", "radial", false, [node(x, 0), node(x, l)]));
            }
            for (i = 1; i < p.concentricDivisions; i++) {
                var y = l * i / p.concentricDivisions;
                model.paths.push(shape("同心等分 " + i + " / Concentric division", "concentric", false, [node(left, y), node(right, y)]));
            }
        } else {
            model.kind = "frustum";
            model.innerRadius = p.bottomDiameter * l / delta;
            model.outerRadius = p.topDiameter * l / delta;
            model.angle = Math.PI * delta / l;
            var a = model.angle / 2, ri = model.innerRadius, ro = model.outerRadius;
            model.circleCenter = [0, -ri];
            if (p.overlap >= ri) fail("搭接过宽，请减小搭接宽度。", "Overlap is too wide; reduce it.");
            var extraIn = Math.asin(p.overlap / ri), extraOut = Math.asin(p.overlap / ro);
            if (model.angle + extraIn >= TAU - 1e-10) {
                fail("搭接会与另一侧重叠，请减小搭接或增加杯高。", "The allowance crosses the other edge; reduce overlap or increase height.");
            }
            body = arc(ro, l, -a, a).concat(arc(ri, 0, a, -a));
            cut = arc(ro, l, -a - (side < 0 ? extraOut : 0), a + (side > 0 ? extraOut : 0))
                .concat(arc(ri, 0, a + (side > 0 ? extraIn : 0), -a - (side < 0 ? extraIn : 0)));
            model.paths.push(shape("裁切轮廓 / Cut", "cut", true, cut));
            if (p.overlap > 0) model.paths.push(shape("侧缝参考 / Seam", "seam", false,
                [point(ri, 0, side * a), point(ro, l, side * a)]));
            if (p.bleed > 0) {
                var b = p.bleed, bleedInner = ri - b, bleedOuter = ro + b;
                // A parallel offset is the intersection of shifted side lines with
                // concentric offset arcs. A scale transform is not an offset.
                if (bleedInner <= b) fail("出血过大会使下弧或侧边相交，请减小出血。", "Bleed collapses the inner arc; reduce the bleed.");
                var bi = Math.asin(b / bleedInner), bo = Math.asin(b / bleedOuter);
                if (model.angle + 2 * bi >= TAU - 1e-10) {
                    fail("出血会填满扇形缺口并使轮廓自交，请减小出血。", "Bleed closes the sector gap and crosses itself; reduce the bleed.");
                }
                model.paths.push(shape("出血轮廓（不含搭接） / Body bleed", "bleed", true,
                    arc(bleedOuter, l + b, -a - bo, a + bo).concat(arc(bleedInner, -b, a + bi, -a - bi))));
            }
            for (i = 1; i < p.radialDivisions; i++) {
                var t = -a + model.angle * i / p.radialDivisions;
                model.paths.push(shape("径向等分 " + i + " / Radial division", "radial", false, [point(ri, 0, t), point(ro, l, t)]));
            }
            for (i = 1; i < p.concentricDivisions; i++) {
                var along = l * i / p.concentricDivisions;
                model.paths.push(shape("同心等分 " + i + " / Concentric division", "concentric", false, arc(ri + along, along, -a, a)));
            }
        }
        model.paths.push(shape("图案区域 / Artwork area", "artwork", true, body));
        model.bodyBounds = boundsOf([shape("Body", "body", true, body)]);
        // Placement follows the actual paper outline/bleed; a distant theoretical
        // circle center and dimension graphics must not move or resize the body.
        var placement = [];
        for (i = 0; i < model.paths.length; i++) {
            if (model.paths[i].role === "cut" || model.paths[i].role === "bleed") placement.push(model.paths[i]);
        }
        model.placementBounds = boundsOf(placement);
        model.bounds = model.placementBounds;
        if (model.bounds[2] - model.bounds[0] > 5000 || model.bounds[1] - model.bounds[3] > 5000) {
            fail("展开尺寸过大，请检查输入的毫米尺寸。", "The template is too large; check the mm dimensions.");
        }
        if (p.centerLine) model.paths.push(shape("中心参考 / Center", "center", false, [node(0, 0), node(0, l)]));
        if (p.centerMark) marker(model, "杯身中心 / Body center", "centerMark", 0, l / 2);
        if (p.showCenter && model.circleCenter) {
            if (model.innerRadius > 4500) {
                model.centerUnavailable = true;
                model.centerNotice = text("圆心过远，超出普通画布范围；已保留纸样并省略圆心标记。", "The circle center is beyond the standard canvas; the template is kept without its center marker.");
            } else {
                marker(model, "圆心 O / Circle center O", "circleCenter", 0, -model.innerRadius);
                model.labels.push({ text: "O", position: [3, -model.innerRadius + 3], rotation: 0, kind: "circleCenter" });
            }
        }
        if (p.dimensions) addDimensions(model);
        return model;
    }
    function number(n) { return String(Math.round(n * 1000) / 1000); }
    function log(event, model, error) {
        try {
            var dir = new Folder(Folder.userData.fsName + "/HGScripts/logs");
            if (!dir.exists && !dir.create()) return;
            var file = new File(dir.fsName + "/paper_cup.log");
            // Bounded local diagnostics; never include artwork, paths or exception messages.
            if (file.exists && file.length > 262144) { if (file.open("w")) file.close(); }
            file.encoding = "UTF-8";
            if (!file.open("a")) return;
            var s = new Date().toString() + " event=" + event;
            if (model) s += " kind=" + model.kind + " paths=" + model.paths.length;
            if (error && typeof error.number === "number") s += " code=" + error.number;
            file.writeln(s); file.close();
        } catch (ignore) {}
    }
    function color(blue) {
        var c = new CMYKColor();
        if (blue === "bleed") { c.cyan = 0; c.magenta = 100; c.yellow = 0; c.black = 0; return c; }
        c.cyan = blue ? 85 : 0; c.magenta = blue ? 35 : 0; c.yellow = 0; c.black = blue ? 0 : 100;
        return c;
    }
    function draw(doc, model, options) {
        options = options || {};
        var oldLayer = doc.activeLayer, oldSelection = [], oldCoordinates = app.coordinateSystem;
        var layer = null, groups = [], ownedLayers = [], ownedItems = [], roleLayers = {}, roleGroups = {}, ownedGroupIds = {};
        var i, selection = doc.selection;
        if (selection) for (i = 0; i < selection.length; i++) oldSelection.push(selection[i]);
        try {
            if (doc.scaleFactor && doc.scaleFactor !== 1) fail("请在普通尺寸文档中生成纸样。", "Use a standard-size document for this template.");
            app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
            var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
            var b = model.placementBounds || model.bounds, midX = (b[0] + b[2]) / 2, midY = (b[1] + b[3]) / 2;
            var cx = (ab[0] + ab[2]) / 2, cy = (ab[1] + ab[3]) / 2;
            // All original art/layers stay untouched, including locked/hidden active layers.
            layer = doc.layers.add(); layer.name = options.preview ? text("纸杯预览（临时）", "Paper Cup Preview (temporary)") : text("纸杯展开", "Paper Cup Template");
            layer.locked = false; layer.visible = true;
            // These are actual Illustrator sublayers, so each purpose has its
            // own visibility/lock switch. Groups only organize art inside them.
            function groupFor(role) {
                if (roleGroups[role]) return roleGroups[role];
                var names = {
                    cut: ["裁切轮廓", "Cut outline"], artwork: ["图案区域", "Artwork area"], bleed: ["出血轮廓", "Bleed outline"],
                    seam: ["搭接侧缝", "Overlap seam"], radial: ["径向等分线", "Radial divisions"],
                    concentric: ["同心等分线", "Concentric divisions"], center: ["中心虚线", "Center dashed line"],
                    centerMark: ["杯身中心十字", "Body center cross"], circleCenter: ["圆心 O", "Circle center O"],
                    dimension: ["尺寸标注", "Dimensions"], notes: ["纸样说明文字", "Template notes"]
                };
                if (!names[role]) throw new Error("Unknown paper cup layer role");
                var child = layer.layers.add(); child.name = text(names[role][0], names[role][1]);
                child.locked = false; child.visible = true;
                var group = child.groupItems.add(); group.name = child.name;
                if (typeof group.uuid !== "string" || !group.uuid) fail("宿主不支持纸样对象标识。", "The host does not support template object IDs.");
                ownedGroupIds["id_" + group.uuid] = { layer: child };
                ownedLayers.push(child); groups.push(group);
                roleLayers[role] = child; roleGroups[role] = group;
                return group;
            }
            function convert(p) { return [(p[0] - midX) * PT + cx, (p[1] - midY) * PT + cy]; }
            for (i = 0; i < model.paths.length; i++) {
                var spec = model.paths[i], item = groupFor(spec.role).pathItems.add();
                ownedItems.push(item);
                item.name = spec.name; item.filled = false; item.stroked = true;
                var solid = spec.role === "cut" || spec.role === "artwork" || spec.role === "dimension" || spec.role === "centerMark" || spec.role === "circleCenter";
                item.strokeColor = color(spec.role === "bleed" ? "bleed" : spec.role === "artwork" || !solid); item.strokeWidth = spec.role === "cut" ? 0.5 : 0.35;
                item.strokeDashes = solid ? [] : [3, 2];
                for (var j = 0; j < spec.nodes.length; j++) {
                    var n = spec.nodes[j], pp = item.pathPoints.add();
                    pp.anchor = convert(n.anchor); pp.leftDirection = convert(n.left); pp.rightDirection = convert(n.right);
                    pp.pointType = PointType.CORNER;
                }
                item.closed = spec.closed;
            }
            if (model.labels) for (i = 0; i < model.labels.length; i++) {
                var label = model.labels[i], labelText = groupFor(label.kind).textFrames.add();
                ownedItems.push(labelText);
                labelText.contents = label.text;
                labelText.textRange.characterAttributes.size = 9;
                labelText.textRange.characterAttributes.fillColor = color(false);
                try { labelText.textRange.characterAttributes.textFont = app.textFonts.getByName("MicrosoftYaHei"); } catch (labelFontError) {}
                if (label.rotation) labelText.rotate(label.rotation);
                labelText.position = convert(label.position);
            }
            if (model.parameters.annotations) {
                var p = model.parameters, lines = [
                    text("纸杯展开", "Paper Cup Template") + "  |  " + text("A 上口 ", "A Top ") + number(p.topDiameter) +
                        " / " + text("B 下口 ", "B Bottom ") + number(p.bottomDiameter) + " mm",
                    text("H 实际高度 ", "H Actual height ") + number(p.height) + " mm  |  " +
                        text("S 斜坡长度 ", "S Slope length ") + number(model.slant) + " mm",
                    text("搭接 ", "Overlap ") + number(p.overlap) + text(" mm · 虚线仅参考 · 100% 打印 · 不含卷口和封底", " mm - dashed lines are references - print at 100% - rim/base excluded")
                ];
                for (i = 0; i < lines.length; i++) {
                    var tf = groupFor("notes").textFrames.add(); ownedItems.push(tf); tf.contents = lines[i];
                    tf.textRange.characterAttributes.size = 10;
                    tf.textRange.characterAttributes.fillColor = color(false);
                    try { tf.textRange.characterAttributes.textFont = app.textFonts.getByName("MicrosoftYaHei"); } catch (fontError) {}
                    tf.position = [cx - (b[2] - b[0]) * PT / 2, cy + (b[3] - midY) * PT - 18 - i * 16];
                }
            }
            if (options.preview) {
                try { doc.activeLayer = oldLayer; doc.selection = oldSelection; } catch (previewSelectionError) {}
            } else {
                doc.selection = null;
                for (i = 0; i < groups.length; i++) groups[i].selected = true;
            }
            log(options.preview ? "preview" : "created", model, null);
            return { layer: layer, groups: groups, ownedLayers: ownedLayers, ownedItems: ownedItems,
                roleLayers: roleLayers, roleGroups: roleGroups, ownedGroupIds: ownedGroupIds };
        } catch (error) {
            try { if (layer) layer.remove(); } catch (removeError) {}
            try { doc.activeLayer = oldLayer; doc.selection = oldSelection; } catch (restoreError) {}
            log("draw_failed", model, error);
            throw error;
        } finally {
            try { app.coordinateSystem = oldCoordinates; } catch (coordinateError) {}
        }
    }
    // One in-flight host operation. Edits coalesce, but explicit generations and
    // cleanup barriers retain their order. A late completion cannot unlock twice.
    function createController(transport) {
        var queue = [], active = false, disposed = false;
        function finishCallback(callback, error, result) {
            try { if (callback) callback(error, result); } catch (callbackError) { log("callback_failed", null, callbackError); }
        }
        function pump() {
            if (active || !queue.length) return;
            var task = queue.shift(), done = false; active = true;
            function complete(error, result) {
                if (done) return; done = true; active = false;
                finishCallback(task.callback, error || null, result); pump();
            }
            try { transport(task.action, task.input, complete); } catch (error) { complete(error, null); }
        }
        function enqueue(action, input, callback, closing) {
            if (disposed && !closing) { finishCallback(callback, new Error(text("窗口已经关闭。", "The window is closed.")), null); return; }
            if (action !== "preview") {
                for (var i = queue.length - 1; i >= 0; i--) if (queue[i].action === "preview") queue.splice(i, 1);
            } else if (queue.length && queue[queue.length - 1].action === "preview") queue.pop();
            queue.push({ action: action, input: input, callback: callback }); pump();
        }
        return {
            preview: function (input, cb) { enqueue("preview", input, cb); },
            generate: function (input, cb) { enqueue("generate", input, cb); },
            clear: function (cb) { enqueue("clear", null, cb); },
            dispose: function (cb) { if (disposed) return; disposed = true; enqueue("clear", null, cb, true); }
        };
    }
    function serialize(value) {
        if (value === null || typeof value === "undefined") return "null";
        if (typeof value === "string") return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/[\u0000-\u001f\u2028\u2029]/g,
                function (c) { return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4); }) + '"';
        if (typeof value === "number") return isFinite(value) ? String(value) : "null";
        if (typeof value === "boolean") return String(value);
        var parts = [], key;
        if (value instanceof Array) { for (var i = 0; i < value.length; i++) parts.push(serialize(value[i])); return "[" + parts.join(",") + "]"; }
        for (key in value) if (value.hasOwnProperty(key)) parts.push(serialize(key) + ":" + serialize(value[key]));
        return "{" + parts.join(",") + "}";
    }
    function documentOpen(doc) {
        try { for (var i = 0; i < app.documents.length; i++) if (app.documents[i] === doc) return true; } catch (error) {}
        return false;
    }
    function clearPreview(state) {
        if (!state) return;
        function reset() {
            state.doc = null; state.layer = null; state.group = null;
            state.groups = []; state.ownedLayers = []; state.ownedItems = [];
            state.roleLayers = {}; state.roleGroups = {};
            state.ownedGroupIds = {};
        }
        if (!documentOpen(state.doc)) { reset(); return; }
        try {
            // Access this reference before arrays of children: Illustrator can
            // invalidate the whole child reference array when its layer is deleted.
            if (!state.layer || !state.layer.parent) { reset(); return; }
            var rootLock = state.layer.locked;
        } catch (removedRoot) {
            if (removedRoot.number === 45) { reset(); return; }
            throw removedRoot;
        }
        var previousDocument = app.documents.length ? app.activeDocument : null;
        var switchedDocument = previousDocument !== state.doc;
        // Layer lock/visibility setters require the owning document to be active
        // in Illustrator. Always return the user to the document being edited.
        if (switchedDocument) state.doc.activate();
        try {
        // Retain precise references. Names are not proof of ownership; users may
        // add art (or empty sublayers) anywhere in a temporary preview hierarchy.
        var items = state.ownedItems || [], groups = state.groups || (state.group ? [state.group] : []);
        var layers = [], saved = [];
        // Enumerate live children instead of touching a cached deleted Layer
        // proxy. Group UUIDs prove ownership independently of editable names.
        var groupIds = state.ownedGroupIds || {};
        for (var candidateIndex = 0; candidateIndex < state.layer.layers.length; candidateIndex++) {
            var candidate = state.layer.layers[candidateIndex];
            for (var groupIndex = 0; groupIndex < candidate.groupItems.length; groupIndex++) {
                var liveGroup = candidate.groupItems[groupIndex];
                var owner = groupIds["id_" + liveGroup.uuid];
                if (liveGroup.parent === candidate && owner) {
                    try { if (owner.layer === candidate) { layers.push(candidate); break; } }
                    catch (missingOwner) { if (missingOwner.number !== 45) throw missingOwner; }
                }
            }
        }
        function alive(item) {
            try {
                if (!item || !item.parent) return false;
                if (item.typename === "Document") return true;
                // Manually deleted ancestors can leave proxies with readable
                // parent/typename but invalid state properties (Illustrator 45).
                var locked = item.locked;
                var shown = item.typename === "Layer" ? item.visible : item.hidden;
                return typeof locked === "boolean" && typeof shown === "boolean";
            } catch (gone) { return false; }
        }
        function unlock(item) {
            var chain = [], current = item, i, j;
            while (alive(current) && current.typename !== "Document") {
                chain.push(current); current = current.parent;
            }
            // Unlock/show ancestors first. Restore in reverse order so a retained
            // locked parent cannot block restoration of its children.
            for (i = chain.length - 1; i >= 0; i--) {
                var target = chain[i], known = false;
                for (j = 0; j < saved.length; j++) if (!saved[j].removed && saved[j].item === target) { known = true; break; }
                if (known) continue;
                var flags = { item: target, locked: target.locked };
                if (target.typename === "Layer") flags.visible = target.visible;
                else flags.hidden = target.hidden;
                saved.push(flags);
                target.locked = false;
                if (target.typename === "Layer") target.visible = true; else target.hidden = false;
            }
        }
        function removeOwned(item) {
            if (!alive(item)) return;
            unlock(item);
            var ownFlags = null;
            for (var f = 0; f < saved.length; f++) if (!saved[f].removed && saved[f].item === item) { ownFlags = saved[f]; break; }
            item.remove();
            // A removed Illustrator proxy may still expose parent. Do not probe
            // or restore a native object whose successful deletion we witnessed.
            if (ownFlags) ownFlags.removed = true;
        }
        function removeAt(list, index, kind) {
            // Retrieve native references inside the guard. Passing a deleted
            // proxy as a function argument can throw before alive() is entered.
            try {
                var target = list[index];
                if (!alive(target)) return;
                if (kind === "group" && target.pageItems.length !== 0) return;
                if (kind === "layer" && (target.pageItems.length !== 0 || target.layers.length !== 0)) return;
                removeOwned(target);
            } catch (missing) { if (missing.number !== 45) throw missing; }
        }
        try {
            for (var i = items.length - 1; i >= 0; i--) removeAt(items, i, "item");
            for (i = groups.length - 1; i >= 0; i--) removeAt(groups, i, "group");
            for (i = layers.length - 1; i >= 0; i--) removeAt(layers, i, "layer");
            if (alive(state.layer) && state.layer.pageItems.length === 0 && state.layer.layers.length === 0) removeOwned(state.layer);
        } finally {
            for (var s = saved.length - 1; s >= 0; s--) {
                var flags = saved[s];
                try {
                    if (flags.removed || !alive(flags.item)) continue;
                    if (typeof flags.visible !== "undefined") flags.item.visible = flags.visible;
                    if (typeof flags.hidden !== "undefined") flags.item.hidden = flags.hidden;
                    flags.item.locked = flags.locked;
                } catch (missingFlag) { if (missingFlag.number !== 45) throw missingFlag; }
            }
        }
        reset();
        } finally {
            if (switchedDocument && documentOpen(previousDocument)) previousDocument.activate();
        }
    }
    function hostAction(action, input, sessionId) {
        var states = $.global.HG_PAPER_CUP_HOST_STATE;
        if (!states) states = $.global.HG_PAPER_CUP_HOST_STATE = {};
        var key = "cup_" + sessionId, state = states[key] || (states[key] = {});
        var doc = null, created = false, result = null;
        try {
            if (action === "clear") {
                clearPreview(state); delete states[key];
                if (app.documents.length) app.redraw();
                return { ok: true, cleared: true, message: text("预览已清除。", "Preview cleared.") };
            }
            if (action !== "preview" && action !== "generate") throw new Error("Unknown cup action");
            var model;
            try { model = calculate(input); } catch (invalid) { clearPreview(state); throw invalid; }
            if (app.documents.length) doc = app.activeDocument;
            else if (action === "preview") { clearPreview(state); return { ok: false, message: text("请先打开文档以预览；也可直接点生成新建文档。", "Open a document to preview, or click Generate to create one.") }; }
            else {
                var b = model.placementBounds || model.bounds;
                doc = app.documents.add(DocumentColorSpace.CMYK, (b[2] - b[0] + 40) * PT,
                    (b[1] - b[3] + (model.parameters.annotations ? 80 : 40)) * PT); created = true;
            }
            result = draw(doc, model, { preview: action === "preview" });
            try { clearPreview(state); } catch (cleanupError) { result.layer.remove(); result = null; throw cleanupError; }
            if (action === "preview") {
                state.doc = doc; state.layer = result.layer; state.groups = result.groups;
                state.ownedLayers = result.ownedLayers; state.ownedItems = result.ownedItems;
                state.roleLayers = result.roleLayers; state.roleGroups = result.roleGroups;
                state.ownedGroupIds = result.ownedGroupIds;
            }
            else delete states[key];
            app.redraw();
            return { ok: true, generated: action === "generate", preview: action === "preview",
                message: model.centerNotice || (action === "preview" ? text("实时预览已更新。", "Live preview updated.") : text("纸样已生成，可继续调整尺寸。", "Template generated. You can keep editing dimensions.")) };
        } catch (error) {
            if (created && doc) try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
            log("host_" + action + "_failed", null, error);
            return { ok: false, message: error.message || String(error) };
        }
    }
    function createTransport(sourcePath, sessionId, language) {
        return function (action, input, callback) {
            var bt = new BridgeTalk(), done = false;
            var registry = $.global.HG_PAPER_CUP_MESSAGES || ($.global.HG_PAPER_CUP_MESSAGES = {});
            var messageId = sessionId + "_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000000);
            // Keep closing palettes' messages alive until cleanup completes.
            registry[messageId] = bt;
            bt.target = BridgeTalk.appSpecifier || ("illustrator-" + parseInt(app.version, 10));
            // Cleanup must remain queued while Illustrator is busy; expiring a
            // closing palette's clear would leave a temporary group behind.
            if (action !== "clear") bt.timeout = 30;
            bt.body = "(function(){var old=$.global.HG_PAPER_CUP_NO_MAIN,lang=$.global.HGSCRIPTS_LANGUAGE;try{" +
                "$.global.HG_PAPER_CUP_NO_MAIN=true;$.global.HGSCRIPTS_LANGUAGE=" + serialize(language) + ";" +
                "$.evalFile(new File(" + serialize(sourcePath) + "));return HGPaperCup.serialize(HGPaperCup.hostAction(" +
                serialize(action) + "," + serialize(input) + "," + serialize(sessionId) + "));" +
                "}finally{$.global.HG_PAPER_CUP_NO_MAIN=old;$.global.HGSCRIPTS_LANGUAGE=lang;}}())";
            function complete(error, result) {
                if (done) return; done = true; delete registry[messageId]; callback(error, result);
            }
            bt.onResult = function (reply) {
                try { var result = eval("(" + reply.body + ")"); complete(result.ok ? null : new Error(result.message), result); }
                catch (error) { log("bridge_reply_failed", null, error); complete(error, null); }
            };
            bt.onError = function (reply) {
                var code = 0; try { code = Number(reply.headers["Error-Code"]) || 0; } catch (noHeader) {}
                log("bridge_" + action + "_failed", null, { number: code });
                complete(new Error(text("Illustrator 执行失败，请查看隐藏日志。", "Illustrator could not execute the operation. See the local log.")), null);
            };
            bt.onTimeout = function () { log("bridge_queue_expired", null, null); complete(new Error(text("Illustrator 正忙，排队操作已超时。", "Illustrator is busy; the queued operation expired.")), null); };
            try { bt.send(); } catch (sendError) { log("bridge_send_failed", null, sendError); complete(sendError, null); }
        };
    }
    function comfortable(control, padding) {
        try {
            control.minimumSize.height = Math.max(28, Math.ceil(control.graphics.measureString("国gjpqy").height + padding));
        } catch (ignore) { control.minimumSize.height = 32; }
    }
    function createDialog(controller) {
        var win = new Window("palette", text("纸杯展开", "Paper Cup Template"));
        win.orientation = "column"; win.alignChildren = ["fill", "top"];
        win.margins = 14; win.spacing = 9;
        var closed = false, revision = 0, committing = false, lastModel = null;
        var heightMode = "height", syncingDimensions = false, shownHeight = "100", shownSlant = "";
        var body = win.add("group"); body.alignChildren = ["fill", "top"]; body.spacing = 12;
        var tabs = body.add("tabbedpanel"); tabs.alignChildren = ["fill", "top"];
        tabs.preferredSize.width = 338;
        var sizes = tabs.add("tab", undefined, text("尺寸与搭接", "Dimensions"));
        var guides = tabs.add("tab", undefined, text("辅助与标注", "Guides & labels"));
        var pages = [sizes, guides], fieldLabels = [];
        for (var pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            pages[pageIndex].orientation = "column";
            pages[pageIndex].alignChildren = ["fill", "top"];
            pages[pageIndex].margins = 12; pages[pageIndex].spacing = 7;
        }
        function field(parent, label, value, unit, stepper) {
            var row = parent.add("group"); row.alignChildren = ["left", "center"]; row.spacing = 8;
            var title = row.add("statictext", undefined, label); fieldLabels.push(title); comfortable(title, 8);
            var input = row.add("edittext", undefined, value);
            input.characters = 7; input.preferredSize.width = 78; comfortable(input, 12);
            if (stepper) {
                var steps = row.add("group"); steps.orientation = "column"; steps.spacing = 0; steps.margins = 0;
                steps.alignChildren = ["fill", "fill"];
                function triangle(direction) {
                    // Empty native buttons with vector icons avoid clipping triangle glyphs at high DPI.
                    var button = steps.add("button", undefined, "");
                    var stepErrorLogged = false;
                    var iconHeight = Math.max(17, Math.ceil(input.minimumSize.height / 2));
                    button.preferredSize = [24, iconHeight]; button.minimumSize = [24, iconHeight];
                    button.helpTip = direction > 0 ? text("增加 1 等份", "Add 1 part") : text("减少 1 等份", "Subtract 1 part");
                    button.onDraw = function () {
                        try {
                            var g = this.graphics; g.drawOSControl();
                            var width = this.size.width, h = this.size.height, x = width / 2, y = h / 2;
                            var ink = [0.9, 0.9, 0.9, 1];
                            try { if (g.foregroundColor && g.foregroundColor.color) ink = g.foregroundColor.color; } catch (themeError) {}
                            var brush = g.newBrush(g.BrushType.SOLID_COLOR, this.enabled ? ink : [0.5, 0.5, 0.5, 1]);
                            g.newPath(); g.moveTo(x, y - 3 * direction); g.lineTo(x - 4, y + 2 * direction);
                            g.lineTo(x + 4, y + 2 * direction); g.closePath(); g.fillPath(brush);
                        } catch (stepDrawError) {
                            if (!stepErrorLogged) { log("division_button_draw_failed", null, stepDrawError); stepErrorLogged = true; }
                        }
                    };
                    button.onClick = function () {
                        try {
                            var value = parseParts(input.text, label);
                            input.text = String(Math.max(1, Math.min(100, value + direction))); refresh();
                        } catch (stepError) { clearPreview(errorMessage(stepError)); }
                    };
                    return button;
                }
                input.stepUp = triangle(1); input.stepDown = triangle(-1);
            }
            var suffix = row.add("statictext", undefined, unit || "mm"); comfortable(suffix, 8);
            return input;
        }
        function check(parent, label, value) {
            var item = parent.add("checkbox", undefined, label); item.value = value; comfortable(item, 10); return item;
        }
        function note(parent, zh, en, width, lines) {
            var item = parent.add("statictext", undefined, text(zh, en), { multiline: true });
            item.preferredSize.width = width;
            try { item.preferredSize.height = Math.ceil(item.graphics.measureString("国gjpqy").height * lines + 12); }
            catch (ignore) { item.preferredSize.height = lines * 20 + 12; }
            return item;
        }
        var top = field(sizes, text("A 上口直径", "A Top diameter"), "90");
        var bottom = field(sizes, text("B 下口直径", "B Bottom diameter"), "60");
        var height = field(sizes, text("H 实际高度", "H Actual height"), "100");
        var slant = field(sizes, text("S 斜坡长度", "S Slope length"), "");
        height.characters = slant.characters = 11;
        height.preferredSize.width = slant.preferredSize.width = 108;
        var overlap = field(sizes, text("侧边搭接宽度", "Side overlap width"), "0");
        var sideRow = sizes.add("group"); sideRow.alignChildren = ["left", "center"]; sideRow.spacing = 8;
        var sideLabel = sideRow.add("statictext", undefined, text("搭接所在侧", "Overlap side"));
        comfortable(sideLabel, 8); fieldLabels.push(sideLabel);
        var side = sideRow.add("dropdownlist", undefined, [text("右侧", "Right"), text("左侧", "Left")]);
        side.selection = 0; side.preferredSize.width = 110; comfortable(side, 12);
        var bleed = field(sizes, text("出血宽度", "Bleed width"), "0");
        note(sizes, "出血以杯身为准，不包住搭接外缘。\n全部填写毫米；不需要的余量填 0。",
            "Bleed follows the body, excluding the overlap edge.\nAll sizes are in mm; use 0 for no allowance.", 306, 3);
        var radial = field(guides, text("角度方向分成", "Angular divisions"), "1", text("等份", "parts"), true);
        var concentric = field(guides, text("杯壁方向分成", "Wall divisions"), "1", text("等份", "parts"), true);
        radial.helpTip = text("填 4 等份，会生成 3 条内部径向虚线。等径杯按矩形宽度等分。",
            "4 parts create 3 interior radial lines. Equal diameters divide the rectangle width.");
        concentric.helpTip = text("沿 S 斜坡长度等距离分层。填 4 等份生成 3 条同心弧线；等径杯生成水平线。",
            "Equal distances along slope length S: 4 parts create 3 concentric arcs, or horizontal lines for a cylinder.");
        var centerLine = check(guides, text("中心虚线", "Center dashed line"), true);
        var showCenter = check(guides, text("标出圆心 O（可能在画板外）", "Circle center O (may be off artboard)"), false);
        var centerMark = check(guides, text("杯身中心十字（不含搭接）", "Body center cross (excludes overlap)"), false);
        var dimensions = check(guides, text("尺寸标注：上弧 / 下弧 / S", "Dimensions: top / bottom / S"), false);
        var annotations = check(guides, text("添加纸样说明文字", "Add template notes"), true);
        note(guides, "1 等份不加线；最多 100 等份。\n等径杯按矩形等分，不显示圆心。\n中心十字在中心线的上下弧中点。",
            "1 part adds no lines; up to 100 parts.\nEqual diameters use a rectangle; no circle center.\nThe cross is halfway along the center wall.", 306, 4);
        var labelWidth = 125;
        for (var labelIndex = 0; labelIndex < fieldLabels.length; labelIndex++) {
            labelWidth = Math.max(labelWidth, Math.ceil(fieldLabels[labelIndex].graphics.measureString(fieldLabels[labelIndex].text).width + 8));
        }
        for (labelIndex = 0; labelIndex < fieldLabels.length; labelIndex++) fieldLabels[labelIndex].preferredSize.width = labelWidth;
        tabs.selection = sizes;
        height.helpTip = text("绿色 H：杯子直立时，上下口之间的垂直距离，不沿斜杯壁量。",
            "Green H: vertical distance between the upright cup's openings, not along the sloping wall.");
        slant.helpTip = text("橙色 S：沿杯壁斜坡的长度，也是展开纸片上下弧之间的距离。修改 S 会自动计算实际高度 H。",
            "Orange S: length along the sloping wall, also the distance between the flat paper's arcs. Editing S calculates actual height H.");
        overlap.helpTip = text("垂直侧缝的搭接宽度；可选左侧或右侧，不需要时填 0。",
            "Width perpendicular to the seam, on the left or right; use 0 for none.");
        var help = body.add("panel", undefined, text("看图对应尺寸", "Match the dimensions"));
        help.orientation = "column"; help.alignChildren = ["fill", "top"]; help.margins = 10; help.spacing = 6;
        var sketch = help.add("panel"); sketch.preferredSize = [340, 205];
        var diagramErrorLogged = false;
        sketch.onDraw = function () {
            try {
                var g = this.graphics;
                var outline = g.newPen(g.PenType.SOLID_COLOR, [0.85, 0.88, 0.91, 1], 1.3);
                var blue = g.newPen(g.PenType.SOLID_COLOR, [0.40, 0.77, 1, 1], 1.8);
                var green = g.newPen(g.PenType.SOLID_COLOR, [0.40, 0.95, 0.60, 1], 1.8);
                var orange = g.newPen(g.PenType.SOLID_COLOR, [1, 0.69, 0.30, 1], 2);
                var fill = g.newBrush(g.BrushType.SOLID_COLOR, [0.20, 0.24, 0.28, 1]);
                function line(x1, y1, x2, y2, pen) { g.newPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath(pen); }
                function label(s, x, y, pen) { g.drawString(s, pen, x, y, g.font); }
                function centered(s, x, y, pen) { label(s, x - g.measureString(s).width / 2, y, pen); }
                function arrow(x1, y1, x2, y2, pen) {
                    line(x1, y1, x2, y2, pen);
                    var a = Math.atan2(y2 - y1, x2 - x1), size = 5;
                    line(x1, y1, x1 + size * Math.cos(a - 0.45), y1 + size * Math.sin(a - 0.45), pen);
                    line(x1, y1, x1 + size * Math.cos(a + 0.45), y1 + size * Math.sin(a + 0.45), pen);
                    line(x2, y2, x2 - size * Math.cos(a - 0.45), y2 - size * Math.sin(a - 0.45), pen);
                    line(x2, y2, x2 - size * Math.cos(a + 0.45), y2 - size * Math.sin(a + 0.45), pen);
                }
                centered(text("卷好后的纸杯", "Formed cup"), 85, 2, outline);
                centered(text("摊平后的纸片", "Flat paper"), 263, 2, outline);
                // Direction diagrams only. The preview checkbox draws actual-size art on the canvas.
                g.newPath(); g.moveTo(35, 58); g.lineTo(52, 152); g.lineTo(108, 152); g.lineTo(125, 58); g.closePath();
                g.fillPath(fill); g.strokePath(outline);
                g.newPath(); g.ellipsePath(35, 51, 90, 14); g.strokePath(outline);
                arrow(35, 35, 125, 35, blue); centered("A", 80, 15, blue);
                arrow(52, 172, 108, 172, blue); centered("B", 80, 178, blue);
                arrow(157, 58, 157, 152, green); label("H", 164, 94, green);
                line(147, 58, 161, 58, green); line(113, 152, 161, 152, green);
                arrow(136, 60, 119, 150, orange); label("S", 129, 111, orange);
                line(179, 112, 194, 112, outline); line(194, 112, 189, 108, outline); line(194, 112, 189, 116, outline);
                var cx = 263, cy = 250, ro = 120, ri = 75, a = 0.60, n = 24;
                g.newPath(); g.moveTo(cx - ro * Math.sin(a), cy - ro * Math.cos(a));
                for (var i = 1; i <= n; i++) { var t = -a + 2 * a * i / n; g.lineTo(cx + ro * Math.sin(t), cy - ro * Math.cos(t)); }
                for (i = 0; i <= n; i++) { t = a - 2 * a * i / n; g.lineTo(cx + ri * Math.sin(t), cy - ri * Math.cos(t)); }
                g.closePath(); g.fillPath(fill); g.strokePath(outline);
                arrow(cx, cy - ro, cx, cy - ri, orange); label("S", cx + 8, 143, orange);
                centered(text("这里量到 S", "Measure S here"), 263, 184, orange);
            } catch (diagramError) {
                if (!diagramErrorLogged) { log("diagram_failed", null, diagramError); diagramErrorLogged = true; }
            }
        };
        var formedValue = help.add("statictext", undefined, " ");
        var flatValue = help.add("statictext", undefined, " ");
        formedValue.graphics.foregroundColor = formedValue.graphics.newPen(formedValue.graphics.PenType.SOLID_COLOR, [0.40, 0.95, 0.60, 1], 1);
        flatValue.graphics.foregroundColor = flatValue.graphics.newPen(flatValue.graphics.PenType.SOLID_COLOR, [1, 0.69, 0.30, 1], 1);
        comfortable(formedValue, 8); comfortable(flatValue, 8);
        note(help, "H 实际高度、S 斜坡长度，改一项自动算另一项。\nA、B 量直径，避开卷边和底脚。\n图示仅说明方向，不按实际比例。",
            "Edit actual height H or slope length S; the other updates.\nA/B are diameters; exclude rolled rim and foot.\nDiagrams explain directions, not actual scale.", 340, 4);
        var preview = win.add("checkbox", undefined, text("预览：在画板上实时更新", "Preview: update the canvas live"));
        preview.value = false; comfortable(preview, 10);
        preview.helpTip = text("编辑参数后更新临时纸样；关闭预览或窗口会移除临时纸样。点击“生成”保留正式纸样。",
            "Edits update a temporary template. Turning preview off or closing removes it. Generate keeps a final template.");
        var statusText = win.add("statictext", undefined, " ", { multiline: true });
        statusText.preferredSize.width = 700;
        try { statusText.preferredSize.height = Math.ceil(statusText.graphics.measureString("国gjpqy").height * 2 + 12); }
        catch (ignore) { statusText.preferredSize.height = 50; }
        var buttons = win.add("group"); buttons.alignment = "right";
        var generate = buttons.add("button", undefined, text("生成纸样", "Generate template"));
        var close = buttons.add("button", undefined, text("关闭", "Close"));
        generate.minimumSize.width = 130; close.minimumSize.width = 90;
        comfortable(generate, 14); comfortable(close, 14);
        function errorMessage(error) {
            return error && error.message ? String(error.message) : String(error || text("操作未完成。", "The operation did not finish."));
        }
        function setBusy(busy) { committing = !!busy; generate.enabled = !committing; }
        function parseParts(value, label) {
            var n = parseNumber(value, label, false);
            if (Math.floor(n) !== n || n < 1 || n > 100) fail(label + "：请输入 1 到 100 的整数。", label + ": enter a whole number from 1 to 100.");
            return n;
        }
        function getInput() {
            var input = {
                topDiameter: parseNumber(top.text, text("上口直径", "Top diameter"), false),
                bottomDiameter: parseNumber(bottom.text, text("下口直径", "Bottom diameter"), false),
                heightMode: heightMode,
                height: heightMode === "height" ? parseNumber(height.text, text("H 实际高度", "H Actual height"), false) : 0,
                slant: heightMode === "slant" ? parseNumber(slant.text, text("S 斜坡长度", "S Slope length"), false) : 0,
                overlap: parseNumber(overlap.text, text("搭接宽度", "Overlap width"), true),
                overlapSide: side.selection && side.selection.index === 1 ? "left" : "right",
                bleed: parseNumber(bleed.text, text("出血宽度", "Bleed width"), true),
                radialDivisions: parseParts(radial.text, text("角度等分", "Angular divisions")),
                concentricDivisions: parseParts(concentric.text, text("杯壁等分", "Wall divisions")),
                centerLine: centerLine.value, showCenter: showCenter.enabled && showCenter.value,
                centerMark: centerMark.value, dimensions: dimensions.value, annotations: annotations.value
            };
            var resolved = resolveDimensions(input);
            input.height = resolved.height; input.slant = resolved.slant;
            return input;
        }
        function dimensionNumber(value) { return value.toFixed(6).replace(/\.?0+$/, ""); }
        function clearPreview(message) {
            var ticket = ++revision;
            if (message) statusText.text = message;
            try {
                if (controller && controller.clear) controller.clear(function (error) {
                    if (!closed && ticket === revision && error) statusText.text = errorMessage(error);
                });
            } catch (clearError) { if (!closed && ticket === revision) statusText.text = errorMessage(clearError); }
        }
        function refresh() {
            if (closed) return;
            revision++;
            var input, model;
            try {
                var td = parseNumber(top.text, "A", false), bd = parseNumber(bottom.text, "B", false);
                showCenter.enabled = td !== bd;
                showCenter.helpTip = showCenter.enabled ? text("显示同心圆的公共圆心，可能远离纸样。", "Show the common circle center, which may be far from the template.") :
                    text("上下口等径时展开为矩形，没有有限圆心。", "Equal diameters unfold to a rectangle with no finite circle center.");
                input = getInput(); model = calculate(input); lastModel = model;
                syncingDimensions = true;
                try {
                    if (heightMode === "height") slant.text = dimensionNumber(input.slant);
                    else height.text = dimensionNumber(input.height);
                    shownHeight = height.text; shownSlant = slant.text;
                } finally { syncingDimensions = false; }
                formedValue.text = text("H 实际高度", "H Actual height") +
                    (heightMode === "height" ? text("（填写）：", " (input): ") : text("（计算）：", " (calculated): ")) + number(input.height) + " mm";
                flatValue.text = text("S 斜坡长度", "S Slope length") +
                    (heightMode === "slant" ? text("（填写）：", " (input): ") : text("（计算）：", " (calculated): ")) + input.slant.toFixed(2) + " mm";
            } catch (inputError) {
                lastModel = null;
                syncingDimensions = true;
                try {
                    if (heightMode === "height") slant.text = ""; else height.text = "";
                    shownHeight = height.text; shownSlant = slant.text;
                } finally { syncingDimensions = false; }
                formedValue.text = text("H 实际高度：待填写有效尺寸", "H Actual height: enter valid dimensions");
                flatValue.text = text("S 斜坡长度：—", "S Slope length: --");
                clearPreview(errorMessage(inputError)); return;
            }
            if (preview.value && controller && controller.preview) {
                var ticket = ++revision;
                statusText.text = text("正在更新预览…", "Updating preview...");
                try {
                    controller.preview(input, function (error, result) {
                        if (closed || ticket !== revision) return;
                        statusText.text = error ? errorMessage(error) : (result && result.message ? result.message : text("预览已更新。生成可保留纸样；预览关闭时移除临时纸样。", "Preview updated. Generate keeps a template; turning preview off removes the temporary one."));
                    });
                } catch (previewError) { if (ticket === revision) statusText.text = errorMessage(previewError); }
            } else if (!committing) {
                statusText.text = text("100% 打印；不含卷口和封底。勾选预览可在画板查看。", "Print at 100%; rim/base forming excluded. Check Preview to view on the canvas.");
            }
        }
        var edits = [top, bottom, overlap, bleed, radial, concentric];
        for (var editIndex = 0; editIndex < edits.length; editIndex++) edits[editIndex].onChanging = edits[editIndex].onChange = refresh;
        function dimensionEvents(control, mode) {
            control.onChanging = function () { if (!syncingDimensions) { heightMode = mode; refresh(); } };
            control.onChange = function () {
                if (syncingDimensions) return;
                // A derived field losing focus must not promote its rounded display to an input.
                var shown = mode === "height" ? shownHeight : shownSlant;
                if (mode === heightMode || control.text !== shown) heightMode = mode;
                refresh();
            };
        }
        dimensionEvents(height, "height"); dimensionEvents(slant, "slant");
        side.onChange = refresh;
        var checks = [centerLine, showCenter, centerMark, dimensions, annotations];
        for (var checkIndex = 0; checkIndex < checks.length; checkIndex++) checks[checkIndex].onClick = refresh;
        preview.onClick = function () {
            if (preview.value) refresh();
            else clearPreview(text("预览已关闭，正式生成的纸样会保留。", "Preview is off. Generated templates stay in the document."));
        };
        generate.onClick = function () {
            if (committing || closed) return;
            var input;
            try { input = getInput(); lastModel = calculate(input); }
            catch (inputError) { clearPreview(errorMessage(inputError)); return; }
            var ticket = ++revision;
            if (!controller || !controller.generate) {
                statusText.text = text("参数有效。", "The dimensions are valid."); return;
            }
            setBusy(true); statusText.text = text("正在生成纸样…", "Generating template...");
            try {
                controller.generate(input, function (error, result) {
                    if (closed) return;
                    setBusy(false);
                    if (ticket !== revision) return;
                    statusText.text = error ? errorMessage(error) : (result && result.message ? result.message : text("纸样已保留。窗口保持打开，可继续调整并生成下一份。", "Template kept. This window stays open for the next template."));
                });
            } catch (generateError) { setBusy(false); if (ticket === revision) statusText.text = errorMessage(generateError); }
        };
        close.onClick = function () { win.close(); };
        win.onClose = function () {
            if (closed) return true;
            closed = true; revision++;
            try { if ($.global.HG_PAPER_CUP_UI && $.global.HG_PAPER_CUP_UI.window === win) $.global.HG_PAPER_CUP_UI = null; } catch (singletonError) {}
            if (controller) {
                var clear = controller.dispose || controller.clear;
                try { if (clear) clear(function (error) { if (error) log("preview_clear_failed", null, error); }); }
                catch (disposeError) { log("preview_clear_failed", null, disposeError); }
            }
            return true;
        };
        refresh(); top.active = true; win.center();
        return {
            window: win,
            controls: { top: top, bottom: bottom, height: height, slant: slant, overlap: overlap, side: side, bleed: bleed,
                radialDivisions: radial, concentricDivisions: concentric, centerLine: centerLine, showCenter: showCenter,
                radialUp: radial.stepUp, radialDown: radial.stepDown, concentricUp: concentric.stepUp, concentricDown: concentric.stepDown,
                centerMark: centerMark, dimensions: dimensions, annotations: annotations, preview: preview,
                generate: generate, close: close, formedValue: formedValue, flatValue: flatValue, tabs: tabs },
            getInput: getInput, getModel: function () { return calculate(getInput()); },
            getHeightMode: function () { return heightMode; },
            status: statusText, setBusy: setBusy, refresh: refresh
        };
    }

    function main() {
        if ($.global.HG_PAPER_CUP_NO_MAIN) return null;
        var existing = $.global.HG_PAPER_CUP_UI;
        if (existing) { try { existing.window.show(); existing.window.active = true; return null; } catch (oldWindow) {} }
        var id = String(new Date().getTime()) + "_" + Math.floor(Math.random() * 1000000);
        var controller = createController(createTransport($.fileName, id, String($.global.HGSCRIPTS_LANGUAGE || "zh-CN")));
        var ui = createDialog(controller);
        $.global.HG_PAPER_CUP_UI = ui;
        ui.window.show();
        return null;
    }
    return { parseNumber: parseNumber, resolveDimensions: resolveDimensions, calculate: calculate, draw: draw, createDialog: createDialog,
        createController: createController, hostAction: hostAction, serialize: serialize, main: main };
}());
HGPaperCup.main();
