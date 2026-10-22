(function () {
    var fs = null;
    var path = null;
    var cs = null;
    var root = "";
    var scripts = [];
    var filtered = [];
    var selectedIndex = -1;
    var lastResult = "";
    var language = "zh-CN";
    var EN_SCRIPT_TITLES = {
        "AI坐标转换工具": "AI Coordinate Converter",
        "为选择对象创建外框": "Create Frame Around Selection",
        "六个对象两行三列最大化": "Maximize 6 Objects in 2x3 Grid",
        "单一色转其它色": "Single Color to Another Color",
        "同色转白其余转黑": "Same Color to White, Others to Black",
        "同色转黑其余转白": "Same Color to Black, Others to White",
        "填充色同步到描边色": "Sync Fill Color to Stroke",
        "复制选择对象到新画板": "Copy Selection to New Artboard",
        "导出选择对象为长边1024AI": "Export Selection as 1024 Long-Edge AI",
        "尺寸无小数": "Remove Decimal Dimensions",
        "手选基准缩放": "Manual Reference Scale",
        "描边色同步到填充色": "Sync Stroke Color to Fill",
        "清理真正无用的空对象": "Clean Truly Useless Empty Objects",
        "生成UPC-A条形码": "Generate UPC-A Barcode",
        "选择同色对象-严格版": "Select Same-Color Objects - Strict",
        "选择同色对象-宽松版": "Select Same-Color Objects - Loose",
        "选择对象转白色": "Turn Selection White",
        "选择对象转自定义颜色": "Turn Selection to Custom Color",
        "选择对象转黑色": "Turn Selection Black",
        "选择对象长边设为1024": "Set Selection Long Edge to 1024",
        "选择空对象_极速版": "Select Empty Objects - Fast",
        "选择转白其余转黑": "Selection to White, Others to Black",
        "选择转黑其余转白": "Selection to Black, Others to White"
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function nowText() {
        var d = new Date();
        function pad(n) {
            return n < 10 ? "0" + n : String(n);
        }
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
            pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }

    function writeLog(message) {
        try {
            if (!fs || !path || !root) {
                return;
            }
            var dir = path.join(root, "data", "runtime");
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            fs.appendFileSync(path.join(dir, "panel_2023_safe.log"), "[" + nowText() + "] " + message + "\r\n", "utf8");
        } catch (err) {}
    }

    function setStatus(message) {
        byId("status").innerHTML = escapeHtml(message);
        writeLog("status: " + message);
    }

    function setOutput(message) {
        lastResult = String(message || "");
        byId("output").innerHTML = escapeHtml(lastResult);
    }

    function isEnglish() {
        return language === "en-US";
    }

    function text(zh, en) {
        return isEnglish() ? en : zh;
    }

    function displayName(item) {
        var base = String((item && item.base) || "").replace(/\.(jsx?|JSX?)$/, "");
        return isEnglish() && EN_SCRIPT_TITLES[base] ? EN_SCRIPT_TITLES[base] + ".jsx" : item.name;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function jsxString(value) {
        return "\"" + String(value || "")
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n") + "\"";
    }

    function readJsonFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            return JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (err) {
            writeLog("read json failed: " + filePath + " / " + err);
            return null;
        }
    }

    function getSources() {
        var fallback = [{
            name: text("默认脚本", "Default Scripts"),
            folder: path.join(root, "user_scripts", "illustrator"),
            enabled: true
        }];
        var settings = readJsonFile(path.join(root, "data", "settings.json"));
        var raw = settings && settings.storage ? settings.storage["hgscripts.illustrator.sources"] : "";
        if (!raw) {
            return fallback;
        }
        try {
            var parsed = JSON.parse(raw);
            var result = [];
            for (var i = 0; i < parsed.length; i++) {
                if (parsed[i] && parsed[i].enabled !== false && parsed[i].folder) {
                    result.push({
                        name: parsed[i].name || text("脚本来源", "Script Source"),
                        folder: parsed[i].folder,
                        enabled: true
                    });
                }
            }
            return result.length ? result : fallback;
        } catch (err) {
            writeLog("parse sources failed: " + err);
            return fallback;
        }
    }

    function getSettings() {
        return readJsonFile(path.join(root, "data", "settings.json")) || {};
    }

    function refreshLanguage() {
        var settings = getSettings();
        var mode = String(settings.languageMode || "auto");
        if (mode === "en-US") {
            language = "en-US";
        } else if (mode === "zh-CN") {
            language = "zh-CN";
        } else {
            language = /^zh/i.test(String(navigator.language || "")) ? "zh-CN" : "en-US";
        }
        byId("search").placeholder = text("搜索脚本", "Search scripts");
        byId("refreshBtn").textContent = text("刷新", "Refresh");
        byId("runBtn").textContent = text("运行选中脚本", "Run Selected");
        byId("copyBtn").textContent = text("复制结果", "Copy Result");
    }

    function getScanDepth() {
        var settings = getSettings();
        var depth = parseInt(settings.scanDepth, 10);
        if (isNaN(depth)) {
            return 0;
        }
        return Math.max(0, Math.min(10, depth));
    }

    function getIgnoredDirs() {
        var settings = getSettings();
        var raw = settings.ignoredDirs;
        var result = [];
        if (raw && raw.length) {
            for (var i = 0; i < raw.length; i++) {
                var item = String(raw[i] || "").toLowerCase();
                if (item) {
                    result.push(item);
                }
            }
        }
        return result.length ? result : ["node_modules", ".git", ".svn", ".hg"];
    }

    function isIgnoredDir(name) {
        var lower = String(name || "").toLowerCase();
        var ignored = getIgnoredDirs();
        for (var i = 0; i < ignored.length; i++) {
            if (lower === ignored[i]) {
                return true;
            }
        }
        return false;
    }

    function walk(dir, sourceName, depth, maxDepth) {
        var names;
        if (!fs.existsSync(dir)) {
            return;
        }
        try {
            names = fs.readdirSync(dir);
        } catch (err) {
            writeLog("readdir failed: " + dir + " / " + err);
            return;
        }
        names.sort(function (a, b) {
            return String(a).localeCompare(String(b));
        });
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var full = path.join(dir, name);
            var stat = null;
            try {
                stat = fs.statSync(full);
            } catch (errStat) {
                continue;
            }
            if (stat.isDirectory()) {
                if (depth < maxDepth && !isIgnoredDir(name)) {
                    walk(full, sourceName, depth + 1, maxDepth);
                }
                continue;
            }
            if (/\.jsx?$/i.test(name)) {
                scripts.push({
                    name: name,
                    base: name.replace(/\.[^.]+$/, ""),
                    source: sourceName,
                    fullPath: full
                });
            }
        }
    }

    function scanScripts() {
        scripts = [];
        selectedIndex = -1;
        var sources = getSources();
        var scanDepth = getScanDepth();
        for (var i = 0; i < sources.length; i++) {
            walk(sources[i].folder, sources[i].name, 0, scanDepth);
        }
        applyFilter();
        setStatus(text("已加载 ", "Loaded ") + scripts.length + text(" 个 Illustrator 脚本", " Illustrator scripts"));
    }

    function applyFilter() {
        var q = String(byId("search").value || "").toLowerCase();
        filtered = [];
        for (var i = 0; i < scripts.length; i++) {
            var hay = (scripts[i].name + " " + displayName(scripts[i]) + " " + scripts[i].fullPath + " " + scripts[i].source).toLowerCase();
            if (!q || hay.indexOf(q) >= 0) {
                filtered.push(scripts[i]);
            }
        }
        renderList();
    }

    function renderList() {
        var list = byId("list");
        var html = "";
        if (!filtered.length) {
            list.innerHTML = '<div style="padding:12px;color:#aeb7bd;">' + text("没有找到脚本", "No scripts found") + '</div>';
            return;
        }
        for (var i = 0; i < filtered.length; i++) {
            var cls = "item" + (i === selectedIndex ? " selected" : "");
            html += '<button class="' + cls + '" data-index="' + i + '">' +
                '<span class="name">' + escapeHtml(displayName(filtered[i])) + '</span>' +
                '<span class="path">' + escapeHtml(filtered[i].source + " - " + filtered[i].fullPath) + '</span>' +
                '</button>';
        }
        list.innerHTML = html;
        var buttons = list.getElementsByTagName("button");
        for (var b = 0; b < buttons.length; b++) {
            buttons[b].onclick = function () {
                selectedIndex = parseInt(this.getAttribute("data-index"), 10);
                renderList();
                setStatus(text("已选中: ", "Selected: ") + displayName(filtered[selectedIndex]));
            };
            buttons[b].ondblclick = function () {
                selectedIndex = parseInt(this.getAttribute("data-index"), 10);
                runSelected();
            };
        }
    }

    function parseResult(raw) {
        try {
            var obj = JSON.parse(raw);
            var message = obj.message || raw;
            if (!obj.ok) {
                if (obj.file) {
                    message += "\n" + text("文件: ", "File: ") + obj.file;
                }
                if (obj.line) {
                    message += "\n" + text("行号: ", "Line: ") + obj.line;
                }
            }
            return message;
        } catch (err) {
            return raw;
        }
    }

    function runSelected() {
        if (selectedIndex < 0 || !filtered[selectedIndex]) {
            setStatus(text("请先选择一个脚本", "Please select a script first"));
            return;
        }
        var item = filtered[selectedIndex];
        setStatus(text("正在运行: ", "Running: ") + displayName(item));
        setOutput(text("运行中...", "Running...") + "\n" + item.fullPath);
        writeLog("run: " + item.fullPath);
        try {
            cs.evalScript("HGScripts.runScript(" + jsxString(item.fullPath) + ", \"auto\", \"\", \"\", \"\", " + jsxString(language) + ")", function (result) {
                var text = parseResult(result);
                setOutput(text);
                setStatus(text("运行完成: ", "Run finished: ") + displayName(item));
                writeLog("result: " + result);
            });
        } catch (err) {
            setOutput(text("运行失败: ", "Run failed: ") + err);
            setStatus(text("运行失败: ", "Run failed: ") + displayName(item));
            writeLog("run failed: " + err);
        }
    }

    function copyResult() {
        try {
            var text = lastResult || "";
            var ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setStatus(text("结果已复制", "Result copied"));
        } catch (err) {
            setStatus(text("复制失败: ", "Copy failed: ") + err);
        }
    }

    function boot() {
        try {
            cs = new CSInterface();
            fs = require("fs");
            path = require("path");
            root = cs.getSystemPath(SystemPath.EXTENSION);
            refreshLanguage();
            writeLog("boot begin, root=" + root);
            byId("refreshBtn").onclick = scanScripts;
            byId("runBtn").onclick = runSelected;
            byId("copyBtn").onclick = copyResult;
            byId("search").oninput = applyFilter;
            scanScripts();
            setOutput(text("安全面板已启动。双击脚本也可以运行。", "Safe panel started. Double-click a script to run it."));
            writeLog("boot done");
        } catch (err) {
            setStatus(text("安全面板启动失败", "Safe panel failed to start"));
            setOutput(String(err && err.stack ? err.stack : err));
            try {
                if (fs && path && root) {
                    writeLog("boot failed: " + err);
                }
            } catch (errLog) {}
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
