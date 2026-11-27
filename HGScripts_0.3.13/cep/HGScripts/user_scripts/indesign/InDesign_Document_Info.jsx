#target indesign

(function () {
    if (!app.documents.length) {
        alert("InDesign: 当前没有打开的文档。");
        return;
    }

    var doc = app.activeDocument;
    var message = "InDesign 当前文档信息\n\n" +
        "名称: " + doc.name + "\n" +
        "页数: " + doc.pages.length + "\n" +
        "跨页数量: " + doc.spreads.length;

    alert(message);
})();
