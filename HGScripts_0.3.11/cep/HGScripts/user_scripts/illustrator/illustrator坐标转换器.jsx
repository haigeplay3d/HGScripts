#targetengine "haige_v5_final_layout_rebuild"

// hgscripts-badge: cpp
// hgscripts-cpp-plugin: HGScriptsNative.aip
// hgscripts-cpp-command: HGCoordToolPanel

// 界面独立、内部联动：
// - 界面上不出现任何「打开 C++ 面板」按钮或提示，JSX 面板与 AIP 面板各自独立打开；
// - auto / cpp 模式下启动时先把界面交给 AIP 原生面板（HGCoordToolPanel）；
// - jsx 模式、插件缺失或命令调用失败时，回落到本脚本自己的面板。

// 同一个 targetengine 会被重复使用，重跑脚本时旧面板不会自动消失，
// 于是每跑一次就多一个窗口。先关掉上一次留下的面板。
try {
    if ($.global.__hgPanelWin && typeof $.global.__hgPanelWin.close === "function") {
        $.global.__hgPanelWin.close();
    } else if (typeof win !== "undefined" && win && typeof win.close === "function") {
        win.close();
    }
} catch (ignoreClose) {}
$.global.__hgPanelWin = null;

var win = new Window("palette", "illustrator坐标转换器", undefined);
win.orientation = "column";
win.alignChildren = "center";
win.spacing = 6;
win.margins = 8;
$.global.__hgPanelWin = win;

// --- 自定义计算：用户最后改动的字段 + 程序回填标志 ---
// onChange 只记录人手改动的字段；程序写回字段时 _hgFilling=true，避免被误记成用户改动。
var _hgLastChanged = null;
var _hgFilling = false;

// --- 统一列宽（保证全面板输入框垂直对齐）---
// 输入框宽度按「123.456789」10 个字符标定，保证长数值完整可见
var LABEL_W = 58;   // 参数名列宽（刚好容纳「宽/画板」）
var EDIT_W  = 88;   // 输入框宽（可容纳 10 个字符）
var ROW_GAP = 3;    // 行间距
var COL_GAP = 12;   // 左右两列间距

// --- 关于「点击复制」---
// Illustrator 的脚本层（ExtendScript）没有剪贴板 API：宿主里 ActiveXObject 是
// undefined（实测日志），htmlfile 的 setData 返回 True 但内容不变，MSForms 报 429。
// 也就是说 .jsx 自己写不进系统剪贴板——Illustrator 颜色面板上那个「点击以复制值」
// 是 C++ 原生界面在调 Windows 剪贴板，脚本层拿不到这扇门。
// 另外实测：ScriptUI 的 textselection 在 Illustrator 里不可靠——赋值 "0,长度"
// 不会选中文本，而是把这串字符插进输入框（把数值写脏）。statictext 的 onClick
// 也不派发（日志里一次 CLICK 都没有）。所以标签和输入框都不再挂点击行为。

// 生成一行：固定宽度的参数名 + 固定宽度的输入框
function makeRow(col, labelText, value) {
    var row = col.add("group");
    row.orientation = "row";
    row.alignment = "left";
    row.spacing = 3;
    row.alignChildren = "center";

    var lb = row.add("statictext", [0, 0, LABEL_W, 20], labelText);
    lb.preferredSize = [LABEL_W, 20];
    lb.minimumSize = [LABEL_W, 20];
    lb.alignment = "left";
    lb.justify = "left";

    var ed = row.add("edittext", [0, 0, EDIT_W, 20], value);
    ed.preferredSize = [EDIT_W, 20];
    ed.minimumSize = [EDIT_W, 20];
    ed.alignment = "left";

    return { label: lb, edit: ed };
}

// 生成左右两列，列宽固定，四个面板共用
function makeColumns(panel) {
    var g = panel.add("group");
    g.orientation = "row";
    g.spacing = COL_GAP;
    g.alignChildren = "top";

    var left = g.add("group");
    left.orientation = "column";
    left.spacing = ROW_GAP;
    left.alignChildren = "left";

    var right = g.add("group");
    right.orientation = "column";
    right.spacing = ROW_GAP;
    right.alignChildren = "left";

    return { left: left, right: right };
}

