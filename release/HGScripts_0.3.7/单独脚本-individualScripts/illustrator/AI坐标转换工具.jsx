#targetengine "haige_v5_final_layout_rebuild"

var win = new Window("palette", "AI坐标转换工具v1.0.0 by 酒瓶建模师海哥", undefined);
win.orientation = "column";
win.spacing = 10;
win.margins = 15;

// --- 颜色定义 ---
var G_COLOR = [0, 0.7, 0, 1]; // 绿色

// --- 1. 顶部说明区 ---
var infoP = win.add("panel", undefined, "");
infoP.alignment = "fill";
infoP.add("statictext", undefined, "octane用户主要看`宽/画板`,`高/画板`,`OC(x)`,`OC(y)`");
infoP.add("statictext", undefined, "宽/画板,高/画板就是oc缩放, OC(x)和OC(y)就是oc坐标");
infoP.add("statictext", undefined, "再其次就是看UV(x)和UV(y),这两个就是uv坐标");

// --- 2. 参数区域 ---
var p1 = win.add("panel", undefined, "对象参数");
p1.alignment = "fill";
var g1 = p1.add("group");
var g1L = g1.add("group"); g1L.orientation = "column"; g1L.alignChildren="right";
var g1R = g1.add("group"); g1R.orientation = "column"; g1R.alignChildren="right";

var rowX  = g1L.add("group"); rowX.add("statictext", undefined, "X坐标");  var etX  = rowX.add("edittext", [0,0,85,22], "0");
var rowY  = g1L.add("group"); rowY.add("statictext", undefined, "Y坐标");  var etY  = rowY.add("edittext", [0,0,85,22], "0");
var rowW  = g1R.add("group"); rowW.add("statictext", undefined, "宽");     var etW  = rowW.add("edittext", [0,0,85,22], "0");
var rowH  = g1R.add("group"); rowH.add("statictext", undefined, "高");     var etH  = rowH.add("edittext", [0,0,85,22], "0");

// --- 3. 比例关系 ---
var p2 = win.add("panel", undefined, "比例关系");
p2.alignment = "fill";
var g2 = p2.add("group");
var g2L = g2.add("group"); g2L.orientation = "column"; g2L.alignChildren="right";
var g2R = g2.add("group"); g2R.orientation = "column"; g2R.alignChildren="right";

var rowWH   = g2L.add("group"); rowWH.add("statictext", undefined, "宽/高"); var rWH   = rowWH.add("edittext", [0,0,85,22], "0");
var rowHW   = g2L.add("group"); rowHW.add("statictext", undefined, "高/宽"); var rHW   = rowHW.add("edittext", [0,0,85,22], "0");
var rowWA   = g2R.add("group"); var lbWA = rowWA.add("statictext", undefined, "宽/画板"); var rWArt = rowWA.add("edittext", [0,0,85,22], "0");
lbWA.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, G_COLOR, 1);
var rowHA   = g2R.add("group"); var lbHA = rowHA.add("statictext", undefined, "高/画板"); var rHArt = rowHA.add("edittext", [0,0,85,22], "0");
lbHA.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, G_COLOR, 1);

// --- 4. ABS & T2D ---
var p3 = win.add("panel", undefined, "ABS & T2D坐标系");
p3.alignment = "fill";
var g3 = p3.add("group");
var g3L = g3.add("group"); g3L.orientation = "column"; g3L.alignChildren="right";
var g3R = g3.add("group"); g3R.orientation = "column"; g3R.alignChildren="right";

var rowABSx = g3L.add("group"); rowABSx.add("statictext", undefined, "ABS(x)"); var etABSx = rowABSx.add("edittext", [0,0,85,22], "0");
var rowABSy = g3L.add("group"); rowABSy.add("statictext", undefined, "ABS(y)"); var etABSy = rowABSy.add("edittext", [0,0,85,22], "0");
var rowT2Dx = g3R.add("group"); rowT2Dx.add("statictext", undefined, "T2D(x)"); var etT2Dx = rowT2Dx.add("edittext", [0,0,85,22], "0");
var rowT2Dy = g3R.add("group"); rowT2Dy.add("statictext", undefined, "T2D(y)"); var etT2Dy = rowT2Dy.add("edittext", [0,0,85,22], "0");

