#target photoshop

(function () {
    if (!app.documents.length) {
        alert("Photoshop: 当前没有打开的文档。");
        return;
    }

    var doc = app.activeDocument;
    var message = "Photoshop 当前文档信息\n\n" +
        "名称: " + doc.name + "\n" +
        "宽度: " + doc.width + "\n" +
        "高度: " + doc.height + "\n" +
        "图层数量: " + doc.layers.length;

    alert(message);
})();