// --- 1. illustrator属性 ---
var p1 = win.add("panel", undefined, "illustrator属性");
p1.alignment = "center";
p1.alignChildren = "center";
var c1 = makeColumns(p1);

var rowX = makeRow(c1.left, "X坐标", "0");  var etX = rowX.edit;
var rowY = makeRow(c1.left, "Y坐标", "0");  var etY = rowY.edit;
var rowW = makeRow(c1.right, "宽", "0");    var etW = rowW.edit;
var rowH = makeRow(c1.right, "高", "0");    var etH = rowH.edit;

// --- 2. 比例关系 ---
var p2 = win.add("panel", undefined, "比例关系");
p2.alignment = "center";
p2.alignChildren = "center";
var c2 = makeColumns(p2);

var rowWH = makeRow(c2.left, "宽/高", "0");   var rWH = rowWH.edit;
var rowHW = makeRow(c2.left, "高/宽", "0");   var rHW = rowHW.edit;
var rowWA = makeRow(c2.right, "宽/画板", "0"); var rWArt = rowWA.edit;
var rowHA = makeRow(c2.right, "高/画板", "0"); var rHArt = rowHA.edit;

// --- 3. ABS & T2D ---
var p3 = win.add("panel", undefined, "ABS/T2D坐标系");
p3.alignment = "center";
p3.alignChildren = "center";
var c3 = makeColumns(p3);

var rowABSx = makeRow(c3.left, "ABS(x)", "0");  var etABSx = rowABSx.edit;
var rowABSy = makeRow(c3.left, "ABS(y)", "0");  var etABSy = rowABSy.edit;
var rowT2Dx = makeRow(c3.right, "T2D(x)", "0"); var etT2Dx = rowT2Dx.edit;
var rowT2Dy = makeRow(c3.right, "T2D(y)", "0"); var etT2Dy = rowT2Dy.edit;

// --- 4. UV & OC ---
var p4 = win.add("panel", undefined, "UV/Octane坐标系");
p4.alignment = "center";
p4.alignChildren = "center";
var c4 = makeColumns(p4);

var rowUVx = makeRow(c4.left, "UV(x)", "0");  var etUVx = rowUVx.edit;
var rowUVy = makeRow(c4.left, "UV(y)", "0");  var etUVy = rowUVy.edit;
var rowOCx = makeRow(c4.right, "OC(x)", "0"); var etOCx = rowOCx.edit;
var rowOCy = makeRow(c4.right, "OC(y)", "0"); var etOCy = rowOCy.edit;

// --- 5. 按钮区（缩小宽度 + 简短文字） ---
var gBtn = win.add("group");
gBtn.alignment = "center";
gBtn.spacing = 6;

var btnGet     = gBtn.add("button", undefined, "计算选中");
var btnReport  = gBtn.add("button", undefined, "生成报告");
var btnCustom  = gBtn.add("button", undefined, "自定义计算");

// Three buttons fit the panel width (3x104 + 2x6 = 324px).
btnGet.preferredSize    = [104, 28];
btnReport.preferredSize = [104, 28];
btnCustom.preferredSize = [104, 28];

// --- 6. 核心计算逻辑 ---
var coreCalcLogic = "function calculate(u, v, rw, rh, name){\
    var doc=app.activeDocument; var ab=doc.artboards[doc.artboards.getActiveArtboardIndex()];\
    var abRect=ab.artboardRect; var abW=Math.abs(abRect[2]-abRect[0]); var abH=Math.abs(abRect[1]-abRect[3]);\
    var _x=(u*abW).toFixed(6), _y=(v*abH).toFixed(6), _w=(rw*abW).toFixed(6), _h=(rh*abH).toFixed(6);\
    var _rwh=(rh!=0?rw/rh:0).toFixed(6), _rhw=(rw!=0?rh/rw:0).toFixed(6);\
    var _rwa=rw.toFixed(6), _rha=rh.toFixed(6);\
    var _absX=u.toFixed(6), _absY=v.toFixed(6), _t2dX=(0.5-u).toFixed(6), _t2dY=(0.5-v).toFixed(6);\
    var _uvX=u.toFixed(6), _uvY=(1-v).toFixed(6), _ocX=(u-0.5).toFixed(6), _ocY=(0.5-v).toFixed(6);\
    return {res:[_x,_y,_w,_h,_rwh,_rhw,_rwa,_rha,_absX,_absY,_t2dX,_t2dY,_uvX,_uvY,_ocX,_ocY].join(';'), name:name, rect:abRect};\
}";