// --- 5. UV & OC ---
var p4 = win.add("panel", undefined, "UV & Octane 坐标系");
p4.alignment = "fill";
var g4 = p4.add("group");
var g4L = g4.add("group"); g4L.orientation = "column"; g4L.alignChildren="right";
var g4R = g4.add("group"); g4R.orientation = "column"; g4R.alignChildren="right";

var rowUVx  = g4L.add("group"); var lbUVx = rowUVx.add("statictext", undefined, "UV(x)");  var etUVx = rowUVx.add("edittext", [0,0,85,22], "0");
lbUVx.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, G_COLOR, 1);
var rowUVy  = g4L.add("group"); var lbUVy = rowUVy.add("statictext", undefined, "UV(y)");  var etUVy = rowUVy.add("edittext", [0,0,85,22], "0");
lbUVy.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, G_COLOR, 1);
var rowOCx  = g4R.add("group"); rowOCx.add("statictext", undefined, "OC(x)");  var etOCx = rowOCx.add("edittext", [0,0,85,22], "0");
var rowOCy  = g4R.add("group"); rowOCy.add("statictext", undefined, "OC(y)");  var etOCy = rowOCy.add("edittext", [0,0,85,22], "0");

// --- 6. 按钮区（缩小宽度 + 简短文字） ---
var gBtn = win.add("group");
gBtn.alignment = "center";
gBtn.spacing = 10;

var btnGet    = gBtn.add("button", undefined, "计算选中");
var btnReport = gBtn.add("button", undefined, "生成报告");
var btnCustom = gBtn.add("button", undefined, "自定义报告");

btnGet.preferredSize    = [110, 38];
btnReport.preferredSize = [110, 38];
btnCustom.preferredSize = [110, 38];

// --- 核心计算逻辑 ---
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
    etX.text=d[0]; etY.text=d[1]; etW.text=d[2]; etH.text=d[3];
    rWH.text=d[4]; rHW.text=d[5]; rWArt.text=d[6]; rHArt.text=d[7];
    etABSx.text=d[8]; etABSy.text=d[9]; etT2Dx.text=d[10]; etT2Dy.text=d[11];
    etUVx.text=d[12]; etUVy.text=d[13]; etOCx.text=d[14]; etOCy.text=d[15];
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

