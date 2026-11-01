#targetengine "haige_v5_final_layout_rebuild"

var win = new Window("palette", "illustrator坐标转换工具v1.1.0 by 海哥", undefined);
win.orientation = "column";
win.spacing = 10;
win.margins = 15;

// --- 1. 顶部说明区 ---
var infoP = win.add("panel", undefined, "");
infoP.alignment = "fill";
infoP.alignChildren = "left";
var tipTitle = infoP.add("statictext", undefined, "使用前提：");
tipTitle.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);
infoP.add("statictext", undefined, "建议在1比1画板中使用,本插件基于实际画板制作。");
infoP.add("statictext", undefined, "OC(x),OC(y)就是octane的坐标。");
infoP.add("statictext", undefined, "(宽/画板宽),(高/画板高)就是octane的缩放,应取最大值。");

// --- 2. X/Y/宽/高 区域 ---
var p1 = win.add("panel", undefined, "对象参数");
p1.alignment = "fill";
var g1 = p1.add("group");
var g1L = g1.add("group"); g1L.orientation = "column"; g1L.alignChildren="right";
var g1R = g1.add("group"); g1R.orientation = "column"; g1R.alignChildren="right";

var rowX = g1L.add("group"); rowX.add("statictext", undefined, "X坐标"); var etX = rowX.add("edittext", [0,0,85,22], "0");
var rowY = g1L.add("group"); rowY.add("statictext", undefined, "Y坐标"); var etY = rowY.add("edittext", [0,0,85,22], "0");
var rowW = g1R.add("group"); rowW.add("statictext", undefined, "宽"); var etW = rowW.add("edittext", [0,0,85,22], "0");
var rowH = g1R.add("group"); rowH.add("statictext", undefined, "高"); var etH = rowH.add("edittext", [0,0,85,22], "0");

// --- 3. 比例计算区域 ---
var p2 = win.add("panel", undefined, "比例关系");
p2.alignment = "fill";
var g2 = p2.add("group");
var g2L = g2.add("group"); g2L.orientation = "column"; g2L.alignChildren="right";
var g2R = g2.add("group"); g2R.orientation = "column"; g2R.alignChildren="right";

var rowWH = g2L.add("group"); rowWH.add("statictext", undefined, "宽/高"); var rWH = rowWH.add("edittext", [0,0,85,22], "0");
var rowHW = g2L.add("group"); rowHW.add("statictext", undefined, "高/宽"); var rHW = rowHW.add("edittext", [0,0,85,22], "0");
var rowWA = g2R.add("group"); rowWA.add("statictext", undefined, "宽/画板"); var rWArt = rowWA.add("edittext", [0,0,85,22], "0");
var rowHA = g2R.add("group"); rowHA.add("statictext", undefined, "高/画板"); var rHArt = rowHA.add("edittext", [0,0,85,22], "0");

// --- 4. ABS & T2D 坐标区域 ---
var p3 = win.add("panel", undefined, "ABS & T2D坐标系");
p3.alignment = "fill";
var g3 = p3.add("group");
var g3L = g3.add("group"); g3L.orientation = "column"; g3L.alignChildren="right";
var g3R = g3.add("group"); g3R.orientation = "column"; g3R.alignChildren="right";

var rowABSx = g3L.add("group"); rowABSx.add("statictext", undefined, "ABS(x)"); var etABSx = rowABSx.add("edittext", [0,0,85,22], "0");
var rowABSy = g3L.add("group"); rowABSy.add("statictext", undefined, "ABS(y)"); var etABSy = rowABSy.add("edittext", [0,0,85,22], "0");
var rowT2Dx = g3R.add("group"); rowT2Dx.add("statictext", undefined, "T2D(x)"); var etT2Dx = rowT2Dx.add("edittext", [0,0,85,22], "0");
var rowT2Dy = g3R.add("group"); rowT2Dy.add("statictext", undefined, "T2D(y)"); var etT2Dy = rowT2Dy.add("edittext", [0,0,85,22], "0");

// --- 5. UV & OC 坐标区域 ---
var p4 = win.add("panel", undefined, "UV & Octane 坐标系");
p4.alignment = "fill";
var g4 = p4.add("group");
var g4L = g4.add("group"); g4L.orientation = "column"; g4L.alignChildren="right";
var g4R = g4.add("group"); g4R.orientation = "column"; g4R.alignChildren="right";

var rowUVx = g4L.add("group"); rowUVx.add("statictext", undefined, "UV(x)"); var etUVx = rowUVx.add("edittext", [0,0,85,22], "0");
var rowUVy = g4L.add("group"); rowUVy.add("statictext", undefined, "UV(y)"); var etUVy = rowUVy.add("edittext", [0,0,85,22], "0");
var rowOCx = g4R.add("group"); rowOCx.add("statictext", undefined, "OC(x)"); var etOCx = rowOCx.add("edittext", [0,0,85,22], "0");
var rowOCy = g4R.add("group"); rowOCy.add("statictext", undefined, "OC(y)"); var etOCy = rowOCy.add("edittext", [0,0,85,22], "0");