// 更新面板显示
function updateFields(body) {
    if(!body || body == "NONE") return;
    var d = body.split(";");
    if (d.length < 16) return;
    _hgFilling = true;
    try {
        etX.text=d[0]; etY.text=d[1]; etW.text=d[2]; etH.text=d[3];
        rWH.text=d[4]; rHW.text=d[5]; rWArt.text=d[6]; rHArt.text=d[7];
        etABSx.text=d[8]; etABSy.text=d[9]; etT2Dx.text=d[10]; etT2Dy.text=d[11];
        etUVx.text=d[12]; etUVy.text=d[13]; etOCx.text=d[14]; etOCy.text=d[15];
    } finally {
        _hgFilling = false;
    }
}

// 按钮1：计算选中对象，刷新面板
btnGet.onClick = function() {
    var bt = new BridgeTalk();
    bt.target = "illustrator";
    bt.body = coreCalcLogic + " function run(){\
        if(app.documents.length==0 || app.selection.length==0) return 'NONE';\
        var doc=app.activeDocument; var item=doc.selection[0];\
        var ab=doc.artboards[doc.artboards.getActiveArtboardIndex()]; var abRect=ab.artboardRect;\
        var abW=Math.abs(abRect[2]-abRect[0]); var abH=Math.abs(abRect[1]-abRect[3]);\
        var b=item.geometricBounds; var cX=(b[0]+b[2])/2; var cY=(b[1]+b[3])/2;\
        var pos=doc.convertCoordinate([cX,cY],CoordinateSystem.DOCUMENTCOORDINATESYSTEM,CoordinateSystem.ARTBOARDCOORDINATESYSTEM);\
        var u=pos[0]/abW, v=Math.abs(pos[1])/abH, rw=item.width/abW, rh=item.height/abH;\
        return calculate(u, v, rw, rh, '').res;\
    } run();";
    bt.onResult = function(res) { updateFields(res.body); };
    bt.send();
};

// 按钮2：生成报告（只打印当前面板值，不计算、不读选中对象）
btnReport.onClick = function() {
    // 直接取 16 个输入框此刻的显示值，原样写进报告
    var vals = [
        etX.text, etY.text, etW.text, etH.text,
        rWH.text, rHW.text, rWArt.text, rHArt.text,
        etABSx.text, etABSy.text, etT2Dx.text, etT2Dy.text,
        etUVx.text, etUVy.text, etOCx.text, etOCy.text
    ];
    var bt = new BridgeTalk();
    bt.target = "illustrator";
    bt.body = "function hgPrintReport() {\
        if (app.documents.length == 0) return 'NODOC';\
        var doc = app.activeDocument;\
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];\
        var r = ab.artboardRect;\
        var vals = ['" + vals.join("','") + "'];\
        var list = [\
            '对象: 当前面板值',\
            'AI: X=' + vals[0] + ' Y=' + vals[1] + ' (W=' + vals[2] + ' H=' + vals[3] + ')',\
            '比例: 宽/高=' + vals[4] + ' | 高/宽=' + vals[5],\
            '画板占比: W=' + vals[6] + ' H=' + vals[7],\
            'ABS: ' + vals[8] + ' / ' + vals[9],\
            'T2D: ' + vals[10] + ' / ' + vals[11],\
            'UV: ' + vals[12] + ' / ' + vals[13],\
            'OC: ' + vals[14] + ' / ' + vals[15]\
        ];\
        var offsetX = 0;\
        for (var i = 0; i < doc.groupItems.length; i++) {\
            if (doc.groupItems[i].name == 'HG_REP') offsetX += 500;\
        }\
        var g = doc.groupItems.add(); g.name = 'HG_REP';\
        var white = new RGBColor(); white.red=255; white.green=255; white.blue=255;\
        var startX = r[0] + offsetX;\
        var startY = r[3] - 120;\
        for (var j = 0; j < list.length; j++) {\
            var t = g.textFrames.add(); t.contents=list[j];\
            t.textRange.characterAttributes.size=24;\
            t.textRange.characterAttributes.fillColor=white;\
            t.position=[startX, startY - (j*35)];\
        }\
        return 'OK';\
    } hgPrintReport();";
    bt.onResult = function(res) {
        if (res.body === 'NODOC') alert('请先打开一个文档！');
    };
    bt.send();
};