// 按钮2：生成报告（基于选中对象）
btnReport.onClick = function() {
    var bt = new BridgeTalk();
    bt.target = "illustrator";
    bt.body = coreCalcLogic + "\
        function report(){\
            if(app.documents.length==0 || app.selection.length==0) return 'NONE';\
            var doc=app.activeDocument; var item=doc.selection[0];\
            var ab=doc.artboards[doc.artboards.getActiveArtboardIndex()]; var abRect=ab.artboardRect;\
            var abW=Math.abs(abRect[2]-abRect[0]); var abH=Math.abs(abRect[1]-abRect[3]);\
            var b=item.geometricBounds; var cX=(b[0]+b[2])/2; var cY=(b[1]+b[3])/2;\
            var pos=doc.convertCoordinate([cX,cY],CoordinateSystem.DOCUMENTCOORDINATESYSTEM,CoordinateSystem.ARTBOARDCOORDINATESYSTEM);\
            var u=pos[0]/abW, v=Math.abs(pos[1])/abH;\
            var rw=item.width/abW, rh=item.height/abH;\
            var name = item.name || (item.typename=='GroupItem'?'未命名组':'未命名对象');\
            var obj = calculate(u, v, rw, rh, name);\
            var offsetX = 0;\
            for (var i = 0; i < doc.groupItems.length; i++) {\
                if (doc.groupItems[i].name == 'HG_REP') offsetX += 500;\
            }\
            var d = obj.res.split(';');\
            var list = [\
                '对象: ' + obj.name,\
                'AI: X=' + d[0] + ' Y=' + d[1] + ' (W=' + d[2] + ' H=' + d[3] + ')',\
                '比例: 宽/高=' + d[4] + ' | 高/宽=' + d[5],\
                '画板占比: W=' + d[6] + ' H=' + d[7],\
                'ABS: ' + d[8] + ' / ' + d[9],\
                'T2D: ' + d[10] + ' / ' + d[11],\
                'UV: ' + d[12] + ' / ' + d[13],\
                'OC: ' + d[14] + ' / ' + d[15]\
            ];\
            var g = doc.groupItems.add(); g.name = 'HG_REP';\
            var white = new RGBColor(); white.red=255; white.green=255; white.blue=255;\
            var startX = obj.rect[0] + offsetX;\
            var startY = obj.rect[3] - 120;\
            for (var j = 0; j < list.length; j++) {\
                var t = g.textFrames.add(); t.contents=list[j];\
                t.textRange.characterAttributes.size=24;\
                t.textRange.characterAttributes.fillColor=white;\
                t.position=[startX, startY - (j*35)];\
            }\
            return obj.res;\
        } report();";
    bt.onResult = function(res) {
        if (res.body === 'NONE') {
            alert('请先选中一个对象！');
        } else {
            updateFields(res.body);
        }
    };
    bt.send();
};

// 按钮3：用自定义值生成报告
btnCustom.onClick = function() {
    var u = etUVx.text;
    var v_inv = etUVy.text;
    var rw = rWArt.text;
    var rh = rHArt.text;

    var bt = new BridgeTalk();
    bt.target = "illustrator";
    bt.body = coreCalcLogic + "\
        function reportCustom(){\
            var doc = app.activeDocument;\
            var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];\
            var abRect = ab.artboardRect;\
            var u = parseFloat('" + u + "') || 0;\
            var v = 1 - (parseFloat('" + v_inv + "') || 0);\
            var rw = parseFloat('" + rw + "') || 0;\
            var rh = parseFloat('" + rh + "') || 0;\
            var name = '自定义对象';\
            var obj = calculate(u, v, rw, rh, name);\
            var offsetX = 0;\
            for (var i = 0; i < doc.groupItems.length; i++) {\
                if (doc.groupItems[i].name == 'HG_REP') offsetX += 500;\
            }\
            var d = obj.res.split(';');\
            var list = [\
                '对象: ' + obj.name,\
                'AI: X=' + d[0] + ' Y=' + d[1] + ' (W=' + d[2] + ' H=' + d[3] + ')',\
                '比例: 宽/高=' + d[4] + ' | 高/宽=' + d[5],\
                '画板占比: W=' + d[6] + ' H=' + d[7],\
                'ABS: ' + d[8] + ' / ' + d[9],\
                'T2D: ' + d[10] + ' / ' + d[11],\
                'UV: ' + d[12] + ' / ' + d[13],\
                'OC: ' + d[14] + ' / ' + d[15]\
            ];\
            var g = doc.groupItems.add(); g.name = 'HG_REP';\
            var white = new RGBColor(); white.red=255; white.green=255; white.blue=255;\
            var startX = obj.rect[0] + offsetX;\
            var startY = obj.rect[3] - 120;\
            for (var j = 0; j < list.length; j++) {\
                var t = g.textFrames.add(); t.contents=list[j];\
                t.textRange.characterAttributes.size=24;\
                t.textRange.characterAttributes.fillColor=white;\
                t.position=[startX, startY - (j*35)];\
            }\
            return obj.res;\
        } reportCustom();";
    bt.onResult = function(res) { updateFields(res.body); };
    bt.send();
};

win.center();
win.show();