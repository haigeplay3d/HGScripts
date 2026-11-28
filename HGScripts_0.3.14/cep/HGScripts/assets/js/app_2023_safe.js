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
    var HGI = window.HGI18N || null;

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

    function text(key, params) {
        return HGI ? HGI.t(key, params) : key;
    }

    function displayName(item) {
        var base = String((item && item.base) || "").replace(/\.(jsx?|JSX?)$/, "");
        return isEnglish() && HGI ? HGI.scriptTitle(base) + ".jsx" : item.name;
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
            name: text("sourceDefaultName"),
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
                        name: parsed[i].name || text("sourceScriptSource"),
                        folder: parsed[i].folder,
                        scanDepth: parsed[i].scanDepth,
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
        var mode = HGI ? HGI.normalizeMode(settings.languageMode) : "zh-CN";
        var detected = HGI ? HGI.detectHostLanguage(cs) : (/^zh/i.test(String(navigator.language || "")) ? "zh-CN" : "en-US");
        language = HGI ? HGI.resolve(mode, detected) : "zh-CN";
        if (HGI) {
            HGI.setLanguage(language);
            if (HGI.applyStatic) {
                HGI.applyStatic();
            }
        }
        byId("search").placeholder = text("searchPlaceholder");
        byId("refreshBtn").textContent = text("refresh");
        byId("runBtn").textContent = text("runSelectedBtn");
        byId("copyBtn").textContent = text("copyResult");
    }

    function getScanDepth() {
        var settings = getSettings();
        var depth = parseInt(settings.scanDepth, 10);
        if (isNaN(depth)) {
            return 0;
        }
        return Math.max(0, Math.min(10, depth));
    }

    function getSourceScanDepth(source) {
        var depth = parseInt(source && source.scanDepth, 10);
        if (isNaN(depth)) {
            return getScanDepth();
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
        for (var i = 0; i < sources.length; i++) {
            walk(sources[i].folder, sources[i].name, 0, getSourceScanDepth(sources[i]));
        }
        applyFilter();
        setStatus(text("safeLoaded", { n: scripts.length }));
    }

    function pinyinMatch(item, q) {
        if (typeof HGPinyin === "undefined" || !/^[a-z0-9]+$/.test(q)) {
            return false;
        }
        if (!item._pinyinIndex) {
            var name = displayName(item);
            item._pinyinIndex = {
                nameFull: HGPinyin.toPinyin(name),
                nameInitials: HGPinyin.toInitials(name),
                fileFull: HGPinyin.toPinyin(item.name),
                fileInitials: HGPinyin.toInitials(item.name)
            };
        }
        var py = item._pinyinIndex;
        return py.nameFull.indexOf(q) >= 0 || py.nameInitials.indexOf(q) >= 0 ||
            py.fileFull.indexOf(q) >= 0 || py.fileInitials.indexOf(q) >= 0;
    }

    function applyFilter() {
        var q = String(byId("search").value || "").toLowerCase();
        filtered = [];
        for (var i = 0; i < scripts.length; i++) {
            var hay = (scripts[i].name + " " + displayName(scripts[i]) + " " + scripts[i].fullPath + " " + scripts[i].source).toLowerCase();
            if (!q || hay.indexOf(q) >= 0 || pinyinMatch(scripts[i], q)) {
                filtered.push(scripts[i]);
            }
        }
        renderList();
    }

    function renderList() {
        var list = byId("list");
        var html = "";
        if (!filtered.length) {
            list.innerHTML = '<div style="padding:12px;color:#aeb7bd;">' + escapeHtml(text("safeNoScripts")) + '</div>';
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
                setStatus(text("safeSelected", { name: displayName(filtered[selectedIndex]) }));
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
                    message += "\n" + text("runFilePrefix") + obj.file;
                }
                if (obj.line) {
                    message += "\n" + text("runLinePrefix", { n: obj.line });
                }
            }
            return message;
        } catch (err) {
            return raw;
        }
    }

    function runSelected() {
        if (selectedIndex < 0 || !filtered[selectedIndex]) {
            setStatus(text("needScript"));
            return;
        }
        var item = filtered[selectedIndex];
        setStatus(text("runRunningStatus", { name: displayName(item) }));
        setOutput(text("editorRunning") + "\n" + item.fullPath);
        writeLog("run: " + item.fullPath);
        try {
            cs.evalScript("HGScripts.runScript(" + jsxString(item.fullPath) + ", \"auto\", \"\", \"\", \"\", " + jsxString(language) + ")", function (result) {
                var message = parseResult(result);
                setOutput(message);
                setStatus(text("runStatusDone", { name: displayName(item) }));
                writeLog("result: " + result);
            });
        } catch (err) {
            setOutput(text("runStatusFailed", { name: displayName(item) }) + "\n" + err);
            setStatus(text("runStatusFailed", { name: displayName(item) }));
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
            setStatus(text("resultCopied"));
        } catch (err) {
            setStatus(text("copyFailed", { error: err }));
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
            setOutput(text("safeStarted"));
            writeLog("boot done");
        } catch (err) {
            setStatus(text("safeStartFailed"));
            setOutput(String(err && err.stack ? err.stack : err));
            try {
                if (fs && path && root) {
                    writeLog("boot failed: " + err);
                }
            } catch (errLog) {}
        }
    }

    /* 旧版安全面板没有脚本目录功能，但同样要拦住 CEF 的默认行为：
       否则把 .jsx 拖进面板会整页导航到纯文本，面板直接消失。 */
    function bindFileDropGuard() {
        function hasFiles(event) {
            var dt = event && event.dataTransfer;
            if (!dt || !dt.types || !dt.types.length) {
                return false;
            }
            for (var i = 0; i < dt.types.length; i++) {
                if (String(dt.types[i]).toLowerCase() === "files") {
                    return true;
                }
            }
            return false;
        }
        ["dragenter", "dragover", "drop"].forEach(function (type) {
            window.addEventListener(type, function (event) {
                if (!hasFiles(event)) {
                    return;
                }
                event.preventDefault();
                if (type === "drop" && byId("status")) {
                    setStatus(text("safeDropBlocked"));
                }
            }, true);
        });
    }

    bindFileDropGuard();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