// 按钮3：自定义计算——以用户最后改动的一个输入框为准，反解出它对应的底层量，
// 再重算同一条链上的其它字段（"改谁以谁为准"）。底层共 4 个量：
//   u=横向位置, v=纵向位置, rw=宽/画板, rh=高/画板；绝对像素另需画板宽高。
// 链分组：
//   u 链 = X, ABS(x), T2D(x), UV(x), OC(x)
//   v 链 = Y, ABS(y), T2D(y), UV(y), OC(y)
//   rw 链 = 宽, 宽/画板 (+宽高比)
//   rh 链 = 高, 高/画板 (+宽高比)
// onChange 只记录人手改动的字段；程序回填时 _hgFilling=true 会被忽略，避免自我污染。
btnCustom.onClick = function () {
    if (!_hgLastChanged) {
        alert('请先修改任意一个输入框的值，再点「自定义计算」。');
        return;
    }
    var bt = new BridgeTalk();
    bt.target = "illustrator";
    bt.body = "function hgReadArtboard() {\
        if (app.documents.length === 0) return 'NODOC';\
        var doc = app.activeDocument;\
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];\
        var r = ab.artboardRect;\
        return Math.abs(r[2]-r[0]).toFixed(6) + ';' + Math.abs(r[1]-r[3]).toFixed(6);\
    } hgReadArtboard();";
    bt.onResult = function (res) {
        var abW = 1024, abH = 1024;
        if (res.body && res.body !== 'NODOC') {
            var parts = res.body.split(';');
            if (parts.length >= 2) {
                abW = parseFloat(parts[0]) || 1024;
                abH = parseFloat(parts[1]) || 1024;
            }
        }
        customRecalc(abW, abH);
    };
    bt.onError = function () { customRecalc(1024, 1024); };
    bt.send();
};

// 读输入框数值（NaN 当 0）
function hgNum(edit) { var n = parseFloat(edit.text); return isFinite(n) ? n : 0; }