// --- 6. 底部大按钮 ---
var gBtn = win.add("group");
gBtn.alignment = "center";
var btnGet = gBtn.add("button", undefined, "计算当前对象坐标");
var btnCopy = gBtn.add("button", undefined, "生成参数报告");
btnGet.preferredSize = [155, 40];
btnCopy.preferredSize = [155, 40];

// --- 核心计算逻辑 (包含名称获取) ---
var coreCalcLogic = "var doc=app.activeDocument; var item=doc.selection[0];\
var ab=doc.artboards[doc.artboards.getActiveArtboardIndex()]; var abRect=ab.artboardRect;\
var abW=Math.abs(abRect[2]-abRect[0]); var abH=Math.abs(abRect[1]-abRect[3]);\
var b=item.geometricBounds; var cX=(b[0]+b[2])/2; var cY=(b[1]+b[3])/2;\
var pos=doc.convertCoordinate([cX,cY],CoordinateSystem.DOCUMENTCOORDINATESYSTEM,CoordinateSystem.ARTBOARDCOORDINATESYSTEM);\
var x_ai=pos[0], y_ai=Math.abs(pos[1]); var u=x_ai/abW, v=y_ai/abH;\
var _name=(item.name != '' ? item.name : (item.typename == 'GroupItem' ? '未命名组' : '未命名对象'));\
var _x=x_ai.toFixed(6), _y=y_ai.toFixed(6), _w=item.width.toFixed(6), _h=item.height.toFixed(6);\
var _rwh=(item.height!=0?(item.width/item.height):0).toFixed(6);\
var _rhw=(item.width!=0?(item.height/item.width):0).toFixed(6);\
var _rwa=(abW!=0?(item.width/abW):0).toFixed(6);\
var _rha=(abH!=0?(item.height/abH):0).toFixed(6);\
var _absX=u.toFixed(6), _absY=v.toFixed(6);\
var _t2dX=(0.5-u).toFixed(6), _t2dY=(0.5-v).toFixed(6);\
var _uvX=u.toFixed(6), _uvY=(1-v).toFixed(6);\
var _ocX=(u-0.5).toFixed(6), _ocY=(0.5-v).toFixed(6);";

function updateFields(body) {
    if(body == "NONE") return;
    var d = body.split(";");
    if(d.length < 16) return;
    etX.text=d[0]; etY.text=d[1]; etW.text=d[2]; etH.text=d[3];
    rWH.text=d[4]; rHW.text=d[5]; rWArt.text=d[6]; rHArt.text=d[7];
    etABSx.text=d[8]; etABSy.text=d[9]; etT2Dx.text=d[10]; etT2Dy.text=d[11];
    etUVx.text=d[12]; etUVy.text=d[13]; etOCx.text=d[14]; etOCy.text=d[15];
}

btnGet.onClick = function() {
    var bt = new BridgeTalk();
    bt.target = "illustrator";
    bt.body = "function run(){ if(app.documents.length==0 || app.selection.length==0) return 'NONE'; " + coreCalcLogic + 
              " return [_x,_y,_w,_h,_rwh,_rhw,_rwa,_rha,_absX,_absY,_t2dX,_t2dY,_uvX,_uvY,_ocX,_ocY].join(';'); } run();";
    bt.onResult = function(res) { updateFields(res.body); };
    bt.send();
};

btnCopy.onClick = function() {
    var bt = new BridgeTalk();
    bt.target = "illustrator";
    bt.body = "function report(){ if(app.documents.length==0 || app.selection.length==0) return 'NONE'; " + coreCalcLogic + "\
        var list = ['对象名称: ' + _name,\
                    'AI坐标: X=' + _x + ' Y=' + _y + ' (宽=' + _w + ' 高=' + _h + ')',\
                    '比例关系: 宽/高=' + _rwh + ' | 高/宽=' + _rhw,\
                    '画板占比: 宽/画板宽=' + _rwa + ' | 高/画板高=' + _rha,\
                    'ABS坐标 (归一化): ' + _absX + ' / ' + _absY,\
                    'T2D坐标 (变换): ' + _t2dX + ' / ' + _t2dY,\
                    'UV坐标: ' + _uvX + ' / ' + _uvY,\
                    'OC坐标 (Octane): ' + _ocX + ' / ' + _ocY];\
        var startX=abRect[0], startY=abRect[3]-120, offsetX=0;\
        for(var i=0; i<doc.groupItems.length; i++){ if(doc.groupItems[i].name=='HG_REP') offsetX+=500; }\
        var g=doc.groupItems.add(); g.name='HG_REP';\
        \
        /* 定义白色 */ \
        var whiteColor = new RGBColor(); whiteColor.red = 255; whiteColor.green = 255; whiteColor.blue = 255;\
        \
        for(var j=0; j<list.length; j++){\
            var t=g.textFrames.add(); t.contents=list[j];\
            t.textRange.characterAttributes.size=24;\
            /* 设置字体颜色为白色 */ \
            t.textRange.characterAttributes.fillColor = whiteColor;\
            t.position=[startX+offsetX, startY-(j*35)];\
        }\
        return [_x,_y,_w,_h,_rwh,_rhw,_rwa,_rha,_absX,_absY,_t2dX,_t2dY,_uvX,_uvY,_ocX,_ocY].join(';');\
    } report();";
    bt.onResult = function(res) { updateFields(res.body); };
    bt.send();
};

win.center();
win.show();