// 按 _hgLastChanged 反解并重算整条链。abW/abH 为画板宽高（无文档时 1024x1024）。
function customRecalc(abW, abH) {
    var key = _hgLastChanged;
    if (!key) return;
    var f = function (x) { return (isFinite(x) ? x : 0).toFixed(6); };

    var X=hgNum(etX), Y=hgNum(etY), W=hgNum(etW), H=hgNum(etH);
    var WArt=hgNum(rWArt), HArt=hgNum(rHArt);
    var ABSx=hgNum(etABSx), ABSy=hgNum(etABSy);
    var T2Dx=hgNum(etT2Dx), T2Dy=hgNum(etT2Dy);
    var UVx=hgNum(etUVx), UVy=hgNum(etUVy);
    var OCx=hgNum(etOCx), OCy=hgNum(etOCy);
    var WH=hgNum(rWH), HW=hgNum(rHW);

    var u, v, rw, rh, chain = '';
    if (key === 'X')         { u = abW ? X / abW : 0; chain = 'u'; }
    else if (key === 'ABSx') { u = ABSx;       chain = 'u'; }
    else if (key === 'T2Dx') { u = 0.5 - T2Dx; chain = 'u'; }
    else if (key === 'UVx')  { u = UVx;        chain = 'u'; }
    else if (key === 'OCx')  { u = OCx + 0.5;  chain = 'u'; }
    else if (key === 'Y')         { v = abH ? Y / abH : 0; chain = 'v'; }
    else if (key === 'ABSy') { v = ABSy;       chain = 'v'; }
    else if (key === 'T2Dy') { v = 0.5 - T2Dy; chain = 'v'; }
    else if (key === 'UVy')  { v = 1 - UVy;    chain = 'v'; }
    else if (key === 'OCy')  { v = 0.5 - OCy;  chain = 'v'; }
    else if (key === 'W')     { rw = abW ? W / abW : 0; chain = 'rw'; }
    else if (key === 'WArt')  { rw = WArt;              chain = 'rw'; }
    else if (key === 'H')     { rh = abH ? H / abH : 0; chain = 'rh'; }
    else if (key === 'HArt')  { rh = HArt;              chain = 'rh'; }
    else if (key === 'WH')    { rh = HArt; rw = WH * rh; chain = 'rw'; } // 保持高占比，反推宽占比
    else if (key === 'HW')    { rw = WArt; rh = HW * rw; chain = 'rh'; } // 保持宽占比，反推高占比
    else return;

    if (!isFinite(rw)) rw = WArt;
    if (!isFinite(rh)) rh = HArt;

    _hgFilling = true;
    try {
        if (chain === 'u') {
            etX.text=f(u*abW); etABSx.text=f(u); etT2Dx.text=f(0.5-u);
            etUVx.text=f(u); etOCx.text=f(u-0.5);
        } else if (chain === 'v') {
            etY.text=f(v*abH); etABSy.text=f(v); etT2Dy.text=f(0.5-v);
            etUVy.text=f(1-v); etOCy.text=f(0.5-v);
        } else if (chain === 'rw') {
            etW.text=f(rw*abW); rWArt.text=f(rw);
            rWH.text=f(rh !== 0 ? rw/rh : 0); rHW.text=f(rw !== 0 ? rh/rw : 0);
        } else if (chain === 'rh') {
            etH.text=f(rh*abH); rHArt.text=f(rh);
            rWH.text=f(rh !== 0 ? rw/rh : 0); rHW.text=f(rw !== 0 ? rh/rw : 0);
        }
    } finally {
        _hgFilling = false;
    }
}

// 给 16 个输入框挂 onChange：只记人手改动的字段 key
function bindChangeWatch(edit, key) {
    edit.onChange = function () { if (!_hgFilling) _hgLastChanged = key; };
}
(function () {
    bindChangeWatch(etX,'X');       bindChangeWatch(etY,'Y');
    bindChangeWatch(etW,'W');       bindChangeWatch(etH,'H');
    bindChangeWatch(rWH,'WH');      bindChangeWatch(rHW,'HW');
    bindChangeWatch(rWArt,'WArt');  bindChangeWatch(rHArt,'HArt');
    bindChangeWatch(etABSx,'ABSx'); bindChangeWatch(etABSy,'ABSy');
    bindChangeWatch(etT2Dx,'T2Dx'); bindChangeWatch(etT2Dy,'T2Dy');
    bindChangeWatch(etUVx,'UVx');   bindChangeWatch(etUVy,'UVy');
    bindChangeWatch(etOCx,'OCx');   bindChangeWatch(etOCy,'OCy');
})();

// --- 6.5 统一深色主题：对齐 AIP 原生窗口配色（HGUITheme.h） ---
function HGUILoadTheme() {
    try {
        if ($.global.HGScriptUITheme) return $.global.HGScriptUITheme;
        var root = new File($.fileName).parent;
        $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGScriptUITheme.jsx"));
        return $.global.HGScriptUITheme;
    } catch (e) { return null; }
}
var hgTheme = HGUILoadTheme();
if (hgTheme) hgTheme.apply(win);

// --- 7. 内部联动：auto / cpp 模式先交给 AIP 原生面板，失败回落到本面板 ---
var openedInNativePanel = false;
if (getHGScriptsCppMode() !== "jsx") {
    openedInNativePanel = tryOpenNativePanel();
}
if (!openedInNativePanel) {
    win.center();
    win.show();
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

function tryOpenNativePanel() {
    try {
        var root = new File($.fileName).parent;
        $.evalFile(new File(root.fsName + "/../../assets/jsx/illustrator_lib/HGCppBridge.jsx"));
        var bridge = $.global.HGColorTools;
        if (!bridge || typeof bridge.tryCppCommand !== "function") return false;
        return bridge.tryCppCommand("HGCoordToolPanel") === true;
    } catch (e) {
        return false;
    }
}
