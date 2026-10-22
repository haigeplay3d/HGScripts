(function () {
  "use strict";

  var fs = null;
  var path = null;
  var childProcess = null;
  var cs = null;
  var bootLogPath = "";

  function writeBootStatus(message, level) {
    var elBoot = document.getElementById("bootStatus");
    if (!elBoot) {
      return;
    }
    elBoot.style.display = "block";
    elBoot.style.color = level === "error" ? "#ffd7d7" : "#ececec";
    elBoot.style.background = level === "error" ? "#6b3333" : "#535353";
    elBoot.textContent = message;
  }

  function writeBootLog(message) {
    try {
      if (!fs || !path) {
        return;
      }
      if (!bootLogPath) {
        var root = "";
        try {
          if (cs && typeof SystemPath !== "undefined" && cs.getSystemPath) {
            root = cs.getSystemPath(SystemPath.EXTENSION);
          }
        } catch (errRoot) {}
        if (!root && typeof __dirname !== "undefined") {
          root = path.resolve(__dirname, "..", "..");
        }
        bootLogPath = path.join(root, "data", "runtime", "panel_boot.log");
        ensureBootFolder(path.dirname(bootLogPath));
      }
      fs.appendFileSync(bootLogPath, "[" + new Date().toISOString() + "] " + message + "\r\n", "utf8");
    } catch (err) {}
  }

  function ensureBootFolder(folderPath) {
    try {
      if (fs && !fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    } catch (err) {}
  }

  function failBoot(message, err) {
    var detail = err && err.stack ? err.stack : (err && err.message ? err.message : String(err || ""));
    writeBootLog("FATAL " + message + (detail ? ": " + detail : ""));
    writeBootStatus(message + (detail ? "：" + detail : ""), "error");
  }

  function hideBootStatusIfUiPainted() {
    var bootStatus = document.getElementById("bootStatus");
    if (!bootStatus) {
      return;
    }
    if (HOST_PROFILE.year === "2023" && !LEGACY_COMPAT_MODE) {
      writeBootStatus("HGScripts v" + state.appVersion + " 已在 Illustrator 2023 启动。若下方仍是空白，请继续让 Codex 读取日志。", "warn");
      writeBootLog("boot status kept visible for Illustrator 2023");
      return;
    }
    var shell = document.querySelector(".shell");
    var topbar = document.querySelector(".topbar");
    var shellHeight = shell ? shell.offsetHeight : 0;
    var topbarHeight = topbar ? topbar.offsetHeight : 0;
    if (shellHeight > 40 && topbarHeight > 0) {
      bootStatus.style.display = "none";
      writeBootLog("boot status hidden after UI paint: shell=" + shellHeight + ", topbar=" + topbarHeight);
      return;
    }
    writeBootStatus("HGScripts 已启动，但旧版 Illustrator 面板高度异常。请拖大面板或重开面板。", "warn");
    writeBootLog("UI paint check failed: shell=" + shellHeight + ", topbar=" + topbarHeight);
  }

  try {
    writeBootStatus("正在加载 HGScripts 运行环境...");
    fs = require("fs");
    path = require("path");
    childProcess = require("child_process");
  } catch (errRequire) {
    failBoot("HGScripts 无法启用 CEP Node.js 环境", errRequire);
    return;
  }

  try {
    cs = new CSInterface();
    writeBootLog("CSInterface initialized");
  } catch (errCs) {
    failBoot("HGScripts 无法初始化 CSInterface", errCs);
    return;
  }

  var EXTENSION_ROOT = getExtensionRoot();
  var CEP_ROOT = path.resolve(EXTENSION_ROOT, "..", "..");
  var HOST_PROFILE = detectHostProfile();
  var USER_SCRIPTS_ROOT = path.join(EXTENSION_ROOT, "user_scripts");
  var DEFAULT_FOLDER = path.join(USER_SCRIPTS_ROOT, HOST_PROFILE.folder);
  var LEGACY_FLAT_USER_SCRIPTS_FOLDER = USER_SCRIPTS_ROOT;
  var EXTERNAL_DEFAULT_FOLDER = path.join(CEP_ROOT, "user_scripts", HOST_PROFILE.folder);
  var EXTERNAL_DATA_FOLDER = path.join(CEP_ROOT, "data");
  var STORAGE_PREFIX = "hgscripts." + HOST_PROFILE.key + ".";
  var LEGACY_FOLDER_KEY = "hgscripts.folder";
  var LEGACY_SOURCES_KEY = "hgscripts.sources";
  var LEGACY_ACTIVE_SOURCE_KEY = "hgscripts.activeSource";
  var LEGACY_FAVORITES_KEY = "hgscripts.favorites";
  var LEGACY_RUN_STATS_KEY = "hgscripts.runStats";
  var LEGACY_RECENT_SOURCES_KEY = "hgscripts.recentSources";
  var LEGACY_CONSOLE_HEIGHT_KEY = "hgscripts.consoleHeight";
  var LEGACY_PANEL_SIZES_KEY = "hgscripts.panelSizes";
  var SOURCES_KEY = STORAGE_PREFIX + "sources";
  var ACTIVE_SOURCE_KEY = STORAGE_PREFIX + "activeSource";
  var STATE_KEY = STORAGE_PREFIX + "lastState";
  var FAVORITES_KEY = STORAGE_PREFIX + "favorites";
  var RUN_STATS_KEY = STORAGE_PREFIX + "runStats";
  var RECENT_RUN_KEYS_KEY = STORAGE_PREFIX + "recentRunKeys";
  var RECENT_SOURCES_KEY = STORAGE_PREFIX + "recentSources";
  var CONSOLE_HEIGHT_KEY = STORAGE_PREFIX + "consoleHeight";
  var MAIN_SPLIT_WIDTH_KEY = STORAGE_PREFIX + "mainSplitWidth";
  var PANEL_SIZES_KEY = STORAGE_PREFIX + "panelSizes";
  var CPP_MODE_KEY = STORAGE_PREFIX + "cppMode";
  var PANEL_MENU_SETTINGS_ID = "openSettings";
  var PANEL_MENU_ABOUT_ID = "openAbout";
  // Auto refresh is intentionally paused for now. Keep the watcher/polling
  // code below so it can be re-enabled later without rebuilding the feature.
  var AUTO_REFRESH_ENABLED = false;
  var REFRESH_INTERVAL_MS = 1500;
  var LEGACY_COMPAT_MODE = /\blegacy=1\b/.test(String(window.location.search || ""));
  var SETTINGS_PATH = path.join(EXTENSION_ROOT, "data", "settings.json");
  var SCRIPT_ICONS_PATH = path.join(EXTENSION_ROOT, "data", "script_icons.json");
  var RUNTIME_FOLDER = path.join(EXTENSION_ROOT, "data", "runtime");
  var RECENT_SORT_LOG_PATH = path.join(RUNTIME_FOLDER, "recent_sort.log");
  var SHARED_RUNTIME_FOLDER = path.join(process.env.APPDATA || CEP_ROOT, "HGScripts", "runtime");
  var RUN_STATUS_PATH = path.join(SHARED_RUNTIME_FOLDER, "run_status.json");
  var RUN_REQUEST_PATH = path.join(SHARED_RUNTIME_FOLDER, "run_request.json");
  var DEFAULT_SCRIPT_ICON = "assets/icons/script.svg";
  var HOST_ICON_SRC = {
    illustrator: "assets/icons/host-illustrator.svg",
    photoshop: "assets/icons/host-photoshop.svg",
    indesign: "assets/icons/host-indesign.svg"
  };
  var DOC_ICON_SRC = "assets/icons/file-tips-filled.svg";
  var STAR_OUTLINE_ICON_SRC = "assets/icons/star-outline.svg";
  var STAR_FILLED_ICON_SRC = "assets/icons/star-filled.svg";
  var SCRIPT_EXTENSIONS = { ".jsx": true, ".js": true };
  var MIN_PANEL_WIDTH = 300;
  var MIN_PANEL_HEIGHT = 300;
  var FIRST_RUN_PANEL_WIDTH = 300;
  var FIRST_RUN_PANEL_HEIGHT = 320;
  var NARROW_PANEL_WIDTH = 420;
  var NARROW_PANEL_HEIGHT = 560;
  var WIDE_PANEL_WIDTH = 1000;
  var WIDE_PANEL_HEIGHT = 780;
  var WIDE_LAYOUT_THRESHOLD = 720;
  var DEFAULT_SETTINGS = {
    scanDepth: 0,
    ignoredDirs: ["node_modules", ".git", ".svn", ".hg"],
    languageMode: "auto"
  };
  var COMMAND_SCENES = [
    { id: "all", label: "全部", aliases: [] },
    { id: "favorites", label: "常用", aliases: ["收藏", "常用", "星标"] },
    { id: "recent", label: "最近", aliases: ["最近", "刚用", "上次"] },
    { id: "select", label: "选择", aliases: ["选择", "选中", "对象", "空对象", "同色", "无填色", "无描边"] },
    { id: "color", label: "颜色", aliases: ["颜色", "填充", "描边", "黑", "白", "同色", "转色", "改色"] },
    { id: "size", label: "尺寸", aliases: ["尺寸", "缩放", "长边", "1024", "宽", "高", "整数", "小数"] },
    { id: "align", label: "对齐", aliases: ["对齐", "居中", "左对齐", "右对齐", "顶部", "底部", "基准"] },
    { id: "artboard", label: "画板", aliases: ["画板", "外框", "背景", "新画板"] },
    { id: "export", label: "导出", aliases: ["导出", "保存", "输出", "复制到新画板"] },
    { id: "diagnostic", label: "诊断", aliases: ["诊断", "记录", "恢复", "测试", "实验", "调试"] },
    { id: "photoshop", label: "PS", aliases: ["photoshop", "ps", "图层", "蒙版", "剪贴板", "beauty"] }
  ];
  var UI_TEXT = {
    "zh-CN": {
      searchPlaceholder: "搜索脚本",
      cppModeTitle: "C++ / JSX 运行模式",
      refresh: "刷新",
      refreshTitle: "立即刷新脚本列表",
      expand: "展开",
      collapse: "收起",
      sort: "最近使用",
      sortTitle: "排序",
      sortLastRun: "最近使用",
      sortMtime: "最近修改",
      sortInitialAsc: "首字母 A-Z",
      sortInitialDesc: "首字母 Z-A",
      sortNameAsc: "名称 A-Z",
      sortNameDesc: "名称 Z-A",
      favorites: "收藏",
      favoritesTitle: "只显示收藏脚本",
      defaultSource: "默认",
      defaultSourceTitle: "切换到默认脚本目录",
      newScript: "新建",
      addFolder: "添加目录",
      folderLoading: "正在读取脚本目录...",
      all: "全部",
      splitterTitle: "拖动调整脚本列表宽度",
      selectScript: "选择一个脚本",
      rename: "重命名",
      renameTitle: "重命名脚本并同步同名说明",
      run: "运行",
      openExternal: "外部打开",
      reveal: "定位",
      docTitle: "使用说明",
      saveDoc: "保存说明",
      saveDocTitle: "保存同名 Markdown 说明",
      docPlaceholder: "同名 .md 会显示在这里。",
      close: "关闭",
      save: "保存",
      saveRun: "保存并运行",
      reload: "重新读取",
      duplicate: "创建副本",
      noScriptOpen: "未打开脚本",
      console: "控制台",
      copyAll: "复制全部",
      copyError: "复制报错",
      clear: "清空",
      waitingResult: "等待运行结果。",
      settings: "设置",
      settingsSub: "插件界面和运行偏好",
      back: "返回",
      language: "语言",
      auto: "自动",
      chinese: "中文",
      saveLanguage: "保存语言设置",
      languageSaved: "语言已保存：",
      languageRefreshReason: "语言切换",
      languageHintPrefix: "当前界面语言已启用。选项：",
      languageHintHost: "，Illustrator/CEP：",
      languageHintEffective: "，实际语言：",
      languageHintSuffix: "。",
      about: "关于",
      pluginName: "插件名称",
      version: "版本",
      updateDate: "更新日期",
      referenceProjects: "参考项目",
      description: "说明",
      aboutDescription: "免费开源发布，当前以 Illustrator 为主，正在准备 Photoshop / InDesign 支持。",
      ready: "准备就绪",
      noSelection: "未选择脚本",
      sourceManager: "目录管理",
      sourceAlias: "目录别名",
      folderPath: "粘贴脚本目录路径，Enter 添加",
      saveChanges: "保存修改",
      removeFromList: "从列表移除",
      scanDepth: "扫描深度",
      scanCurrentOnly: "0：仅当前目录",
      scanChildPrefix: "：+",
      scanChildSuffix: " 层子目录",
      ignoredDirs: "忽略目录，如 node_modules,.git,.svn,.hg",
      saveSettings: "保存设置",
      addedSources: "已添加目录",
      newScriptName: "新脚本名",
      docCheckbox: "使用说明",
      create: "创建",
      unsavedScript: "当前脚本未保存",
      unsavedDoc: "当前说明未保存",
      saveThenSwitch: "保存后切换",
      switchDirectly: "直接切换",
      cancel: "取消",
      editScript: "编辑脚本",
      editDoc: "编辑说明",
      revealExplorer: "定位到资源管理器",
      deleteScript: "删除脚本",
      panelSizeTitle: "切换大/小面板",
      closeEditorTitle: "关闭内部编辑器",
      consoleResizerTitle: "拖动调整控制台高度",
      backTitle: "返回脚本列表"
    },
    "en-US": {
      searchPlaceholder: "Search scripts",
      cppModeTitle: "C++ / JSX run mode",
      refresh: "Refresh",
      refreshTitle: "Refresh the script list now",
      expand: "Expand",
      collapse: "Collapse",
      sort: "Recent",
      sortTitle: "Sort",
      sortLastRun: "Recently used",
      sortMtime: "Recently modified",
      sortInitialAsc: "Initial A-Z",
      sortInitialDesc: "Initial Z-A",
      sortNameAsc: "Name A-Z",
      sortNameDesc: "Name Z-A",
      favorites: "Favorites",
      favoritesTitle: "Show favorite scripts only",
      defaultSource: "Default",
      defaultSourceTitle: "Switch to the default script folder",
      newScript: "New",
      addFolder: "Add Folder",
      folderLoading: "Reading script folders...",
      all: "All",
      splitterTitle: "Drag to resize the script list",
      selectScript: "Select a script",
      rename: "Rename",
      renameTitle: "Rename the script and matching docs",
      run: "Run",
      openExternal: "Open",
      reveal: "Reveal",
      docTitle: "Guide",
      saveDoc: "Save Guide",
      saveDocTitle: "Save the matching Markdown guide",
      docPlaceholder: "The matching .md guide appears here.",
      close: "Close",
      save: "Save",
      saveRun: "Save & Run",
      reload: "Reload",
      duplicate: "Duplicate",
      noScriptOpen: "No script open",
      console: "Console",
      copyAll: "Copy All",
      copyError: "Copy Error",
      clear: "Clear",
      waitingResult: "Waiting for run results.",
      settings: "Settings",
      settingsSub: "Panel UI and run preferences",
      back: "Back",
      language: "Language",
      auto: "Auto",
      chinese: "Chinese",
      saveLanguage: "Save Language",
      languageSaved: "Language saved: ",
      languageRefreshReason: "Language changed",
      languageHintPrefix: "Panel language is active. Setting: ",
      languageHintHost: ", Illustrator/CEP: ",
      languageHintEffective: ", effective: ",
      languageHintSuffix: ".",
      about: "About",
      pluginName: "Plugin name",
      version: "Version",
      updateDate: "Updated",
      referenceProjects: "Reference projects",
      description: "Description",
      aboutDescription: "Free and open source. Illustrator is the primary host; Photoshop and InDesign support is being prepared.",
      ready: "Ready",
      noSelection: "No script selected",
      sourceManager: "Folder Manager",
      sourceAlias: "Folder alias",
      folderPath: "Paste a script folder path, Enter to add",
      saveChanges: "Save Changes",
      removeFromList: "Remove from List",
      scanDepth: "Scan depth",
      scanCurrentOnly: "0: current folder only",
      scanChildPrefix: ": +",
      scanChildSuffix: " child folders",
      ignoredDirs: "Ignored folders, e.g. node_modules,.git,.svn,.hg",
      saveSettings: "Save Settings",
      addedSources: "Added Folders",
      newScriptName: "New script name",
      docCheckbox: "Guide",
      create: "Create",
      unsavedScript: "Current script is not saved",
      unsavedDoc: "Current guide is not saved",
      saveThenSwitch: "Save then Switch",
      switchDirectly: "Switch Directly",
      cancel: "Cancel",
      editScript: "Edit Script",
      editDoc: "Edit Guide",
      revealExplorer: "Reveal in Explorer",
      deleteScript: "Delete Script",
      panelSizeTitle: "Toggle wide/narrow panel",
      closeEditorTitle: "Close the internal editor",
      consoleResizerTitle: "Drag to resize the console",
      backTitle: "Back to script list"
    }
  };
  var EN_SCRIPT_TITLES = {
    "ai坐标转其它_gemini": "AI Coordinate Converter (Legacy Gemini)",
    "AI坐标转换工具": "AI Coordinate Converter",
    "为选择对象创建外框": "Create Frame Around Selection",
    "六个对象两行三列最大化": "Maximize 6 Objects in 2x3 Grid",
    "单一色转其它色": "Single Color to Another Color",
    "单一色转自定义色_其它转自定义色": "Single Color and Others to Custom Colors",
    "同色转白其余转黑": "Same Color to White, Others to Black",
    "同色转黑其余转白": "Same Color to Black, Others to White",
    "填充色同步到描边色": "Sync Fill Color to Stroke",
    "复制选择对象到新画板": "Copy Selection to New Artboard",
    "导出选择对象为长边1024AI": "Export Selection as 1024 Long-Edge AI",
    "尺寸无小数": "Remove Decimal Dimensions",
    "纸杯展开": "Paper Cup Template",
    "应用对象中心相对画板位置": "Apply Object Center Relative to Artboard",
    "当前画板创建黑色背景矩形": "Create Black Background on Current Artboard",
    "手选基准对齐画板-右对齐": "Manual Reference Align to Artboard - Right",
    "手选基准对齐画板-垂直居中": "Manual Reference Align to Artboard - Vertical Center",
    "手选基准对齐画板-左对齐": "Manual Reference Align to Artboard - Left",
    "手选基准对齐画板-底部对齐": "Manual Reference Align to Artboard - Bottom",
    "手选基准对齐画板-水平居中": "Manual Reference Align to Artboard - Horizontal Center",
    "手选基准对齐画板-顶部对齐": "Manual Reference Align to Artboard - Top",
    "手选基准缩放": "Manual Reference Scale",
    "描边色同步到填充色": "Sync Stroke Color to Fill",
    "清理真正无用的空对象": "Clean Truly Useless Empty Objects",
    "生成UPC-A条形码": "Generate UPC-A Barcode",
    "记录对象中心相对画板位置": "Record Object Center Relative to Artboard",
    "选择同色对象-严格版": "Select Same-Color Objects - Strict",
    "选择同色对象-宽松版": "Select Same-Color Objects - Loose",
    "选择对象上方创建白色矩形": "Create White Rectangle Above Selection",
    "选择对象黑白互换": "Swap Black and White in Selection",
    "选择对象转白色": "Turn Selection White",
    "选择对象转自定义颜色": "Turn Selection to Custom Color",
    "选择对象转黑色": "Turn Selection Black",
    "选择对象长边设为1024": "Set Selection Long Edge to 1024",
    "选择空对象_极速版": "Select Empty Objects - Fast",
    "选择转白其余转黑": "Selection to White, Others to Black",
    "选择转黑其余转白": "Selection to Black, Others to White"
  };
  var settings = loadSettings();
  migrateSettingsStorage();
  var hostLanguage = detectHostLanguage();
  var effectiveLanguage = resolveEffectiveLanguage(settings.languageMode, hostLanguage);

  var storedPanelSizes = loadJson(PANEL_SIZES_KEY, null);
  var state = {
    sources: loadSources(),
    activeSourceId: getStoredValue(ACTIVE_SOURCE_KEY, "all"),
    files: [],
    filtered: [],
    selectedPath: "",
    watchers: [],
    lastSignature: "",
    refreshTimer: null,
    debounceTimer: null,
    favorites: loadJson(FAVORITES_KEY, {}),
    runStats: loadJson(RUN_STATS_KEY, {}),
    recentRunKeys: loadJson(RECENT_RUN_KEYS_KEY, []),
    editorPath: "",
    editorDirty: false,
    editorLoading: false,
    docDirty: false,
    docLoading: false,
    docPath: "",
    ace: null,
    editorMarker: null,
    latestErrorText: "",
    running: false,
    runningPath: "",
    runToken: 0,
    runProbeTimer: null,
    runProbeActive: false,
    runUiTimer: null,
    runStatusTimer: null,
    runCompletedToken: "",
    scriptIcons: loadScriptIcons(),
    cppMode: normalizeCppMode(getStoredValue(CPP_MODE_KEY, "auto")),
    activeSceneId: "all",
    panelMode: "narrow",
    panelSizes: storedPanelSizes || {
      narrow: { width: FIRST_RUN_PANEL_WIDTH, height: FIRST_RUN_PANEL_HEIGHT },
      wide: { width: WIDE_PANEL_WIDTH, height: WIDE_PANEL_HEIGHT }
    },
    pendingSwitchPath: "",
    pendingSwitchCallback: null,
    pendingSwitchKind: "code",
    appVersion: "0.3.7",
    idleCountText: "0 个脚本",
    watchStatusText: "监听未启动",
    statusMessage: "",
    statusRightText: "",
    statusLevel: "",
    statusHoldUntil: 0
  };

  var el = {
    shell: document.querySelector(".shell"),
    hostBadge: document.getElementById("hostBadge"),
    hostIcon: document.getElementById("hostIcon"),
    panelSizeLabel: document.getElementById("panelSizeLabel"),
    cppModeSelect: document.getElementById("cppModeSelect"),
    folderHint: document.getElementById("folderHint"),
    appVersion: document.getElementById("appVersion"),
    quickCreateScriptBtn: document.getElementById("quickCreateScriptBtn"),
    sourcebar: document.getElementById("sourcebar"),
    sourceTabs: document.getElementById("sourceTabs"),
    sourceModal: document.getElementById("sourceModal"),
    createModal: document.getElementById("createModal"),
    switchModal: document.getElementById("switchModal"),
    settingsView: document.getElementById("settingsView"),
    aboutView: document.getElementById("aboutView"),
    sourceNameInput: document.getElementById("sourceNameInput"),
    folderInput: document.getElementById("folderInput"),
    chooseBtn: document.getElementById("chooseBtn"),
    chooseScriptBtn: document.getElementById("chooseScriptBtn"),
    currentDocBtn: document.getElementById("currentDocBtn"),
    addSourceBtn: document.getElementById("addSourceBtn"),
    saveSourceBtn: document.getElementById("saveSourceBtn"),
    removeSourceBtn: document.getElementById("removeSourceBtn"),
    closeSourcesBtn: document.getElementById("closeSourcesBtn"),
    closeCreateBtn: document.getElementById("closeCreateBtn"),
    closeSettingsViewBtn: document.getElementById("closeSettingsViewBtn"),
    closeAboutViewBtn: document.getElementById("closeAboutViewBtn"),
    newScriptNameInput: document.getElementById("newScriptNameInput"),
    newScriptDocInput: document.getElementById("newScriptDocInput"),
    createScriptBtn: document.getElementById("createScriptBtn"),
    switchTitle: document.getElementById("switchTitle"),
    switchSaveBtn: document.getElementById("switchSaveBtn"),
    switchDiscardBtn: document.getElementById("switchDiscardBtn"),
    switchCancelBtn: document.getElementById("switchCancelBtn"),
    sourceList: document.getElementById("sourceList"),
    recentSourceSelect: document.getElementById("recentSourceSelect"),
    scanDepthInput: document.getElementById("scanDepthInput"),
    ignoredDirsInput: document.getElementById("ignoredDirsInput"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),
    languageSelect: document.getElementById("languageSelect"),
    languageHint: document.getElementById("languageHint"),
    uiZoomSelect: document.getElementById("uiZoomSelect"),
    saveLanguageBtn: document.getElementById("saveLanguageBtn"),
    aboutVersion: document.getElementById("aboutVersion"),
    githubLink: document.getElementById("githubLink"),
    refreshBtn: document.getElementById("refreshBtn"),
    panelSizeBtn: document.getElementById("panelSizeBtn"),
    toggleSourcesBtn: document.getElementById("toggleSourcesBtn"),
    favoritesFilterBtn: document.getElementById("favoritesFilterBtn"),
    defaultSourceBtn: document.getElementById("defaultSourceBtn"),
    searchInput: document.getElementById("searchInput"),
    favoriteOnlyInput: document.getElementById("favoriteOnlyInput"),
    sortSelect: document.getElementById("sortSelect"),
    sortMenuBtn: document.getElementById("sortMenuBtn"),
    sortMenu: document.getElementById("sortMenu"),
    statusLine: document.querySelector(".statusline"),
    countLabel: document.getElementById("countLabel"),
    watchLabel: document.getElementById("watchLabel"),
    commandCenter: document.getElementById("commandCenter"),
    sceneChips: document.getElementById("sceneChips"),
    quickPicks: document.getElementById("quickPicks"),
    contentPanel: document.getElementById("contentPanel"),
    scriptList: document.getElementById("scriptList"),
    detailTitle: document.getElementById("detailTitle"),
    detailMeta: document.getElementById("detailMeta"),
    renameInput: document.getElementById("renameInput"),
    renameBtn: document.getElementById("renameBtn"),
    favoriteBtn: document.getElementById("favoriteBtn"),
    detailDoc: document.getElementById("detailDoc"),
    saveDocBtn: document.getElementById("saveDocBtn"),
    runBtn: document.getElementById("runBtn"),
    openBtn: document.getElementById("openBtn"),
    revealBtn: document.getElementById("revealBtn"),
    codeEditor: document.getElementById("codeEditor"),
    mainSplitter: document.getElementById("mainSplitter"),
    editorTitle: document.getElementById("editorTitle"),
    editorTitleInput: document.getElementById("editorTitleInput"),
    editorPath: document.getElementById("editorPath"),
    closeEditorBtn: document.getElementById("closeEditorBtn"),
    saveCodeBtn: document.getElementById("saveCodeBtn"),
    runCodeBtn: document.getElementById("runCodeBtn"),
    saveRunCodeBtn: document.getElementById("saveRunCodeBtn"),
    reloadCodeBtn: document.getElementById("reloadCodeBtn"),
    duplicateCodeBtn: document.getElementById("duplicateCodeBtn"),
    openDocFolderBtn: document.getElementById("openDocFolderBtn"),
    editorState: document.getElementById("editorState"),
    aceEditor: document.getElementById("aceEditor"),
    consoleResizer: document.getElementById("consoleResizer"),
    consoleOutput: document.getElementById("consoleOutput"),
    clearConsoleBtn: document.getElementById("clearConsoleBtn"),
    copyConsoleBtn: document.getElementById("copyConsoleBtn"),
    copyErrorConsoleBtn: document.getElementById("copyErrorConsoleBtn"),
    contextMenu: document.getElementById("contextMenu"),
    selectedMetaBar: document.getElementById("selectedMetaBar"),
    toast: document.getElementById("toast")
  };

  var UI_ZOOM_KEY = "hgscripts.uiZoom";
  var UI_ZOOM_VALUES = { "1": true, "1.25": true, "1.5": true, "1.75": true, "2": true };

  function normalizeUiZoom(value) {
    var key = String(value == null ? "" : value).trim();
    return UI_ZOOM_VALUES.hasOwnProperty(key) ? key : "1";
  }

  function applyUiZoom() {
    var zoom = normalizeUiZoom(getStoredValue(UI_ZOOM_KEY, "1"));
    if (document.body) {
      document.body.style.zoom = zoom === "1" ? "" : Number(zoom);
    }
    if (el.uiZoomSelect && el.uiZoomSelect.value !== zoom) {
      el.uiZoomSelect.value = zoom;
    }
  }

  function init() {
    writeBootStatus("正在初始化 HGScripts...");
    writeBootLog("init begin");
    if (LEGACY_COMPAT_MODE && document.body) {
      document.body.className += (document.body.className ? " " : "") + "legacy-compat";
    }
    ensureFolder(USER_SCRIPTS_ROOT);
    ensureFolder(DEFAULT_FOLDER);
    migrateFlatUserScriptsToIllustrator();
    ensureFolder(RUNTIME_FOLDER);
    ensureFolder(SHARED_RUNTIME_FOLDER);
    writePanelLog("loaded build=0.3.7-release-20261023 root=" + EXTENSION_ROOT);
    saveSettings();
    renderHostProfile();
    renderCppMode();
    renderAppVersion();
    migrateDefaultSource();
    ensureActiveSource();
    if (LEGACY_COMPAT_MODE) {
      initLegacyTextEditor();
    } else {
      initAceEditor();
    }
    setupPanelMenu();
    bindEvents();
    renderSources();
    renderSettings();
    applyUiZoom();
    applyConsoleHeight();
    applyMainSplitWidth();
    restoreStartupPanelSize();
    render();
    writeBootLog("init UI ready");
    setTimeout(function () {
      try {
        writeBootLog("startup refresh begin");
        refresh("\u542F\u52A8\u626B\u63CF");
        hideBootStatusIfUiPainted();
        writeBootLog("startup refresh done");
      } catch (errRefresh) {
        failBoot("HGScripts 启动扫描失败", errRefresh);
      }
    }, 0);
    startPolling();
    startWatchers();
    if (LEGACY_COMPAT_MODE) {
      setTimeout(tryUpgradeLegacyAceEditor, 900);
    }
  }

  function setupPanelMenu() {
    try {
      cs.setPanelFlyoutMenu("<Menu><MenuItem Id=\"" + PANEL_MENU_SETTINGS_ID + "\" Label=\"&#35774;&#32622;\" Enabled=\"true\" Checked=\"false\"/><MenuItem Id=\"" + PANEL_MENU_ABOUT_ID + "\" Label=\"&#20851;&#20110;\" Enabled=\"true\" Checked=\"false\"/></Menu>");
      cs.addEventListener("com.adobe.csxs.events.flyoutMenuClicked", function (event) {
        var data = event && event.data ? event.data : {};
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch (err) {
            data = { menuId: data };
          }
        }
        if (data.menuId === PANEL_MENU_SETTINGS_ID || data.menuName === "\u8BBE\u7F6E") {
          openSettingsView();
        } else if (data.menuId === PANEL_MENU_ABOUT_ID || data.menuName === "\u5173\u4E8E") {
          openAboutView();
        }
      });
    } catch (err) {}
  }

  function renderHostProfile() {
    document.body.setAttribute("data-host", HOST_PROFILE.key);
    if (el.hostBadge) {
      el.hostBadge.textContent = HOST_PROFILE.shortLabel;
      el.hostBadge.title = "\u5F53\u524D\u5BBF\u4E3B: " + HOST_PROFILE.label;
    }
    if (el.hostIcon) {
      el.hostIcon.src = HOST_ICON_SRC[HOST_PROFILE.key] || HOST_ICON_SRC.illustrator;
      el.hostIcon.alt = HOST_PROFILE.shortLabel;
    }
    if (el.panelSizeBtn) {
      el.panelSizeBtn.setAttribute("aria-label", "\u5F53\u524D\u5BBF\u4E3B: " + HOST_PROFILE.label + "\uFF0C\u70B9\u51FB\u5207\u6362\u5927/\u5C0F\u9762\u677F");
    }
    if (el.openDocFolderBtn) {
      el.openDocFolderBtn.title = "\u6253\u5F00\u5F53\u524D " + HOST_PROFILE.label + " \u6587\u6863\u6240\u5728\u6587\u4EF6\u5939";
    }
  }

  function renderAppVersion() {
    var version = "0.3.7";
    try {
      var manifestPath = path.join(EXTENSION_ROOT, "CSXS", "manifest.xml");
      var manifest = fs.readFileSync(manifestPath, "utf8");
      var match = manifest.match(/ExtensionBundleVersion="([^"]+)"/) || manifest.match(/<Extension[^>]+Version="([^"]+)"/);
      if (match && match[1]) {
        version = match[1];
      }
    } catch (err) {
      version = "0.3.7";
    }
    document.title = "\u6D77\u54E5\u7684Adobe\u811A\u672C\u7BA1\u7406 v" + version;
    if (el.appVersion) {
      el.appVersion.textContent = "v" + version;
    }
    if (el.aboutVersion) {
      el.aboutVersion.textContent = "v" + version;
    }
    state.appVersion = version;
  }

  function applyPanelMode(mode) {
    state.panelMode = mode === "wide" ? "wide" : "narrow";
    if (el.shell) {
      el.shell.classList.toggle("panel-wide", state.panelMode === "wide");
      el.shell.classList.toggle("panel-narrow", state.panelMode === "narrow");
    }
    if (el.panelSizeBtn) {
      el.panelSizeBtn.title = state.panelMode === "wide" ? "\u5207\u6362\u5230\u5C0F\u9762\u677F" : "\u5207\u6362\u5230\u5927\u9762\u677F";
      el.panelSizeBtn.classList.toggle("panel-wide-active", state.panelMode === "wide");
    }
    if (el.panelSizeLabel) {
      el.panelSizeLabel.textContent = state.panelMode === "wide" ? "\u6536\u8D77" : "\u5C55\u5F00";
    }
    if (state.ace) {
      setTimeout(function () {
        state.ace.resize(true);
      }, 0);
    }
  }

  function renderStatusLine() {
    if (!el.countLabel || !el.watchLabel) {
      return;
    }
    var priority = state.running || Date.now() < state.statusHoldUntil;
    if (el.statusLine) {
      el.statusLine.className = "statusline" + (priority ? " priority " + (state.statusLevel || "") : "");
    }
    if (priority) {
      el.countLabel.textContent = state.statusMessage || state.idleCountText || "";
      el.watchLabel.textContent = state.statusRightText || "";
      return;
    }
    el.countLabel.textContent = state.idleCountText || "";
    el.watchLabel.textContent = getIdleRightStatusText();
  }

  function setPriorityStatus(message, rightText, level, holdMs) {
    state.statusMessage = message || "";
    state.statusRightText = rightText || "";
    state.statusLevel = level || "";
    state.statusHoldUntil = holdMs ? Date.now() + holdMs : 0;
    renderStatusLine();
    if (holdMs) {
      setTimeout(renderStatusLine, holdMs + 50);
    }
  }

  function setIdleStatus(leftText, rightText) {
    state.idleCountText = leftText || state.idleCountText || "0 个脚本";
    if (typeof rightText === "string") {
      state.watchStatusText = rightText;
    }
    renderStatusLine();
  }

  function getIdleRightStatusText() {
    var modeText = getCppModeStatusText(normalizeCppMode(state.cppMode));
    var watchText = state.watchStatusText || "";
    return watchText ? modeText + " | " + watchText : modeText;
  }

  function syncPanelModeFromWidth() {
    var width = document.documentElement.clientWidth || document.body.clientWidth || 0;
    var nextMode = width >= WIDE_LAYOUT_THRESHOLD ? "wide" : "narrow";
    if (nextMode === state.panelMode) {
      rememberPanelSize(state.panelMode);
    } else {
      applyPanelMode(nextMode);
      rememberPanelSize(nextMode);
    }
  }

  function resizePanel(mode, silent) {
    rememberPanelSize(state.panelMode);
    applyPanelMode(mode);
    var size = getRememberedPanelSize(mode);
    try {
      setPanelContentSize(size);
      if (!silent) {
        setToast(mode === "wide" ? "\u5DF2\u5207\u6362\u5230\u5927\u9762\u677F" : "\u5DF2\u5207\u6362\u5230\u5C0F\u9762\u677F", "ok");
      }
      setTimeout(function () {
        if (state.ace) {
          state.ace.resize(true);
        }
      }, 120);
    } catch (err) {
      if (!silent) {
        setToast("\u9762\u677F\u5C3A\u5BF8\u5207\u6362\u5931\u8D25: " + err.message, "error");
      }
    }
  }

  function restoreStartupPanelSize() {
    applyPanelMode("narrow");
    var size = getRememberedPanelSize("narrow");
    try {
      setPanelContentSize(size);
    } catch (err) {}
  }

  function setPanelContentSize(size) {
    if (cs && typeof cs.resizeContent === "function") {
      cs.resizeContent(size.width, size.height);
    } else if (window.__adobe_cep__ && window.__adobe_cep__.resizeContent) {
      window.__adobe_cep__.resizeContent(size.width, size.height);
    }
  }

  function getPanelClientSize() {
    var width = document.documentElement.clientWidth || document.body.clientWidth || 0;
    var height = document.documentElement.clientHeight || document.body.clientHeight || 0;
    return { width: width, height: height };
  }

  function getRememberedPanelSize(mode) {
    var fallback = mode === "wide"
      ? { width: WIDE_PANEL_WIDTH, height: WIDE_PANEL_HEIGHT }
      : { width: NARROW_PANEL_WIDTH, height: NARROW_PANEL_HEIGHT };
    var saved = state.panelSizes && state.panelSizes[mode];
    return normalizePanelSize(saved, fallback);
  }

  function rememberPanelSize(mode) {
    if (mode !== "wide" && mode !== "narrow") {
      return;
    }
    var size = getPanelClientSize();
    var fallback = getRememberedPanelSize(mode);
    var normalized = normalizePanelSize(size, fallback);
    state.panelSizes = state.panelSizes || {};
    state.panelSizes[mode] = normalized;
    setStoredValue(PANEL_SIZES_KEY, state.panelSizes);
  }

  function normalizePanelSize(size, fallback) {
    var next = {
      width: parseInt(size && size.width, 10),
      height: parseInt(size && size.height, 10)
    };
    if (!next.width || next.width < MIN_PANEL_WIDTH) {
      next.width = fallback.width;
    }
    if (!next.height || next.height < MIN_PANEL_HEIGHT) {
      next.height = fallback.height;
    }
    next.width = Math.max(MIN_PANEL_WIDTH, Math.min(1400, next.width));
    next.height = Math.max(MIN_PANEL_HEIGHT, Math.min(1800, next.height));
    return next;
  }

  function bindEvents() {
    el.refreshBtn.addEventListener("click", function () {
      refresh("\u624B\u52A8\u5237\u65B0");
    });

    if (el.panelSizeBtn) {
      el.panelSizeBtn.addEventListener("click", function () {
        resizePanel(state.panelMode === "wide" ? "narrow" : "wide");
      });
    }

    if (el.favoritesFilterBtn) {
      el.favoritesFilterBtn.addEventListener("click", function () {
        state.activeSourceId = "favorites";
        renderSources();
        render();
      });
    }

    if (el.defaultSourceBtn) {
      el.defaultSourceBtn.addEventListener("click", function () {
        var defaultSource = getDefaultSource() || state.sources[0];
        if (defaultSource) {
          state.activeSourceId = defaultSource.id;
          renderSources();
          render();
        }
      });
    }

    el.toggleSourcesBtn.addEventListener("click", function () {
      openSourceModal();
    });

    el.addSourceBtn.addEventListener("click", chooseAndAddSourceWithWindowsDialog);
    el.saveSourceBtn.addEventListener("click", saveActiveSourceFromInput);
    el.removeSourceBtn.addEventListener("click", removeActiveSource);
    el.quickCreateScriptBtn.addEventListener("click", quickCreateScript);
    el.createScriptBtn.addEventListener("click", createNewScript);
    el.newScriptNameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        createNewScript();
      }
    });
    el.closeSourcesBtn.addEventListener("click", closeSourceModal);
    el.closeCreateBtn.addEventListener("click", closeCreateModal);
    el.sourceModal.addEventListener("click", function (event) {
      if (event.target === el.sourceModal) {
        closeSourceModal();
      }
    });
    el.createModal.addEventListener("click", function (event) {
      if (event.target === el.createModal) {
        closeCreateModal();
      }
    });
    el.switchSaveBtn.addEventListener("click", function () {
      resolvePendingSwitch("save");
    });
    el.switchDiscardBtn.addEventListener("click", function () {
      resolvePendingSwitch("discard");
    });
    el.switchCancelBtn.addEventListener("click", function () {
      resolvePendingSwitch("cancel");
    });
    if (el.chooseBtn) {
      el.chooseBtn.addEventListener("click", chooseScriptWithWindowsDialog);
    }
    if (el.chooseScriptBtn) {
      el.chooseScriptBtn.addEventListener("click", chooseFolderWithWindowsDialog);
    }
    if (el.currentDocBtn) {
      el.currentDocBtn.addEventListener("click", chooseCurrentDocumentFolder);
    }
    el.saveSettingsBtn.addEventListener("click", saveSettingsFromForm);
    el.closeSettingsViewBtn.addEventListener("click", closeUtilityViews);
    el.closeAboutViewBtn.addEventListener("click", closeUtilityViews);
    el.saveLanguageBtn.addEventListener("click", saveLanguageFromForm);
    if (el.uiZoomSelect) {
      el.uiZoomSelect.addEventListener("change", function () {
        setStoredValue(UI_ZOOM_KEY, normalizeUiZoom(el.uiZoomSelect.value));
        applyUiZoom();
        setToast("界面缩放已调整为 " + (Number(el.uiZoomSelect.value) * 100) + "%", "ok");
      });
    }
    el.githubLink.addEventListener("click", function (event) {
      event.preventDefault();
      openExternal("https://github.com/haigeplay3d/HGScripts");
    });
    el.folderInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        addSourceFromInput();
      }
    });
    el.folderInput.addEventListener("input", function () {
      var value = normalizeInputPath(el.folderInput.value);
      if (value && !el.sourceNameInput.value.trim()) {
        el.sourceNameInput.value = inferSourceName(value);
      }
    });
    el.ignoredDirsInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        saveSettingsFromForm();
      }
    });
    if (el.sourceList) {
      el.sourceList.addEventListener("click", function (event) {
        var button = event.target;
        while (button && button !== el.sourceList && !(button.getAttribute && button.getAttribute("data-source-id"))) {
          button = button.parentNode;
        }
        if (!button || button === el.sourceList) {
          return;
        }
        var sourceId = button.getAttribute("data-source-id");
        if (!sourceId) {
          return;
        }
        state.activeSourceId = sourceId;
        saveSources();
        renderSources();
        render();
      });
    }
    if (el.recentSourceSelect) {
      el.recentSourceSelect.addEventListener("change", function () {
        if (el.recentSourceSelect.value) {
          el.folderInput.value = el.recentSourceSelect.value;
          el.sourceNameInput.value = inferSourceName(el.recentSourceSelect.value);
        }
      });
    }
    bindSearchInput();
    bindCommandCenterEvents();
    bindSortMenu();
    if (el.favoriteOnlyInput) {
      el.favoriteOnlyInput.addEventListener("change", render);
    }
    if (el.sortSelect) {
      el.sortSelect.addEventListener("change", function () {
        renderSortControl();
        render();
      });
    }
    if (el.cppModeSelect) {
      el.cppModeSelect.addEventListener("change", function () {
        state.cppMode = normalizeCppMode(el.cppModeSelect.value);
        setStoredValue(CPP_MODE_KEY, state.cppMode);
        renderCppMode();
        render();
        setToast("运行模式: " + getCppModeHint(state.cppMode), "ok");
      });
    }

    if (el.favoriteBtn) {
      el.favoriteBtn.addEventListener("click", toggleFavorite);
    }
    el.renameBtn.addEventListener("click", renameSelected);
    el.detailDoc.addEventListener("input", function () {
      if (state.docLoading || el.detailDoc.disabled || !state.selectedPath) {
        return;
      }
      state.docDirty = true;
      state.docPath = state.selectedPath;
    });
    el.saveDocBtn.addEventListener("click", saveSelectedDoc);
    el.runBtn.addEventListener("click", runSelected);
    el.openBtn.addEventListener("click", function () {
      if (state.selectedPath) {
        openExternal(state.selectedPath);
      }
    });
    el.revealBtn.addEventListener("click", function () {
      if (state.selectedPath) {
        childProcess.execFile("explorer.exe", ["/select," + state.selectedPath]);
      }
    });

    el.contextMenu.addEventListener("click", function (event) {
      var button = event.target;
      if (!button || !button.getAttribute) {
        return;
      }
      var action = button.getAttribute("data-action");
      if (!action) {
        return;
      }
      hideContextMenu();
      runContextAction(action);
    });

    document.addEventListener("click", hideContextMenu);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        hideContextMenu();
        closeSourceModal();
        closeCreateModal();
        closeUtilityViews();
        resolvePendingSwitch("cancel");
      }
    });
    window.addEventListener("resize", function () {
      hideContextMenu();
      hideSortMenu();
      syncPanelModeFromWidth();
    });

    el.closeEditorBtn.addEventListener("click", closeCodeEditor);
    el.saveCodeBtn.addEventListener("click", saveCodeEditor);
    el.runCodeBtn.addEventListener("click", runFromEditor);
    el.saveRunCodeBtn.addEventListener("click", function () {
      saveCodeEditor(function (ok) {
        if (ok) {
          runSelected();
        }
      });
    });
    el.reloadCodeBtn.addEventListener("click", function () {
      if (state.editorPath) {
        openCodeEditor(state.editorPath, true);
      }
    });
    el.duplicateCodeBtn.addEventListener("click", duplicateSelectedScript);
    if (el.openDocFolderBtn) {
      el.openDocFolderBtn.addEventListener("click", openCurrentDocumentFolder);
    }
    bindEditorTitleInput();
    el.clearConsoleBtn.addEventListener("click", function () {
      el.consoleOutput.textContent = "控制台已清空。";
    });
    el.copyConsoleBtn.addEventListener("click", copyConsole);
    el.copyErrorConsoleBtn.addEventListener("click", copyLatestError);
    el.consoleOutput.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.getAttribute && target.getAttribute("data-line")) {
        jumpToLine(parseInt(target.getAttribute("data-line"), 10));
      }
    });
    bindConsoleResizer();
    bindMainSplitter();
  }

  function bindSearchInput() {
    var composing = false;
    function isImeEvent(event) {
      return composing || !!(event && (event.isComposing || event.keyCode === 229));
    }
    el.searchInput.addEventListener("compositionstart", function () {
      composing = true;
    });
    el.searchInput.addEventListener("compositionend", function () {
      composing = false;
      render();
    });
    el.searchInput.addEventListener("input", function (event) {
      if (!isImeEvent(event)) {
        render();
      }
    });
    el.searchInput.addEventListener("keyup", function (event) {
      if (!isImeEvent(event)) {
        render();
      }
    });
    el.searchInput.addEventListener("change", render);
  }

  function bindCommandCenterEvents() {
    if (el.sceneChips) {
      el.sceneChips.addEventListener("click", function (event) {
        var button = event.target;
        while (button && button !== el.sceneChips && !(button.getAttribute && button.getAttribute("data-scene-id"))) {
          button = button.parentNode;
        }
        if (!button || button === el.sceneChips) {
          return;
        }
        var sceneId = button.getAttribute("data-scene-id");
        if (!sceneId) {
          return;
        }
        state.activeSceneId = sceneId;
        render();
      });
    }
    if (el.quickPicks) {
      el.quickPicks.addEventListener("click", function (event) {
        var button = event.target;
        while (button && button !== el.quickPicks && !(button.getAttribute && button.getAttribute("data-script-path"))) {
          button = button.parentNode;
        }
        if (!button || button === el.quickPicks) {
          return;
        }
        var fullPath = button.getAttribute("data-script-path");
        if (fullPath) {
          selectItem(fullPath);
        }
      });
    }
    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "k") {
        event.preventDefault();
        if (el.searchInput) {
          el.searchInput.focus();
          el.searchInput.select();
        }
      }
      if (document.activeElement === el.searchInput && (event.isComposing || event.keyCode === 229)) {
        return;
      }
      if (event.key === "Enter" && document.activeElement === el.searchInput && state.filtered.length) {
        event.preventDefault();
        if (selectItem(state.filtered[0].fullPath)) {
          runSelected();
        }
      }
    });
  }

  function bindSortMenu() {
    if (!el.sortMenuBtn || !el.sortMenu || !el.sortSelect) {
      return;
    }
    renderSortControl();
    el.sortMenuBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      el.sortMenu.classList.toggle("open");
    });
    el.sortMenu.addEventListener("click", function (event) {
      var button = event.target;
      while (button && button !== el.sortMenu && !(button.getAttribute && button.getAttribute("data-sort"))) {
        button = button.parentNode;
      }
      if (!button || button === el.sortMenu) {
        return;
      }
      var mode = button.getAttribute("data-sort");
      if (mode) {
        el.sortSelect.value = mode;
        renderSortControl();
        hideSortMenu();
        render();
      }
    });
    document.addEventListener("click", function () {
      hideSortMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        hideSortMenu();
      }
    });
  }

  function renderSortControl() {
    if (!el.sortMenuBtn || !el.sortMenu || !el.sortSelect) {
      return;
    }
    var label = getSortLabel(el.sortSelect.value);
    el.sortMenuBtn.textContent = label || t("sortTitle");
    el.sortMenuBtn.title = t("sortTitle") + ": " + (label || "");
    var buttons = el.sortMenu.querySelectorAll("button[data-sort]");
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].classList.toggle("active", buttons[j].getAttribute("data-sort") === el.sortSelect.value);
    }
  }

  function hideSortMenu() {
    if (el.sortMenu) {
      el.sortMenu.classList.remove("open");
    }
  }

  function bindEditorTitleInput() {
    el.editorTitleInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        renameFromEditorTitle();
      } else if (event.key === "Escape") {
        event.preventDefault();
        restoreEditorTitleInput();
      }
    });
    el.editorTitleInput.addEventListener("blur", renameFromEditorTitle);
  }

  function initAceEditor() {
    if (!window.ace || !el.aceEditor) {
      setToast("Ace editor failed to load", "warn");
      return;
    }

    el.aceEditor.innerHTML = "";
    window.ace.config.set("basePath", "assets/js/ace");
    state.ace = window.ace.edit(el.aceEditor);
    state.ace.setTheme("ace/theme/tomorrow_night_eighties");
    state.ace.session.setMode("ace/mode/javascript");
    state.ace.session.setUseWorker(false);
    state.ace.setOptions({
      fontSize: "12px",
      showPrintMargin: false,
      tabSize: 4,
      useSoftTabs: true,
      wrap: false
    });
    state.ace.setReadOnly(true);
    state.ace.session.on("change", function () {
      if (state.editorLoading || !state.editorPath) {
        return;
      }
      state.editorDirty = true;
      clearEditorError();
      updateEditorState();
    });
    state.ace.commands.addCommand({
      name: "saveCode",
      bindKey: { win: "Ctrl-S", mac: "Command-S" },
      exec: function () {
        saveCodeEditor();
      }
    });
    state.ace.commands.addCommand({
      name: "runCode",
      bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
      exec: function () {
      runFromEditor();
    }
  });
  }

  function initLegacyTextEditor() {
    if (!el.aceEditor) {
      writeBootLog("legacy text editor skipped: editor host missing");
      return;
    }

    writeBootLog("legacy compat mode enabled; textarea editor initialized");
    el.aceEditor.innerHTML = "";
    var textarea = document.createElement("textarea");
    textarea.className = "legacy-text-editor";
    textarea.spellcheck = false;
    textarea.readOnly = true;
    el.aceEditor.appendChild(textarea);

    state.ace = {
      session: {
        setMode: function () {},
        setUseWorker: function () {},
        on: function (eventName, callback) {
          if (eventName === "change") {
            textarea.addEventListener("input", callback);
          }
        },
        clearAnnotations: function () {
          textarea.removeAttribute("data-error-line");
        },
        removeMarker: function () {},
        setAnnotations: function (annotations) {
          if (annotations && annotations.length && annotations[0].row != null) {
            textarea.setAttribute("data-error-line", String(annotations[0].row + 1));
          }
        },
        addMarker: function () {
          return 1;
        }
      },
      commands: {
        addCommand: function () {}
      },
      setTheme: function () {},
      setOptions: function () {},
      setReadOnly: function (value) {
        textarea.readOnly = !!value;
      },
      setValue: function (value) {
        textarea.value = value || "";
      },
      getValue: function () {
        return textarea.value;
      },
      resize: function () {},
      focus: function () {
        textarea.focus();
      },
      gotoLine: function (lineNumber) {
        var lines = textarea.value.split(/\r\n|\r|\n/);
        var target = Math.max(1, parseInt(lineNumber, 10) || 1);
        var pos = 0;
        for (var i = 0; i < target - 1 && i < lines.length; i++) {
          pos += lines[i].length + 1;
        }
        try {
          textarea.focus();
          textarea.setSelectionRange(pos, pos);
        } catch (err) {}
      }
    };

    state.ace.session.on("change", function () {
      if (state.editorLoading || !state.editorPath) {
        return;
      }
      state.editorDirty = true;
      updateEditorState();
    });
  }

  function loadScriptOnce(src, callback) {
    var existing = document.querySelector("script[data-dynamic-src='" + src + "']");
    if (existing && existing.getAttribute("data-loaded") === "1") {
      callback(true);
      return;
    }

    var script = existing || document.createElement("script");
    script.setAttribute("data-dynamic-src", src);
    script.onload = function () {
      script.setAttribute("data-loaded", "1");
      callback(true);
    };
    script.onerror = function () {
      callback(false);
    };
    if (!existing) {
      script.src = src;
      document.body.appendChild(script);
    }
  }

  function tryUpgradeLegacyAceEditor() {
    if (!LEGACY_COMPAT_MODE) {
      return;
    }
    writeBootLog("legacy Ace lazy load begin");
    loadScriptOnce("assets/js/ace/ace.js", function (okAce) {
      if (!okAce || !window.ace) {
        writeBootLog("legacy Ace lazy load failed: ace.js");
        appendConsole("旧版模式: Ace 加载失败，继续使用兼容编辑器。");
        return;
      }
      loadScriptOnce("assets/js/ace/mode-javascript.js", function (okMode) {
        loadScriptOnce("assets/js/ace/theme-tomorrow_night_eighties.js", function (okTheme) {
          try {
            state.ace = null;
            initAceEditor();
            if (state.editorPath) {
              state.editorLoading = true;
              state.ace.setValue(fs.readFileSync(state.editorPath, "utf8"), -1);
              state.ace.setReadOnly(false);
              state.editorLoading = false;
            }
            writeBootLog("legacy Ace lazy load done: mode=" + okMode + ", theme=" + okTheme);
            appendConsole("旧版模式: Ace 编辑器已延迟加载。");
          } catch (errAce) {
            writeBootLog("legacy Ace init failed: " + (errAce && errAce.stack ? errAce.stack : errAce));
            appendConsole("旧版模式: Ace 初始化失败，继续使用兼容编辑器。");
            initLegacyTextEditor();
          }
        });
      });
    });
  }

  function loadSources() {
    var saved = loadJson(SOURCES_KEY, null);
    if (saved && saved.length) {
      return normalizeSources(saved);
    }

    return [{
      id: makeId(),
      name: "\u9ED8\u8BA4\u811A\u672C",
      folder: DEFAULT_FOLDER,
      enabled: true
    }];
  }

  function normalizeSources(sources) {
    var result = [];
    for (var i = 0; i < sources.length; i++) {
      if (!sources[i] || !sources[i].folder) {
        continue;
      }
      result.push({
        id: sources[i].id || makeId(),
        name: isDefaultSource(sources[i]) ? "\u9ED8\u8BA4\u811A\u672C" : (sources[i].name || inferSourceName(sources[i].folder)),
        folder: normalizeDefaultSourceFolder(sources[i]),
        enabled: sources[i].enabled !== false
      });
    }
    return result.length ? result : [{
      id: makeId(),
      name: "\u9ED8\u8BA4\u811A\u672C",
      folder: DEFAULT_FOLDER,
      enabled: true
    }];
  }

  function normalizeDefaultSourceFolder(source) {
    var folder = source.folder;
    if (isDefaultSource(source)) {
      return DEFAULT_FOLDER;
    }
    return folder;
  }

  function isDefaultSource(source) {
    if (!source) {
      return false;
    }
    var folder = normalizeFsPath(source.folder || "");
    return source.name === "\u9ED8\u8BA4\u811A\u672C" ||
      source.id === "src_1777185389413_60603" ||
      samePath(folder, DEFAULT_FOLDER) ||
      samePath(folder, LEGACY_FLAT_USER_SCRIPTS_FOLDER) ||
      samePath(folder, EXTERNAL_DEFAULT_FOLDER);
  }

  function migrateDefaultSource() {
    var changed = false;
    for (var i = 0; i < state.sources.length; i++) {
      if (state.sources[i].name === "\u9ED8\u8BA4\u811A\u672C" && makeFileKey(state.sources[i].folder) !== makeFileKey(DEFAULT_FOLDER)) {
        state.sources[i].folder = DEFAULT_FOLDER;
        changed = true;
      }
    }
    if (changed) {
      saveSources();
    }
  }

  function migrateFlatUserScriptsToIllustrator() {
    if (HOST_PROFILE.key !== "illustrator") {
      return;
    }
    try {
      if (!fs.existsSync(LEGACY_FLAT_USER_SCRIPTS_FOLDER)) {
        return;
      }
      ensureFolder(DEFAULT_FOLDER);
      var names = fs.readdirSync(LEGACY_FLAT_USER_SCRIPTS_FOLDER);
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (name === "illustrator" || name === "photoshop" || name === "indesign") {
          continue;
        }
        var fromPath = path.join(LEGACY_FLAT_USER_SCRIPTS_FOLDER, name);
        var toPath = path.join(DEFAULT_FOLDER, name);
        if (!fs.existsSync(toPath)) {
          fs.renameSync(fromPath, toPath);
        }
      }
    } catch (err) {
      setToast("\u65E7\u811A\u672C\u76EE\u5F55\u8FC1\u79FB\u5931\u8D25: " + err.message, "warn");
    }
  }

  function saveSources() {
    setStoredValue(SOURCES_KEY, state.sources);
    setStoredValue(ACTIVE_SOURCE_KEY, state.activeSourceId);
  }

  function ensureActiveSource() {
    if (state.activeSourceId === "all" || state.activeSourceId === "favorites" || findSource(state.activeSourceId)) {
      return;
    }
    state.activeSourceId = "all";
  }

  function renderSources() {
    var activeSource = getActiveSource();
    var defaultSource = getDefaultSource() || state.sources[0];
    el.sourceTabs.innerHTML = "";
    addSourceTab("all", "\u5168\u90E8", state.activeSourceId === "all");

    for (var i = 0; i < state.sources.length; i++) {
      if (defaultSource && state.sources[i].id === defaultSource.id) {
        continue;
      }
      addSourceTab(state.sources[i].id, state.sources[i].name, state.sources[i].id === state.activeSourceId);
    }

    if (el.favoritesFilterBtn) {
      el.favoritesFilterBtn.classList.toggle("active", state.activeSourceId === "favorites");
    }
    if (el.defaultSourceBtn) {
      el.defaultSourceBtn.classList.toggle("active", !!defaultSource && state.activeSourceId === defaultSource.id);
      el.defaultSourceBtn.disabled = !defaultSource;
      el.defaultSourceBtn.title = defaultSource ? "\u5207\u6362\u5230: " + defaultSource.name : "\u6CA1\u6709\u53EF\u7528\u7684\u9ED8\u8BA4\u76EE\u5F55";
    }

    if (activeSource) {
      el.sourceNameInput.value = activeSource.name;
      el.folderInput.value = activeSource.folder;
      el.saveSourceBtn.disabled = false;
      el.removeSourceBtn.disabled = state.sources.length <= 1;
    } else {
      el.sourceNameInput.value = "";
      el.folderInput.value = "";
      el.saveSourceBtn.disabled = true;
      el.removeSourceBtn.disabled = true;
    }
    renderSourceList(defaultSource);
  }

  function openSourceModal() {
    if (!getActiveSource()) {
      var defaultSource = getDefaultSource() || state.sources[0];
      if (defaultSource) {
        state.activeSourceId = defaultSource.id;
        saveSources();
        render();
      }
    }
    renderSources();
    el.sourceModal.classList.add("open");
    el.folderInput.focus();
  }

  function closeSourceModal() {
    el.sourceModal.classList.remove("open");
  }

  function openCreateModal(defaultName, defaultSubdir) {
    el.newScriptNameInput.value = defaultName || uniqueScriptBase((getActiveSource() || getDefaultSource() || state.sources[0]).folder, "\u65B0\u5EFA\u811A\u672C");
    el.newScriptDocInput.checked = true;
    el.createModal.classList.add("open");
    el.newScriptNameInput.focus();
    el.newScriptNameInput.select();
  }

  function closeCreateModal() {
    el.createModal.classList.remove("open");
  }

  function openSettingsView() {
    renderSettings();
    closeUtilityViews();
    el.shell.classList.add("settings-view-open");
    el.languageSelect.focus();
  }

  function openAboutView() {
    closeUtilityViews();
    if (el.aboutVersion) {
      el.aboutVersion.textContent = "v" + state.appVersion;
    }
    el.shell.classList.add("about-view-open");
  }

  function closeUtilityViews() {
    if (!el.shell) {
      return;
    }
    el.shell.classList.remove("settings-view-open");
    el.shell.classList.remove("about-view-open");
  }

  function renderRecentSources() {
    if (!el.recentSourceSelect) {
      return;
    }
    var recent = loadJson(RECENT_SOURCES_KEY, []);
    el.recentSourceSelect.innerHTML = "<option value=\"\">\u6700\u8FD1\u76EE\u5F55</option>";
    for (var i = 0; i < recent.length; i++) {
      var option = document.createElement("option");
      option.value = recent[i];
      option.textContent = inferSourceName(recent[i]) + " - " + recent[i];
      el.recentSourceSelect.appendChild(option);
    }
  }

  function renderSourceList(defaultSource) {
    if (!el.sourceList) {
      return;
    }
    el.sourceList.innerHTML = "";
    if (!state.sources.length) {
      var empty = document.createElement("div");
      empty.className = "source-list-empty";
      empty.textContent = "\u8FD8\u6CA1\u6709\u6DFB\u52A0\u811A\u672C\u76EE\u5F55";
      el.sourceList.appendChild(empty);
      return;
    }

    var counts = countScriptsBySource();
    for (var i = 0; i < state.sources.length; i++) {
      var source = state.sources[i];
      var exists = source.folder && fs.existsSync(source.folder);
      var isActive = state.activeSourceId === source.id;
      var isDefault = defaultSource && defaultSource.id === source.id;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "source-list-item" + (isActive ? " active" : "") + (!exists ? " missing" : "");
      button.setAttribute("data-source-id", source.id);
      button.title = source.folder || "";

      var head = document.createElement("span");
      head.className = "source-list-head";

      var name = document.createElement("span");
      name.className = "source-list-name";
      name.textContent = source.name || inferSourceName(source.folder);
      head.appendChild(name);

      if (isActive) {
        head.appendChild(makeSourceBadge("\u5F53\u524D"));
      }
      if (isDefault) {
        head.appendChild(makeSourceBadge("\u9ED8\u8BA4"));
      }
      if (!exists) {
        head.appendChild(makeSourceBadge("\u627E\u4E0D\u5230"));
      }

      var meta = document.createElement("span");
      meta.className = "source-list-meta";
      meta.textContent = String(counts[source.id] || 0) + " \u4E2A\u811A\u672C";
      head.appendChild(meta);

      var pathText = document.createElement("span");
      pathText.className = "source-list-path";
      pathText.textContent = source.folder || "";

      button.appendChild(head);
      button.appendChild(pathText);
      el.sourceList.appendChild(button);
    }
  }

  function makeSourceBadge(text) {
    var badge = document.createElement("span");
    badge.className = "source-list-badge";
    badge.textContent = text;
    return badge;
  }

  function countScriptsBySource() {
    var counts = {};
    for (var i = 0; i < state.files.length; i++) {
      var sourceId = state.files[i].sourceId;
      counts[sourceId] = (counts[sourceId] || 0) + 1;
    }
    return counts;
  }

  function renderSettings() {
    settings.scanDepth = normalizeScanDepth(settings.scanDepth, DEFAULT_SETTINGS.scanDepth);
    el.scanDepthInput.value = String(settings.scanDepth);
    el.ignoredDirsInput.value = (settings.ignoredDirs || []).join(",");
    el.languageSelect.value = normalizeLanguageMode(settings.languageMode);
    if (el.uiZoomSelect) {
      el.uiZoomSelect.value = normalizeUiZoom(getStoredValue(UI_ZOOM_KEY, "1"));
    }
    renderLanguageHint();
  }

  function saveSettingsFromForm() {
    settings.scanDepth = normalizeScanDepth(el.scanDepthInput.value, DEFAULT_SETTINGS.scanDepth);
    settings.ignoredDirs = parseIgnoredDirs(el.ignoredDirsInput.value);
    saveSettings();
    refresh("设置已保存");
    startWatchers();
  }

  function saveLanguageFromForm() {
    settings.languageMode = normalizeLanguageMode(el.languageSelect.value);
    effectiveLanguage = resolveEffectiveLanguage(settings.languageMode, hostLanguage);
    saveSettings();
    applyLanguageMode(true);
  }

  function applyLanguageMode(showNotice) {
    settings.languageMode = normalizeLanguageMode(settings.languageMode);
    effectiveLanguage = resolveEffectiveLanguage(settings.languageMode, hostLanguage);
    if (el.languageSelect) {
      el.languageSelect.value = settings.languageMode;
    }
    translateStaticUi();
    renderLanguageHint();
    renderCppMode();
    renderSources();
    refresh(t("languageRefreshReason"));
    if (showNotice) {
      setToast(t("languageSaved") + (effectiveLanguage === "zh-CN" ? t("chinese") : "English"), "ok");
    }
  }

  function renderLanguageHint() {
    if (!el.languageHint) {
      return;
    }
    var hostText = hostLanguage === "zh-CN" ? t("chinese") : "English";
    var modeText = settings.languageMode === "auto" ? t("auto") : (settings.languageMode === "zh-CN" ? t("chinese") : "English");
    var effectiveText = effectiveLanguage === "zh-CN" ? t("chinese") : "English";
    el.languageHint.textContent = t("languageHintPrefix") + modeText + t("languageHintHost") + hostText + t("languageHintEffective") + effectiveText + t("languageHintSuffix");
  }

  function translateStaticUi() {
    setAttr(el.searchInput, "placeholder", t("searchPlaceholder"));
    setAttr(el.cppModeSelect, "title", t("cppModeTitle"));
    setText(el.refreshBtn, t("refresh"));
    setAttr(el.refreshBtn, "title", t("refreshTitle"));
    setAttr(el.panelSizeBtn, "title", t("panelSizeTitle"));
    setText(el.panelSizeLabel, state.panelMode === "wide" ? t("collapse") : t("expand"));
    setText(el.sortMenuBtn, getSortLabel(getSortMode()));
    setAttr(el.sortMenuBtn, "title", t("sortTitle"));
    setAttr(el.sortMenu, "aria-label", t("sortTitle"));
    syncSortLabels();
    setText(el.favoritesFilterBtn, t("favorites"));
    setAttr(el.favoritesFilterBtn, "title", t("favoritesTitle"));
    setText(el.defaultSourceBtn, t("defaultSource"));
    setAttr(el.defaultSourceBtn, "title", t("defaultSourceTitle"));
    setText(el.quickCreateScriptBtn, t("newScript"));
    setText(el.toggleSourcesBtn, t("addFolder"));
    setAttr(el.toggleSourcesBtn, "title", t("addFolder"));
    setText(el.folderHint, t("folderLoading"));
    setAttr(el.mainSplitter, "title", t("splitterTitle"));
    setText(el.detailTitle, state.selectedPath ? el.detailTitle.textContent : t("selectScript"));
    setText(el.renameBtn, t("rename"));
    setAttr(el.renameBtn, "title", t("renameTitle"));
    setText(el.runBtn, t("run"));
    setText(el.openBtn, t("openExternal"));
    setText(el.revealBtn, t("reveal"));
    setText(queryOne(".doc-toolbar span"), t("docTitle"));
    setText(el.saveDocBtn, t("saveDoc"));
    setAttr(el.saveDocBtn, "title", t("saveDocTitle"));
    if (el.detailDoc && !state.selectedPath) {
      el.detailDoc.value = t("docPlaceholder");
    }
    setText(el.runCodeBtn, t("run"));
    setText(el.closeEditorBtn, t("close"));
    setAttr(el.closeEditorBtn, "title", t("closeEditorTitle"));
    setText(el.saveCodeBtn, t("save"));
    setText(el.saveRunCodeBtn, t("saveRun"));
    setText(el.reloadCodeBtn, t("reload"));
    setText(el.duplicateCodeBtn, t("duplicate"));
    setText(el.editorState, state.editorPath ? el.editorState.textContent : t("noScriptOpen"));
    setAttr(el.consoleResizer, "title", t("consoleResizerTitle"));
    setText(queryOne(".console-toolbar span"), t("console"));
    setText(el.copyConsoleBtn, t("copyAll"));
    setText(el.copyErrorConsoleBtn, t("copyError"));
    setText(el.clearConsoleBtn, t("clear"));
    if (el.consoleOutput && (el.consoleOutput.textContent === "等待运行结果。" || el.consoleOutput.textContent === "Waiting for run results.")) {
      el.consoleOutput.textContent = t("waitingResult");
    }
    setText(queryOne("#settingsView .view-head h2"), t("settings"));
    setText(queryOne("#settingsView .view-head p"), t("settingsSub"));
    setText(el.closeSettingsViewBtn, t("back"));
    setAttr(el.closeSettingsViewBtn, "title", t("backTitle"));
    setText(queryOne(".settings-panel label[for='languageSelect']"), t("language"));
    syncLanguageLabels();
    setText(el.saveLanguageBtn, t("saveLanguage"));
    setText(queryOne("#aboutView .view-head h2"), t("about"));
    setText(el.closeAboutViewBtn, t("back"));
    setAttr(el.closeAboutViewBtn, "title", t("backTitle"));
    syncAboutLabels();
    setText(el.toast, el.toast && (el.toast.textContent === "准备就绪" || el.toast.textContent === "Ready") ? t("ready") : el.toast.textContent);
    if (!state.selectedPath) {
      setText(el.selectedMetaBar, t("noSelection"));
    }
    setText(queryOne(".source-modal .modal-head h2"), t("sourceManager"));
    setText(el.closeSourcesBtn, t("close"));
    setAttr(el.sourceNameInput, "placeholder", t("sourceAlias"));
    setAttr(el.folderInput, "placeholder", t("folderPath"));
    setText(el.addSourceBtn, t("addFolder"));
    setText(el.saveSourceBtn, t("saveChanges"));
    setText(el.removeSourceBtn, t("removeFromList"));
    setAttr(el.ignoredDirsInput, "placeholder", t("ignoredDirs"));
    setText(el.saveSettingsBtn, t("saveSettings"));
    setText(queryOne(".added-sources-title"), t("addedSources"));
    syncScanDepthLabels();
    setText(queryOne(".create-modal .modal-head h2"), t("newScript"));
    setText(el.closeCreateBtn, t("close"));
    setAttr(el.newScriptNameInput, "placeholder", t("newScriptName"));
    syncCreateDocLabel();
    setText(el.createScriptBtn, t("create"));
    setText(el.switchTitle, state.pendingSwitchKind === "doc" ? t("unsavedDoc") : t("unsavedScript"));
    setText(el.switchSaveBtn, t("saveThenSwitch"));
    setText(el.switchDiscardBtn, t("switchDirectly"));
    setText(el.switchCancelBtn, t("cancel"));
    syncContextMenuLabels();
  }

  function addSourceTab(id, label, active) {
    var button = document.createElement("button");
    button.className = "source-tab" + (active ? " active" : "");
    button.textContent = id === "all" ? t("all") : (id === "favorites" ? t("favorites") : label);
    button.title = id === "all" ? (isEnglishUi() ? "Show all script folders" : "显示所有脚本目录") : (id === "favorites" ? t("favoritesTitle") : label);
    button.addEventListener("click", function () {
      state.activeSourceId = id;
      saveSources();
      renderSources();
      render();
    });
    el.sourceTabs.appendChild(button);
  }

  function chooseFolderWithWindowsDialog() {
    try {
      var picked = openWindowsFolderDialog(getDialogStartPath(), "选择脚本文件夹");
      if (picked) {
        setFolderInput(picked);
      }
    } catch (err) {
      setToast("\u6253\u5F00\u76EE\u5F55\u9009\u62E9\u7A97\u53E3\u5931\u8D25: " + err.message, "error");
    }
  }

  function chooseAndAddSourceWithWindowsDialog() {
    try {
      var picked = openWindowsFolderDialog(getDialogStartPath(), "添加脚本目录");
      if (picked) {
        setFolderInput(picked);
        addSourceFromPath(picked);
      }
    } catch (err) {
      setToast("\u6253\u5F00\u76EE\u5F55\u9009\u62E9\u7A97\u53E3\u5931\u8D25: " + err.message, "error");
    }
  }

  function chooseScriptWithWindowsDialog() {
    try {
      var picked = openWindowsFileDialog(getDialogStartPath(), "\u9009\u62E9\u4E00\u4E2A JSX \u811A\u672C", "JSX \u811A\u672C (*.jsx)|*.jsx|\u6240\u6709\u6587\u4EF6 (*.*)|*.*");
      if (picked) {
        setFolderInput(path.dirname(picked));
      }
    } catch (err) {
      setToast("\u6253\u5F00 JSX \u9009\u62E9\u7A97\u53E3\u5931\u8D25: " + err.message, "error");
    }
  }

  function chooseCurrentDocumentFolder() {
    cs.evalScript("HGScripts.getActiveDocumentFolder()", function (resultPath) {
      if (!resultPath || String(resultPath).indexOf("ERROR:") === 0) {
        setToast(resultPath || "\u5F53\u524D\u6587\u6863\u6CA1\u6709\u53EF\u7528\u76EE\u5F55", "warn");
        return;
      }
      setFolderInput(resultPath);
    });
  }

  function setFolderInput(folderPath) {
    var normalized = normalizeInputPath(folderPath);
    el.folderInput.value = normalized;
    el.sourceNameInput.value = inferSourceName(normalized);
    addRecentSource(normalized);
    renderRecentSources();
  }

  function bindDropZone() {
    var stop = function (event) {
      event.preventDefault();
      event.stopPropagation();
    };
    el.dropZone.addEventListener("dragover", function (event) {
      stop(event);
      el.dropZone.classList.add("dragging");
    });
    el.dropZone.addEventListener("dragleave", function (event) {
      stop(event);
      el.dropZone.classList.remove("dragging");
    });
    el.dropZone.addEventListener("drop", function (event) {
      stop(event);
      el.dropZone.classList.remove("dragging");
      var files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length) {
        return;
      }
      for (var i = 0; i < files.length; i++) {
        var droppedPath = files[i].path;
        if (!droppedPath) {
          continue;
        }
        addSourceFromPath(resolveDroppedSourcePath(droppedPath));
      }
    });
  }

  function resolveDroppedSourcePath(droppedPath) {
    try {
      var stat = fs.statSync(droppedPath);
      if (stat.isDirectory()) {
        return droppedPath;
      }
      if (stat.isFile() && SCRIPT_EXTENSIONS[path.extname(droppedPath).toLowerCase()]) {
        return path.dirname(droppedPath);
      }
    } catch (err) {}
    return "";
  }

  function addSourceFromInput() {
    var folder = normalizeInputPath(el.folderInput.value);
    addSourceFromPath(folder);
  }

  function addSourceFromPath(folder) {
    if (!folder) {
      setToast("\u811A\u672C\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A", "warn");
      return;
    }
    if (!fs.existsSync(folder)) {
      setToast("\u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u786E\u8BA4\u8DEF\u5F84", "error");
      return;
    }
    for (var i = 0; i < state.sources.length; i++) {
      if (makeFileKey(state.sources[i].folder) === makeFileKey(folder)) {
        state.activeSourceId = state.sources[i].id;
        setFolderInput(folder);
        saveSources();
        renderSources();
        render();
        setToast("\u76EE\u5F55\u5DF2\u5B58\u5728\uFF0C\u5DF2\u5207\u6362\u5230\u8BE5\u76EE\u5F55\u6E90", "");
        return;
      }
    }

    var source = {
      id: makeId(),
      name: el.sourceNameInput.value.trim() || inferSourceName(folder),
      folder: folder,
      enabled: true
    };
    state.sources.push(source);
    state.activeSourceId = source.id;
    addRecentSource(folder);
    saveSources();
    renderSources();
    refresh("\u6DFB\u52A0\u76EE\u5F55");
    startWatchers();
  }

  function saveActiveSourceFromInput() {
    var source = getActiveSource();
    if (!source) {
      setToast("\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u5177\u4F53\u76EE\u5F55\u6E90", "warn");
      return;
    }

    var folder = normalizeInputPath(el.folderInput.value);
    if (!folder) {
      setToast("\u811A\u672C\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A", "warn");
      return;
    }
    if (!fs.existsSync(folder)) {
      setToast("\u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u786E\u8BA4\u8DEF\u5F84", "error");
      return;
    }
    for (var i = 0; i < state.sources.length; i++) {
      if (state.sources[i].id !== source.id && makeFileKey(state.sources[i].folder) === makeFileKey(folder)) {
        setToast("\u8FD9\u4E2A\u76EE\u5F55\u5DF2\u5728\u5217\u8868\u91CC\uFF0C\u4E0D\u9700\u8981\u91CD\u590D\u4FDD\u5B58", "warn");
        return;
      }
    }
    source.name = el.sourceNameInput.value.trim() || inferSourceName(folder);
    source.folder = folder;
    addRecentSource(folder);
    saveSources();
    renderSources();
    refresh("目录已保存");
    startWatchers();
  }

  function removeActiveSource() {
    var source = getActiveSource();
    if (!source || state.sources.length <= 1) {
      setToast("至少保留一个脚本目录", "warn");
      return;
    }

    if (!window.confirm("从列表移除目录「" + source.name + "」？脚本文件仍保留在电脑里。")) {
      return;
    }

    for (var i = state.sources.length - 1; i >= 0; i--) {
      if (state.sources[i].id === source.id) {
        state.sources.splice(i, 1);
        break;
      }
    }
    state.activeSourceId = (getDefaultSource() || state.sources[0] || {}).id || "all";
    state.selectedPath = "";
    saveSources();
    renderSources();
    refresh("\u79FB\u9664\u76EE\u5F55");
    startWatchers();
  }

  function createNewScript() {
    var source = getActiveSource();
    if (!source) {
      source = getDefaultSource() || state.sources[0];
    }

    var base = sanitizeBaseName(el.newScriptNameInput.value);
    if (!base) {
      setToast("\u65B0\u811A\u672C\u540D\u4E0D\u80FD\u4E3A\u7A7A", "warn");
      el.newScriptNameInput.focus();
      return;
    }

    var targetFolder = source.folder;
    var scriptPath = path.join(targetFolder, base + ".jsx");
    var docPath = path.join(targetFolder, base + ".md");
    var enDocPath = path.join(targetFolder, base + ".en.md");

    if (fs.existsSync(scriptPath)) {
      setToast("\u5DF2\u5B58\u5728\u540C\u540D JSX\uFF0C\u65B0\u5EFA\u5DF2\u53D6\u6D88", "error");
      return;
    }

    try {
      ensureFolder(targetFolder);
      fs.writeFileSync(scriptPath, getNewScriptTemplate(base), "utf8");
      if (el.newScriptDocInput.checked && !fs.existsSync(docPath)) {
        fs.writeFileSync(docPath, getDefaultDocTemplate({ base: base }), "utf8");
        if (isEnglishUi() && !fs.existsSync(enDocPath)) {
          fs.writeFileSync(enDocPath, getDefaultDocTemplate({ base: base, english: true }), "utf8");
        }
      }
      el.newScriptNameInput.value = "";
      closeCreateModal();
      setToast("\u5DF2\u65B0\u5EFA\u811A\u672C: " + base + ".jsx", "ok");
      refresh("\u65B0\u5EFA\u811A\u672C");
      selectItem(scriptPath);
      openCodeEditor(scriptPath);
    } catch (err) {
      setToast("\u65B0\u5EFA\u811A\u672C\u5931\u8D25: " + err.message, "error");
    }
  }

  function quickCreateScript() {
    var source = getActiveSource() || getDefaultSource() || state.sources[0];
    if (!source) {
      setToast("没有可用目录源", "warn");
      return;
    }
    openCreateModal(uniqueScriptBase(source.folder, "\u65B0\u5EFA\u811A\u672C"), "");
  }

  function uniqueScriptBase(folder, base) {
    var candidate = sanitizeBaseName(base) || "\u65B0\u5EFA\u811A\u672C";
    var index = 1;
    var next = candidate;
    while (fs.existsSync(path.join(folder, next + ".jsx"))) {
      index++;
      next = candidate + index;
    }
    return next;
  }

  function ensureFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  }

  function sanitizeRelativeFolder(value) {
    var text = normalizeInputPath(value).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!text) {
      return "";
    }
    var parts = text.split("/");
    var safe = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim().replace(/[\\/:*?"<>|]/g, "");
      if (part && part !== "." && part !== "..") {
        safe.push(part);
      }
    }
    return safe.join(path.sep);
  }

  function getNewScriptTemplate(name) {
    var emptyDocMessage = isEnglishUi() ? "Please open an Illustrator document first" : "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A Illustrator \u6587\u6863";
    return "#target illustrator\n\n" +
      "function main() {\n" +
      "    if (app.documents.length === 0) {\n" +
      "        alert(\"" + emptyDocMessage + "\");\n" +
      "        return;\n" +
      "    }\n\n" +
      "    var doc = app.activeDocument;\n" +
      "}\n\n" +
      "main();\n";
  }

  function addRecentSource(folder) {
    var normalized = normalizeInputPath(folder);
    if (!normalized) {
      return;
    }
    var recent = loadJson(RECENT_SOURCES_KEY, []);
    var next = [normalized];
    for (var i = 0; i < recent.length; i++) {
      if (makeFileKey(recent[i]) !== makeFileKey(normalized)) {
        next.push(recent[i]);
      }
      if (next.length >= 8) {
        break;
      }
    }
    setStoredValue(RECENT_SOURCES_KEY, next);
  }

  function refresh(reason) {
    var previous = loadPreviousState();
    state.scriptIcons = loadScriptIcons();
    var result = scanSources();
    state.files = result.files;
    state.lastSignature = result.signature;
    saveCurrentState(result.snapshot);
    render();
    updateChangeStatus(previous, result.snapshot, reason);
  }

  function scanSources() {
    var files = [];
    var snapshot = {};
    var existingCount = 0;
    var missing = [];

    for (var i = 0; i < state.sources.length; i++) {
      var source = state.sources[i];
      if (source.enabled === false) {
        continue;
      }
      if (!fs.existsSync(source.folder)) {
        missing.push(source.name);
        continue;
      }
      existingCount++;
      scanFolder(source, files, snapshot);
    }

    if (!existingCount) {
      el.folderHint.textContent = HOST_PROFILE.label + " / 没有可读取的脚本目录";
      setToast("目录不存在，请重新选择", "error");
    } else {
      el.folderHint.textContent = HOST_PROFILE.label + " / " + state.sources.length + " 个目录源，" + files.length + " 个脚本" +
        (missing.length ? "，失效 " + missing.length + " 个" : "");
    }

    files.sort(compareByMtimeDesc);
    return {
      files: files,
      snapshot: snapshot,
      signature: JSON.stringify(snapshot)
    };
  }

  function buildSnapshotFromFiles(files) {
    var snapshot = {};
    for (var i = 0; i < files.length; i++) {
      snapshot[files[i].key] = {
        name: files[i].name,
        sourceName: files[i].sourceName,
        mtimeMs: files[i].mtimeMs,
        size: files[i].size
      };
    }
    return snapshot;
  }

  function scanFolder(source, files, snapshot) {
    scanDirectory(source, source.folder, 0, files, snapshot);
  }

  function scanDirectory(source, folder, depth, files, snapshot) {
    var names;
    try {
      names = fs.readdirSync(folder);
    } catch (err) {
      return;
    }

    names.forEach(function (name) {
      var fullPath = path.join(folder, name);
      var stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (errStat) {
        return;
      }

      if (stat.isDirectory()) {
        if (depth < settings.scanDepth && !isIgnoredFolder(name)) {
          scanDirectory(source, fullPath, depth + 1, files, snapshot);
        }
        return;
      }

      var rawExt = path.extname(name);
      var ext = rawExt.toLowerCase();
      if (!stat.isFile() || !SCRIPT_EXTENSIONS[ext]) {
        return;
      }

      var base = name.slice(0, name.length - rawExt.length);
      var scriptFolder = path.dirname(fullPath);
      var relativePath = path.relative(source.folder, fullPath);
      var relativeDir = path.dirname(relativePath);
      if (relativeDir === ".") {
        relativeDir = "";
      }
      var docPaths = getDocPaths(scriptFolder, base);
      var docPath = docPaths.active;
      var doc = "";
      var hasZhDoc = fs.existsSync(docPaths.zh);
      var hasEnDoc = fs.existsSync(docPaths.en);
      var hasDoc = fs.existsSync(docPath) || hasZhDoc || hasEnDoc;
      var scriptMeta = readScriptMeta(fullPath);

      if (fs.existsSync(docPath)) {
        try {
          doc = fs.readFileSync(docPath, "utf8");
        } catch (errDoc) {
          doc = (isEnglishUi() ? "Failed to read guide: " : "\u8BF4\u660E\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25: ") + errDoc.message;
        }
      }
      var item = {
        sourceId: source.id,
        sourceName: source.name,
        sourceFolder: source.folder,
        scriptFolder: scriptFolder,
        relativePath: relativePath,
        relativeDir: relativeDir,
        name: name,
        base: base,
        ext: ext,
        fullPath: fullPath,
        docPath: docPath,
        zhDocPath: docPaths.zh,
        enDocPath: docPaths.en,
        hasZhDoc: hasZhDoc,
        hasEnDoc: hasEnDoc,
        hasDoc: hasDoc,
        doc: doc,
        badges: scriptMeta.badges,
        cppPlugins: scriptMeta.cppPlugins,
        cppCommands: scriptMeta.cppCommands,
        mtimeMs: stat.mtime.getTime(),
        mtimeText: formatTime(stat.mtime),
        size: stat.size,
        key: makeFileKey(fullPath)
      };

      files.push(item);
      snapshot[item.key] = {
        name: item.name,
        sourceName: item.sourceName,
        mtimeMs: item.mtimeMs,
        size: item.size
      };
    });
  }

  function isIgnoredFolder(name) {
    var lower = String(name || "").toLowerCase();
    var ignored = settings.ignoredDirs || DEFAULT_SETTINGS.ignoredDirs;
    for (var i = 0; i < ignored.length; i++) {
      if (lower === String(ignored[i]).toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  function render() {
    var query = el.searchInput.value.trim().toLowerCase();
    var activeSourceId = state.activeSourceId;
    var list = state.files.filter(function (item) {
      if (!passesSourceFilter(item, activeSourceId)) {
        return false;
      }
      if (el.favoriteOnlyInput && el.favoriteOnlyInput.checked && !state.favorites[item.key]) {
        return false;
      }
      if (!passesSceneFilter(item, state.activeSceneId)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return getSearchScore(item, query) > 0;
    });

    if (query) {
      sortSearchList(list, query);
    } else {
      sortList(list);
    }
    state.filtered = list;
    setIdleStatus(list.length + " / " + state.files.length + (isEnglishUi() ? " scripts" : " 个脚本"));
    renderSourceList(getDefaultSource() || state.sources[0]);
    renderCommandCenter(activeSourceId, query);
    el.scriptList.innerHTML = "";
    el.scriptList.classList.toggle("has-running", !!state.running);

    list.forEach(function (item, index) {
      var row = document.createElement("div");
      var isRunningItem = state.running && state.runningPath && makeFileKey(item.fullPath) === makeFileKey(state.runningPath);
      row.className = "script-item" +
        (item.fullPath === state.selectedPath ? " active" : "") +
        (isRunningItem ? " running-item" : "") +
        (state.running && !isRunningItem ? " running-dim" : "");
      row.title = item.fullPath;
      row.innerHTML =
        "<div class=\"script-index\"></div>" +
        "<span class=\"script-icon-wrap\"><img class=\"script-icon\" alt=\"\" draggable=\"false\"></span>" +
        "<div class=\"script-main\">" +
          "<div class=\"script-title\"></div>" +
        "</div>" +
        "<div class=\"script-tags\"></div>";
      row.querySelector(".script-index").textContent = index + 1;
      row.querySelector(".script-title").textContent = getScriptDisplayName(item);
      var icon = row.querySelector(".script-icon");
      if (LEGACY_COMPAT_MODE) {
        renderLegacyInlineScriptIcon(icon);
      } else {
        icon.src = getScriptIconSrc(item);
        icon.addEventListener("error", function () {
          if (this.getAttribute("data-fallback-used") === "1") {
            this.style.display = "none";
            return;
          }
          this.setAttribute("data-fallback-used", "1");
          this.src = DEFAULT_SCRIPT_ICON;
        });
      }
      if (shouldShowScriptBoostBadge(item)) {
        row.className += " script-accelerated";
        var iconWrap = row.querySelector(".script-icon-wrap");
        var boost = document.createElement("span");
        boost.className = "script-boost-badge boost-" + normalizeCppMode(state.cppMode);
        boost.textContent = "\u26A1";
        boost.title = getCppBoostBadgeTitle();
        iconWrap.appendChild(boost);
      }
      var tags = row.querySelector(".script-tags");
      if (item.hasDoc) {
        var docButton = document.createElement("button");
        docButton.className = "doc-icon-btn";
        docButton.title = t("editDoc");
        docButton.innerHTML = "<img class=\"doc-icon-img\" src=\"" + DOC_ICON_SRC + "\" alt=\"\" aria-hidden=\"true\">";
        docButton.addEventListener("click", function (event) {
          event.stopPropagation();
          if (selectItem(item.fullPath)) {
            editSelectedDoc(item);
          }
        });
        tags.appendChild(docButton);
      }
      var star = document.createElement("button");
      var favorited = !!state.favorites[item.key];
      star.className = "star" + (favorited ? " favorited" : "");
      star.title = favorited ? "取消收藏" : "收藏脚本";
      star.innerHTML = "<img alt=\"\" draggable=\"false\">";
      star.querySelector("img").src = favorited ? STAR_FILLED_ICON_SRC : STAR_OUTLINE_ICON_SRC;
      star.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleFavoriteByPath(item.fullPath);
      });
      tags.appendChild(star);
      row.addEventListener("click", function () {
        hideContextMenu();
        selectItem(item.fullPath);
      });
      row.addEventListener("dblclick", function () {
        if (selectItem(item.fullPath)) {
          runSelected();
        }
      });
      row.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        if (selectItem(item.fullPath)) {
          showContextMenu(event.clientX, event.clientY, item);
        }
      });
      el.scriptList.appendChild(row);
    });

    if (state.selectedPath) {
      var stillExists = findByPath(state.selectedPath);
      if (stillExists) {
        showDetail(stillExists);
      } else {
        clearDetail("脚本已被移动或删除");
      }
    } else {
      clearDetail();
    }
  }

  function sortList(list) {
    var mode = getSortMode();
    if (mode === "nameAsc") {
      list.sort(function (a, b) { return getScriptDisplayName(a).localeCompare(getScriptDisplayName(b), isEnglishUi() ? "en-US" : "zh-Hans-CN"); });
    } else if (mode === "nameDesc") {
      list.sort(function (a, b) { return getScriptDisplayName(b).localeCompare(getScriptDisplayName(a), isEnglishUi() ? "en-US" : "zh-Hans-CN"); });
    } else if (mode === "initialAsc") {
      list.sort(function (a, b) { return compareByInitial(a, b); });
    } else if (mode === "initialDesc") {
      list.sort(function (a, b) { return compareByInitial(b, a); });
    } else if (mode === "lastRunDesc") {
      list.sort(function (a, b) {
        return compareByRecentRun(a, b);
      });
    } else {
      list.sort(compareByMtimeDesc);
    }
  }

  function sortSearchList(list, query) {
    list.sort(function (a, b) {
      var scoreDelta = getSearchScore(b, query) - getSearchScore(a, query);
      if (scoreDelta) {
        return scoreDelta;
      }
      return compareByRecentRun(a, b);
    });
  }

  function getSortMode() {
    return el.sortSelect ? el.sortSelect.value : "lastRunDesc";
  }

  function passesSourceFilter(item, activeSourceId) {
    if (activeSourceId === "favorites" && !state.favorites[item.key]) {
      return false;
    }
    if (activeSourceId !== "all" && activeSourceId !== "favorites" && item.sourceId !== activeSourceId) {
      return false;
    }
    return true;
  }

  function passesSceneFilter(item, sceneId) {
    if (!sceneId || sceneId === "all") {
      return true;
    }
    if (sceneId === "favorites") {
      return !!state.favorites[item.key];
    }
    if (sceneId === "recent") {
      return getRunStat(item.key).lastRun > 0;
    }
    return getItemSceneId(item) === sceneId;
  }

  function renderCommandCenter(activeSourceId, query) {
    if (!el.commandCenter || !el.sceneChips || !el.quickPicks) {
      return;
    }
    var scoped = state.files.filter(function (item) {
      return passesSourceFilter(item, activeSourceId);
    });
    renderSceneChips(scoped);
    renderQuickPicks(scoped, query);
  }

  function renderSceneChips(scoped) {
    var counts = {};
    for (var i = 0; i < COMMAND_SCENES.length; i++) {
      counts[COMMAND_SCENES[i].id] = 0;
    }
    counts.all = scoped.length;
    for (var j = 0; j < scoped.length; j++) {
      if (state.favorites[scoped[j].key]) {
        counts.favorites++;
      }
      if (getRunStat(scoped[j].key).lastRun > 0) {
        counts.recent++;
      }
      var sceneId = getItemSceneId(scoped[j]);
      if (sceneId !== "all" && counts.hasOwnProperty(sceneId)) {
        counts[sceneId]++;
      }
    }

    el.sceneChips.innerHTML = "";
    for (var k = 0; k < COMMAND_SCENES.length; k++) {
      var scene = COMMAND_SCENES[k];
      if (scene.id !== "all" && !counts[scene.id]) {
        continue;
      }
      var chip = document.createElement("button");
      chip.className = "scene-chip" + (state.activeSceneId === scene.id ? " active" : "");
      chip.setAttribute("data-scene-id", scene.id);
      chip.title = (isEnglishUi() ? "Filter: " : "筛选: ") + getSceneLabel(scene.id);
      chip.innerHTML = "<span></span><em></em>";
      chip.querySelector("span").textContent = getSceneLabel(scene.id);
      chip.querySelector("em").textContent = counts[scene.id] || 0;
      el.sceneChips.appendChild(chip);
    }
  }

  function renderQuickPicks(scoped, query) {
    var picks = scoped.slice().filter(function (item) {
      return state.favorites[item.key] || getRunStat(item.key).lastRun > 0;
    });
    picks.sort(function (a, b) {
      if (query) {
        return getSearchScore(b, query) - getSearchScore(a, query) || getQuickPickScore(b) - getQuickPickScore(a);
      }
      return getQuickPickScore(b) - getQuickPickScore(a);
    });
    picks = picks.slice(0, 6);
    el.quickPicks.innerHTML = "";
    if (!picks.length) {
      var hint = document.createElement("span");
      hint.className = "quick-empty";
      hint.textContent = isEnglishUi() ? "Run or favorite scripts to show quick entries here" : "运行或收藏脚本后，这里会出现快捷入口";
      el.quickPicks.appendChild(hint);
      return;
    }
    for (var i = 0; i < picks.length; i++) {
      var item = picks[i];
      var stat = getRunStat(item.key);
      var button = document.createElement("button");
      button.className = "quick-pick";
      button.setAttribute("data-script-path", item.fullPath);
      button.title = item.fullPath;
      button.innerHTML = "<strong></strong><span></span>";
      button.querySelector("strong").textContent = getScriptDisplayBase(item);
      button.querySelector("span").textContent = state.favorites[item.key] ? t("favorites") : (stat.count ? (isEnglishUi() ? "Run " + stat.count + " times" : "运行 " + stat.count + " 次") : getSceneLabel(getItemSceneId(item)));
      el.quickPicks.appendChild(button);
    }
  }

  function getQuickPickScore(item) {
    var stat = getRunStat(item.key);
    var favoriteScore = state.favorites[item.key] ? 10000000000000 + getFavoriteTime(item) : 0;
    var runScore = stat.lastRun + stat.count * 100000;
    return favoriteScore + runScore;
  }

  function getSearchScore(item, query) {
    if (!query) {
      return 1;
    }
    var title = String(item.base || item.name || "").toLowerCase();
    var displayTitle = String(getScriptDisplayBase(item) || "").toLowerCase();
    var pathText = String(item.relativePath || "").toLowerCase();
    var sourceText = String(item.sourceName || "").toLowerCase();
    var sceneText = getSceneSearchText(item).toLowerCase();
    var docText = String(item.doc || "").toLowerCase();
    var score = 0;
    if (title === query || displayTitle === query) score += 200;
    if (title.indexOf(query) >= 0) score += 120;
    if (displayTitle.indexOf(query) >= 0) score += 120;
    if (sceneText.indexOf(query) >= 0) score += 80;
    if (pathText.indexOf(query) >= 0) score += 50;
    if (sourceText.indexOf(query) >= 0) score += 30;
    if (docText.indexOf(query) >= 0) score += 20;
    score += getPinyinSearchScore(item, query, title, displayTitle);
    if (state.favorites[item.key]) score += 8;
    if (getRunStat(item.key).lastRun) score += 6;
    return score;
  }

  // 拼音/首字母检索：仅当查询为纯 ASCII 字母数字时启用，避免干扰中文粘贴搜索。
  // 结果按 item 缓存，避免每次按键重复转换。
  function getItemPinyinIndex(item, displayTitle) {
    if (!item._pinyinIndex || item._pinyinIndex.display !== displayTitle) {
      var base = String(item.base || item.name || "");
      item._pinyinIndex = {
        display: displayTitle,
        titleFull: window.HGPinyin.toPinyin(base),
        titleInitials: window.HGPinyin.toInitials(base),
        displayFull: window.HGPinyin.toPinyin(displayTitle),
        displayInitials: window.HGPinyin.toInitials(displayTitle)
      };
    }
    return item._pinyinIndex;
  }

  function getPinyinSearchScore(item, query, title, displayTitle) {
    if (!window.HGPinyin || !/^[a-z0-9]+$/.test(query)) {
      return 0;
    }
    var py = getItemPinyinIndex(item, displayTitle);
    var score = 0;
    if (py.titleInitials === query || py.displayInitials === query) score += 180;
    if (py.titleInitials.indexOf(query) === 0 || py.displayInitials.indexOf(query) === 0) score += 130;
    else if (py.titleInitials.indexOf(query) > 0 || py.displayInitials.indexOf(query) > 0) score += 90;
    if (py.titleFull.indexOf(query) === 0 || py.displayFull.indexOf(query) === 0) score += 110;
    else if (py.titleFull.indexOf(query) > 0 || py.displayFull.indexOf(query) > 0) score += 70;
    return score;
  }

  function getSceneSearchText(item) {
    var scene = getSceneConfig(getItemSceneId(item));
    return scene ? getSceneLabel(scene.id) + " " + scene.label + " " + scene.aliases.join(" ") : "";
  }

  function getItemSceneId(item) {
    var text = [
      item.base,
      item.name,
      item.relativePath,
      item.relativeDir,
      item.sourceName,
      item.doc
    ].join(" ").toLowerCase();
    if (text.indexOf("photoshop") >= 0 || text.indexOf("\\photoshop\\") >= 0 || text.indexOf("/photoshop/") >= 0 ||
        text.indexOf("图层") >= 0 || text.indexOf("蒙版") >= 0 || text.indexOf("剪贴板") >= 0 || text.indexOf("beauty") >= 0) {
      return "photoshop";
    }
    if (text.indexOf("诊断") >= 0 || text.indexOf("记录") >= 0 || text.indexOf("恢复") >= 0 ||
        text.indexOf("实验") >= 0 || text.indexOf("测试") >= 0 || text.indexOf("调试") >= 0) {
      return "diagnostic";
    }
    if (text.indexOf("导出") >= 0 || text.indexOf("输出") >= 0 || text.indexOf("保存") >= 0) {
      return "export";
    }
    if (text.indexOf("画板") >= 0 || text.indexOf("外框") >= 0 || text.indexOf("背景矩形") >= 0) {
      return "artboard";
    }
    if (text.indexOf("对齐") >= 0 || text.indexOf("居中") >= 0 || text.indexOf("基准") >= 0) {
      return "align";
    }
    if (text.indexOf("尺寸") >= 0 || text.indexOf("缩放") >= 0 || text.indexOf("长边") >= 0 ||
        text.indexOf("1024") >= 0 || text.indexOf("小数") >= 0) {
      return "size";
    }
    if (text.indexOf("颜色") >= 0 || text.indexOf("填充") >= 0 || text.indexOf("描边") >= 0 ||
        text.indexOf("转黑") >= 0 || text.indexOf("转白") >= 0 || text.indexOf("同色") >= 0 || text.indexOf("色") >= 0) {
      return "color";
    }
    if (text.indexOf("选择") >= 0 || text.indexOf("选中") >= 0 || text.indexOf("对象") >= 0) {
      return "select";
    }
    return "all";
  }

  function getSceneConfig(sceneId) {
    for (var i = 0; i < COMMAND_SCENES.length; i++) {
      if (COMMAND_SCENES[i].id === sceneId) {
        return COMMAND_SCENES[i];
      }
    }
    return null;
  }

  function getSceneLabel(sceneId) {
    var scene = getSceneConfig(sceneId);
    if (!scene) {
      return isEnglishUi() ? "Script" : "脚本";
    }
    var labels = {
      all: t("all"),
      favorites: t("favorites"),
      recent: isEnglishUi() ? "Recent" : "最近",
      select: isEnglishUi() ? "Select" : "选择",
      color: isEnglishUi() ? "Color" : "颜色",
      size: isEnglishUi() ? "Size" : "尺寸",
      align: isEnglishUi() ? "Align" : "对齐",
      artboard: isEnglishUi() ? "Artboard" : "画板",
      export: isEnglishUi() ? "Export" : "导出",
      diagnostic: isEnglishUi() ? "Diagnostics" : "诊断",
      photoshop: "PS"
    };
    return labels[scene.id] || scene.label;
  }

  function getFavoriteTime(item) {
    var favorite = state.favorites[item.key];
    return favorite && favorite.time ? favorite.time : 0;
  }

  function selectItem(fullPath, options) {
    options = options || {};
    if (!options.force && shouldAskBeforeEditorSwitch(fullPath)) {
      openSwitchModal(fullPath, null, "code");
      return false;
    }
    if (!options.force && shouldAskBeforeDocSwitch(fullPath)) {
      openSwitchModal(fullPath, null, "doc");
      return false;
    }
    state.selectedPath = fullPath;
    var item = findByPath(fullPath);
    if (item) {
      showDetail(item);
      renderListActiveOnly();
      if (shouldFollowSelectionInEditor(fullPath)) {
        openCodeEditor(fullPath, true);
      } else {
        setSelectionToast(item);
      }
      return true;
    }
    return false;
  }

  function setSelectionToast(item) {
    if (!item || state.running) {
      return;
    }
    setToast((isEnglishUi() ? "Selected script: " : "\u5DF2\u9009\u62E9\u811A\u672C: ") + getScriptDisplayName(item), "");
  }

  function renderListActiveOnly() {
    var rows = el.scriptList.querySelectorAll(".script-item");
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle("active", rows[i].title === state.selectedPath);
      var isRunningRow = !!state.running && !!state.runningPath && makeFileKey(rows[i].title) === makeFileKey(state.runningPath);
      rows[i].classList.toggle("running-item", isRunningRow);
      rows[i].classList.toggle("running-dim", !!state.running && !isRunningRow);
    }
    el.scriptList.classList.toggle("has-running", !!state.running);
  }

  function shouldAskBeforeEditorSwitch(fullPath) {
    return isEditorOpen() &&
      state.editorDirty &&
      state.editorPath &&
      fullPath &&
      makeFileKey(state.editorPath) !== makeFileKey(fullPath);
  }

  function shouldAskBeforeDocSwitch(fullPath) {
    return state.docDirty &&
      state.docPath &&
      fullPath &&
      makeFileKey(state.docPath) !== makeFileKey(fullPath);
  }

  function shouldFollowSelectionInEditor(fullPath) {
    return isEditorOpen() &&
      state.editorPath &&
      fullPath &&
      makeFileKey(state.editorPath) !== makeFileKey(fullPath);
  }

  function isEditorOpen() {
    return !!(el.codeEditor && el.codeEditor.classList.contains("open"));
  }

  function openSwitchModal(fullPath, callback, kind) {
    state.pendingSwitchPath = fullPath;
    state.pendingSwitchCallback = callback || null;
    state.pendingSwitchKind = kind === "doc" ? "doc" : "code";
    if (el.switchTitle) {
      el.switchTitle.textContent = state.pendingSwitchKind === "doc" ? "\u5F53\u524D\u8BF4\u660E\u672A\u4FDD\u5B58" : "\u5F53\u524D\u811A\u672C\u672A\u4FDD\u5B58";
    }
    el.switchModal.classList.add("open");
  }

  function closeSwitchModal() {
    el.switchModal.classList.remove("open");
    state.pendingSwitchPath = "";
    state.pendingSwitchCallback = null;
    state.pendingSwitchKind = "code";
  }

  function resolvePendingSwitch(action) {
    var fullPath = state.pendingSwitchPath;
    var callback = state.pendingSwitchCallback;
    if (!fullPath) {
      closeSwitchModal();
      return;
    }
    if (action === "cancel") {
      closeSwitchModal();
      setToast("\u5DF2\u53D6\u6D88\u5207\u6362", "");
      return;
    }
    if (action === "save") {
      var saveFn = state.pendingSwitchKind === "doc" ? saveSelectedDoc : saveCodeEditor;
      saveFn(function (ok) {
        if (ok) {
          closeSwitchModal();
          selectItem(fullPath, { force: true });
          if (callback) {
            callback();
          }
        }
      });
      return;
    }
    if (state.pendingSwitchKind === "doc") {
      state.docDirty = false;
      state.docPath = "";
    }
    closeSwitchModal();
    selectItem(fullPath, { force: true });
    if (callback) {
      callback();
    }
  }

  function updateSelectedMeta(item, runText) {
    if (!el.selectedMetaBar) {
      return;
    }
    if (!item) {
      el.selectedMetaBar.textContent = t("noSelection");
      return;
    }
    var folderText = item.relativeDir ? item.sourceName + " / " + item.relativeDir : item.sourceName;
    el.selectedMetaBar.textContent = folderText + " / " + item.mtimeText + " / " + formatSize(item.size) + (runText || "");
    el.selectedMetaBar.title = item.fullPath;
  }

  function getRunText(item) {
    var stat = getRunStat(item.key);
    return stat.lastRun ? (isEnglishUi() ? " / Last run " + formatTime(new Date(stat.lastRun)) + " / Run " + stat.count + " times" : " / 上次运行 " + formatTime(new Date(stat.lastRun)) + " / 运行 " + stat.count + " 次") : "";
  }

  function showDetail(item) {
    var runText = getRunText(item);
    el.detailTitle.textContent = getScriptDisplayName(item);
    el.detailMeta.textContent = item.fullPath;
    updateSelectedMeta(item, runText);
    el.renameInput.value = item.name;
    el.renameInput.disabled = false;
    el.renameBtn.disabled = false;
    if (el.favoriteBtn) {
      el.favoriteBtn.disabled = false;
      el.favoriteBtn.textContent = state.favorites[item.key] ? "★" : "☆";
    }
    state.docLoading = true;
    if (!(state.docDirty && state.docPath && makeFileKey(state.docPath) === makeFileKey(item.fullPath))) {
      el.detailDoc.value = item.doc || getDefaultDocTemplate(item);
      state.docDirty = false;
    }
    state.docPath = item.fullPath;
    state.docLoading = false;
    el.detailDoc.disabled = false;
    el.saveDocBtn.disabled = false;
    el.runBtn.disabled = false;
    el.openBtn.disabled = false;
    el.revealBtn.disabled = false;
  }

  function clearDetail(message) {
    state.selectedPath = "";
    el.detailTitle.textContent = message || "选择一个脚本";
    el.detailMeta.textContent = "";
    updateSelectedMeta(null);
    el.renameInput.value = "";
    el.renameInput.disabled = true;
    el.renameBtn.disabled = true;
    if (el.favoriteBtn) {
      el.favoriteBtn.disabled = true;
      el.favoriteBtn.textContent = "☆";
    }
    state.docLoading = true;
    el.detailDoc.value = "同名 .md 会显示在这里。";
    state.docLoading = false;
    state.docDirty = false;
    state.docPath = "";
    el.detailDoc.disabled = true;
    el.saveDocBtn.disabled = true;
    el.runBtn.disabled = true;
    el.openBtn.disabled = true;
    el.revealBtn.disabled = true;
  }

  function toggleFavorite() {
    var item = findByPath(state.selectedPath);
    if (!item) {
      return;
    }
    setFavoriteForItem(item);
  }

  function toggleFavoriteByPath(fullPath) {
    state.selectedPath = fullPath;
    var item = findByPath(fullPath);
    if (!item) {
      return;
    }
    setFavoriteForItem(item);
  }

  function setFavoriteForItem(item) {
    if (state.favorites[item.key]) {
      delete state.favorites[item.key];
      setToast((isEnglishUi() ? "Removed from favorites: " : "\u5DF2\u53D6\u6D88\u6536\u85CF: ") + getScriptDisplayName(item), "");
    } else {
      state.favorites[item.key] = {
        name: item.name,
        sourceName: item.sourceName,
        time: Date.now()
      };
      setToast((isEnglishUi() ? "Added to favorites: " : "\u5DF2\u6536\u85CF: ") + getScriptDisplayName(item), "ok");
    }
    setStoredValue(FAVORITES_KEY, state.favorites);
    showDetail(item);
    render();
  }

  function saveSelectedDoc(callback) {
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      if (callback) {
        callback(false);
      }
      return;
    }

    try {
      var savePath = isEnglishUi() ? item.enDocPath : item.zhDocPath;
      fs.writeFileSync(savePath, el.detailDoc.value, "utf8");
      state.docDirty = false;
      state.docPath = item.fullPath;
      setToast((isEnglishUi() ? "Guide saved: " : "\u8BF4\u660E\u5DF2\u4FDD\u5B58: ") + path.basename(savePath), "ok");
      refresh("\u4FDD\u5B58\u8BF4\u660E");
      selectItem(item.fullPath, { force: true });
      if (callback) {
        callback(true);
      }
    } catch (err) {
      setToast((isEnglishUi() ? "Failed to save guide: " : "\u8BF4\u660E\u4FDD\u5B58\u5931\u8D25: ") + err.message, "error");
      if (callback) {
        callback(false);
      }
    }
  }

  function renameSelected() {
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }

    var nextName = sanitizeScriptFileName(el.renameInput.value, item.ext);
    if (!nextName.base) {
      setToast("脚本名不能为空", "warn");
      return;
    }
    if (nextName.name === item.name) {
      setToast("脚本名没有变化", "");
      return;
    }

    var targetFolder = item.scriptFolder || item.sourceFolder;
    var nextScriptPath = path.join(targetFolder, nextName.name);
    var nextDocPath = path.join(targetFolder, nextName.base + ".md");
    var nextEnDocPath = path.join(targetFolder, nextName.base + ".en.md");
    if (fs.existsSync(nextScriptPath)) {
      setToast("已存在同名脚本，重命名已取消", "error");
      return;
    }
    if (item.hasZhDoc && fs.existsSync(nextDocPath)) {
      setToast("\u5DF2\u5B58\u5728\u540C\u540D\u8BF4\u660E\u6587\u4EF6\uFF0C\u91CD\u547D\u540D\u5DF2\u53D6\u6D88", "error");
      return;
    }
    if (item.hasEnDoc && fs.existsSync(nextEnDocPath)) {
      setToast(isEnglishUi() ? "A matching English guide already exists. Rename canceled." : "\u5DF2\u5B58\u5728\u540C\u540D\u82F1\u6587\u8BF4\u660E\u6587\u4EF6\uFF0C\u91CD\u547D\u540D\u5DF2\u53D6\u6D88", "error");
      return;
    }

    try {
      fs.renameSync(item.fullPath, nextScriptPath);
      if (item.hasZhDoc && fs.existsSync(item.zhDocPath)) {
        fs.renameSync(item.zhDocPath, nextDocPath);
      }
      if (item.hasEnDoc && fs.existsSync(item.enDocPath)) {
        fs.renameSync(item.enDocPath, nextEnDocPath);
      } else if (el.detailDoc.value.trim() && el.detailDoc.value !== getDefaultDocTemplate(item)) {
        fs.writeFileSync(isEnglishUi() ? nextEnDocPath : nextDocPath, el.detailDoc.value, "utf8");
      }
      moveMetadata(item.key, makeFileKey(nextScriptPath), nextName.name, item.sourceName);
      state.selectedPath = nextScriptPath;
      if (state.editorPath && makeFileKey(state.editorPath) === item.key) {
        state.editorPath = nextScriptPath;
        el.editorPath.textContent = nextScriptPath;
        el.editorTitleInput.value = nextName.name;
      }
      setToast("\u5DF2\u91CD\u547D\u540D\u4E3A: " + nextName.name, "ok");
      refresh("重命名脚本");
      selectItem(nextScriptPath);
    } catch (err) {
      setToast("\u91CD\u547D\u540D\u5931\u8D25: " + err.message, "error");
    }
  }

  function renameFromEditorTitle() {
    var item = findByPath(state.editorPath || state.selectedPath);
    if (!item || !el.editorTitleInput) {
      return;
    }
    var nextName = sanitizeScriptFileName(el.editorTitleInput.value, item.ext);
    if (!nextName.base || nextName.name === item.name) {
      restoreEditorTitleInput();
      return;
    }
    el.renameInput.value = nextName.name;
    renameSelected();
  }

  function restoreEditorTitleInput() {
    var item = findByPath(state.editorPath || state.selectedPath);
    if (item && el.editorTitleInput) {
      el.editorTitleInput.value = item.name;
    }
  }

  function duplicateSelectedScript() {
    var item = findByPath(state.editorPath || state.selectedPath);
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }

    if (state.editorDirty) {
      if (!window.confirm("\u5F53\u524D\u4EE3\u7801\u5C1A\u672A\u4FDD\u5B58\u3002\u662F\u5426\u5148\u4FDD\u5B58\u518D\u521B\u5EFA\u526F\u672C\uFF1F")) {
        return;
      }
      saveCodeEditor(function (ok) {
        if (ok) {
          duplicateSelectedScript();
        }
      });
      return;
    }

    var folder = item.scriptFolder || item.sourceFolder;
    var nextBase = getCopyBaseName(folder, item.base, item.ext);
    var nextScriptPath = path.join(folder, nextBase + item.ext);
    var nextDocPath = path.join(folder, nextBase + ".md");
    var nextEnDocPath = path.join(folder, nextBase + ".en.md");

    try {
      fs.copyFileSync(item.fullPath, nextScriptPath);
      if (item.hasZhDoc && fs.existsSync(item.zhDocPath)) {
        fs.copyFileSync(item.zhDocPath, nextDocPath);
      }
      if (item.hasEnDoc && fs.existsSync(item.enDocPath)) {
        fs.copyFileSync(item.enDocPath, nextEnDocPath);
      }
      setToast("\u5DF2\u521B\u5EFA\u526F\u672C: " + nextBase + item.ext, "ok");
      refresh("\u521B\u5EFA\u526F\u672C");
      selectItem(nextScriptPath);
      openCodeEditor(nextScriptPath, true);
    } catch (err) {
      setToast("\u521B\u5EFA\u526F\u672C\u5931\u8D25: " + err.message, "error");
    }
  }

  function getCopyBaseName(folder, base, ext) {
    var suffix = "_copy";
    var next = base + suffix;
    var index = 2;
    while (fs.existsSync(path.join(folder, next + ext))) {
      next = base + suffix + index;
      index++;
    }
    return next;
  }

  function renameSelectedWithPrompt() {
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }
    var nextBase = window.prompt("重命名脚本", item.name);
    if (nextBase === null) {
      return;
    }
    el.renameInput.value = nextBase;
    renameSelected();
  }

  function showContextMenu(x, y, item) {
    el.contextMenu.classList.add("open");
    el.contextMenu.style.left = "0px";
    el.contextMenu.style.top = "0px";

    var menuWidth = el.contextMenu.offsetWidth || 180;
    var menuHeight = el.contextMenu.offsetHeight || 240;
    var left = Math.min(x, window.innerWidth - menuWidth - 8);
    var top = Math.min(y, window.innerHeight - menuHeight - 8);

    el.contextMenu.style.left = Math.max(8, left) + "px";
    el.contextMenu.style.top = Math.max(8, top) + "px";
  }

  function hideContextMenu() {
    el.contextMenu.classList.remove("open");
  }

  function moveToRecycleBin(filePath) {
    childProcess.execFileSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "$shell=New-Object -ComObject Shell.Application; $item=Get-Item -LiteralPath " + psString(filePath) + "; $shell.Namespace(10).MoveHere($item.FullName)"
    ], { windowsHide: true });
  }

  function runContextAction(action) {
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }

    if (action === "run") {
      runSelected();
    } else if (action === "internalEdit") {
      editSelectedScript(item);
    } else if (action === "editDoc") {
      editSelectedDoc(item);
    } else if (action === "reveal") {
      childProcess.execFile("explorer.exe", ["/select," + item.fullPath]);
    } else if (action === "delete") {
      deleteSelectedScript();
    }
  }

  function editSelectedScript(item) {
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }
    var openScriptEditor = function () {
      if (state.panelMode === "narrow") {
        resizePanel("wide", true);
      }
      openCodeEditor(item.fullPath, true);
    };

    if (shouldAskBeforeEditorSwitch(item.fullPath)) {
      openSwitchModal(item.fullPath, openScriptEditor, "code");
      return;
    }
    openScriptEditor();
  }

  function editSelectedDoc(item) {
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }
    var openDocEditor = function () {
      selectItem(item.fullPath, { force: true });
      if (state.panelMode === "narrow") {
        resizePanel("wide", true);
      }
      el.codeEditor.classList.remove("open");
      el.contentPanel.classList.remove("editor-open");
      showDetail(item);
      el.detailDoc.disabled = false;
      el.saveDocBtn.disabled = false;
      setToast("\u6B63\u5728\u7F16\u8F91\u8BF4\u660E: " + item.name, "");
    };

    if (state.editorDirty) {
      openSwitchModal(item.fullPath, openDocEditor, "code");
      return;
    }
    openDocEditor();
  }

  function deleteSelectedScript() {
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }
    try {
      var hadZhDoc = item.hasZhDoc && fs.existsSync(item.zhDocPath);
      var hadEnDoc = item.hasEnDoc && fs.existsSync(item.enDocPath);
      moveToRecycleBin(item.fullPath);
      if (hadZhDoc) {
        moveToRecycleBin(item.zhDocPath);
      }
      if (hadEnDoc) {
        moveToRecycleBin(item.enDocPath);
      }
      state.selectedPath = "";
      var deletedText = (hadZhDoc || hadEnDoc) ? (isEnglishUi() ? "Script and guides moved to Recycle Bin: " : "脚本和说明已移到回收站: ") : (isEnglishUi() ? "Script moved to Recycle Bin: " : "脚本已移到回收站: ");
      setToast(deletedText + getScriptDisplayName(item), "ok");
      refresh("\u5220\u9664\u811A\u672C");
      clearDetail();
    } catch (err) {
      setToast(friendlyError("\u5220\u9664\u5931\u8D25", err), "error");
    }
  }

  function runSelected() {
    if (state.running) {
      setToast("\u811A\u672C\u6B63\u5728\u8FD0\u884C\uFF0C\u8BF7\u7A0D\u7B49", "warn");
      return;
    }
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }

    runScriptForItem(item, item.fullPath, item.fullPath);
  }

  function runScriptForItem(item, scriptPath, displayPath) {
    var startedAt = Date.now();
    var runToken = startedAt + ":" + item.key;
    state.runToken = runToken;
    state.runCompletedToken = "";
    state.runningPath = item.fullPath;
    prepareRunStatusFiles(runToken, item);
    setRunning(true);
      setPriorityStatus((isEnglishUi() ? "Running: " : "\u8FD0\u884C\u4E2D: ") + getScriptDisplayName(item), formatSize(item.size), "running");
      setToast((isEnglishUi() ? "Running: " : "\u6B63\u5728\u8FD0\u884C: ") + getScriptDisplayName(item), "running");
    renderListActiveOnly();
    appendConsole("\u25B6 " + (isEnglishUi() ? "Run " : "\u8FD0\u884C ") + getScriptDisplayName(item) + "\n" + displayPath);
    var script = "HGScripts.runScript(" + jsxString(scriptPath) + ", " + jsxString(state.cppMode) + ", " + jsxString(runToken) + ", " + jsxString(RUN_STATUS_PATH) + ", " + jsxString(RUN_REQUEST_PATH) + ", " + jsxString(effectiveLanguage) + ")";
    startRunStatusPolling(runToken, item, startedAt, displayPath);
    armRunUiFallback(runToken, item, startedAt);
    cs.evalScript(script, function (result) {
      if (state.runToken !== runToken) {
        return;
      }
      var parsed = parseRunResult(result);
      if (displayPath && scriptPath !== displayPath && parsed.file && makeFileKey(parsed.file) === makeFileKey(scriptPath)) {
        parsed.file = displayPath;
      }
      if (displayPath && scriptPath !== displayPath && parsed.ok) {
        parsed.message = (isEnglishUi() ? "Executed " : "\u5DF2\u6267\u884C ") + getScriptDisplayName(item);
      }
      finishRunFromParsed(runToken, item, parsed, startedAt, result);
    });
  }

  function runFromEditor() {
    if (state.running) {
      setToast("\u811A\u672C\u6B63\u5728\u8FD0\u884C\uFF0C\u8BF7\u7A0D\u7B49", "warn");
      return;
    }
    var item = findByPath(state.editorPath || state.selectedPath);
    if (!item || !state.editorPath) {
      setToast("请先打开一个脚本", "warn");
      return;
    }

    try {
      if (!state.editorDirty && state.editorPath && state.ace) {
        try {
          state.editorLoading = true;
          state.ace.setValue(fs.readFileSync(state.editorPath, "utf8"), -1);
        } finally {
          state.editorLoading = false;
        }
      }
      var tempPath = makeRuntimeScriptPath(item);
      fs.writeFileSync(tempPath, getEditorValue(), "utf8");
      runScriptForItem(item, tempPath, state.editorPath);
    } catch (err) {
      var message = friendlyError("\u4E34\u65F6\u8FD0\u884C\u5931\u8D25", err);
      appendConsole("ERROR: " + message);
      setToast(message, "error");
    }
  }

  function recordRun(item, result) {
    var stat = getRunStat(item.key);
    stat.name = item.name;
    stat.sourceName = item.sourceName;
    stat.count = (stat.count || 0) + 1;
    stat.lastRun = Date.now();
    stat.lastResult = String(result || "");
    state.runStats[item.key] = stat;
    bumpRecentRunKey(item.key);
    setStoredValue(RUN_STATS_KEY, state.runStats);
    writePanelLog("recordRun key=" + item.key + " name=" + item.name + " count=" + stat.count + " source=" + item.sourceName);
  }

  function prepareRunStatusFiles(runToken, item) {
    try {
      ensureFolder(SHARED_RUNTIME_FOLDER);
      var payload = {
        runId: runToken,
        state: "queued",
        command: getPrimaryCppCommand(item),
        scriptName: item.name,
        scriptPath: item.fullPath,
        source: "cep",
        updatedAt: Date.now()
      };
      fs.writeFileSync(RUN_REQUEST_PATH, JSON.stringify(payload, null, 2), "utf8");
      fs.writeFileSync(RUN_STATUS_PATH, JSON.stringify(payload, null, 2), "utf8");
    } catch (err) {
      appendConsole("WARN: \u5199\u5165\u8FD0\u884C\u72B6\u6001\u8BF7\u6C42\u5931\u8D25: " + err.message);
    }
  }

  function getPrimaryCppCommand(item) {
    return item && item.cppCommands && item.cppCommands.length ? item.cppCommands[0] : "";
  }

  function startRunStatusPolling(runToken, item, startedAt, displayPath) {
    clearRunStatusPolling();
    state.runStatusTimer = setInterval(function () {
      pollRunStatus(runToken, item, startedAt, displayPath);
    }, 180);
  }

  function clearRunStatusPolling() {
    if (state.runStatusTimer) {
      clearInterval(state.runStatusTimer);
      state.runStatusTimer = null;
    }
  }

  function pollRunStatus(runToken, item, startedAt, displayPath) {
    var status = readRunStatus(runToken);
    if (!status) {
      return;
    }
    if (status.state === "running") {
      setPriorityStatus("\u6B63\u5728\u8FD0\u884C: " + item.name, formatDuration(Date.now() - startedAt), "running");
      return;
    }
    if (status.state !== "done" && status.state !== "error") {
      return;
    }
    var parsed = {
      ok: status.state === "done",
      message: getRunStatusMessage(status, item),
      file: displayPath || item.fullPath,
      line: "",
      number: status.errorCode || "",
      context: [],
      raw: JSON.stringify(status)
    };
    finishRunFromParsed(runToken, item, parsed, startedAt, parsed.raw);
  }

  function readRunStatus(runToken) {
    try {
      if (!fs.existsSync(RUN_STATUS_PATH)) {
        return null;
      }
      var status = JSON.parse(fs.readFileSync(RUN_STATUS_PATH, "utf8") || "{}");
      if (String(status.runId || "") !== String(runToken || "")) {
        return null;
      }
      return status;
    } catch (err) {
      return null;
    }
  }

  function getRunStatusMessage(status, item) {
    if (status.message) {
      return decodeText(status.message);
    }
    return status.state === "done" ? "\u5DF2\u5B8C\u6210: " + item.name : "\u8FD0\u884C\u5931\u8D25: " + item.name;
  }

  function finishRunFromParsed(runToken, item, parsed, startedAt, rawResult) {
    if (state.runCompletedToken === runToken) {
      return;
    }
    state.runCompletedToken = runToken;
    try {
      clearRunStatusPolling();
      clearRunUiFallback();
      clearRunCompletionProbe();
      state.runningPath = "";
      setRunning(false);
    } catch (errState) {
      writePanelLog("finishRun state cleanup failed: " + getErrorText(errState));
    }

    try {
      recordRun(item, rawResult || (parsed && parsed.raw) || "");
    } catch (errRecord) {
      writePanelLog("finishRun recordRun failed: " + getErrorText(errRecord));
    }

    parsed = parsed || {};
    parsed.elapsedMs = Date.now() - startedAt;
    try {
      appendConsole(formatRunResult(parsed), true);
      if (parsed.ok) {
        clearEditorError();
        setPriorityStatus("\u5DF2\u5B8C\u6210: " + item.name, formatDuration(parsed.elapsedMs), "ok", 5000);
        setToast(parsed.message, "ok");
      } else {
        state.latestErrorText = formatRunResultPlain(parsed);
        if (state.editorPath && makeFileKey(state.editorPath) === makeFileKey(item.fullPath)) {
          markEditorError(parseInt(parsed.line, 10), parsed.message);
        }
        setPriorityStatus("\u8FD0\u884C\u5931\u8D25: " + item.name, formatDuration(parsed.elapsedMs), "error", 8000);
        setToast(parsed.message || "\u811A\u672C\u6267\u884C\u5931\u8D25", "error");
      }
    } catch (errUi) {
      writePanelLog("finishRun completion UI failed: " + getErrorText(errUi));
    }

    try {
      render();
      writePanelLog("afterRun mode=" + getSortMode() + " itemKey=" + item.key + " top=" + describeTopFilteredItems(6));
      selectItem(item.fullPath);
    } catch (errRender) {
      writePanelLog("finishRun render failed: " + getErrorText(errRender));
    }
  }

  function openCodeEditor(fullPath, force) {
    var item = findByPath(fullPath);
    if (!item) {
      setToast("找不到要编辑的脚本", "warn");
      return;
    }
    if (state.editorDirty && !force && state.editorPath && state.editorPath !== fullPath) {
      openSwitchModal(fullPath, null, "code");
      return;
    }

    try {
      state.editorLoading = true;
      state.editorPath = fullPath;
      state.editorDirty = false;
      if (!state.ace) {
        throw new Error("Ace editor is not ready.");
      }
      state.ace.setValue(fs.readFileSync(fullPath, "utf8"), -1);
      updateSavedScriptMetadata(fullPath, { render: false });
      item = findByPath(fullPath) || item;
      updateSelectedMeta(item, getRunText(item));
      clearEditorError();
      if (el.editorTitle) {
        el.editorTitle.textContent = item.name;
      }
      el.editorTitleInput.value = item.name;
      el.editorTitleInput.disabled = false;
      el.editorPath.textContent = fullPath;
      state.ace.setReadOnly(false);
      el.saveCodeBtn.disabled = false;
      el.runCodeBtn.disabled = false;
      el.saveRunCodeBtn.disabled = false;
      el.reloadCodeBtn.disabled = false;
      el.duplicateCodeBtn.disabled = false;
      el.codeEditor.classList.add("open");
      el.contentPanel.classList.add("editor-open");
      updateEditorState();
      appendConsole("\u5DF2\u6253\u5F00\u7F16\u8F91\u811A\u672C: " + item.name);
      setPriorityStatus("\u5DF2\u6253\u5F00\u7F16\u8F91: " + item.name, formatSize(item.size), "ok", 5000);
      setToast("\u5DF2\u6253\u5F00\u7F16\u8F91\u811A\u672C: " + item.name, "ok");
      setTimeout(function () {
        state.ace.resize(true);
        state.ace.focus();
        state.editorLoading = false;
      }, 0);
    } catch (err) {
      state.editorLoading = false;
      var readMessage = friendlyError("\u8BFB\u53D6\u811A\u672C\u5931\u8D25", err);
      setToast(readMessage, "error");
      appendConsole("ERROR: " + readMessage);
    }
  }

  function closeCodeEditor() {
    if (state.editorDirty && !window.confirm("当前代码尚未保存，确定关闭编辑器？")) {
      return;
    }
    state.editorPath = "";
    state.editorDirty = false;
    if (state.ace) {
      state.ace.setValue("", -1);
      state.ace.setReadOnly(true);
    }
    clearEditorError();
    el.saveCodeBtn.disabled = true;
    el.runCodeBtn.disabled = true;
    el.saveRunCodeBtn.disabled = true;
    el.reloadCodeBtn.disabled = true;
    el.duplicateCodeBtn.disabled = true;
    if (el.editorTitle) {
      el.editorTitle.textContent = "脚本编辑器";
    }
    el.editorTitleInput.value = "";
    el.editorTitleInput.disabled = true;
    el.editorPath.textContent = "";
    el.codeEditor.classList.remove("open");
    el.contentPanel.classList.remove("editor-open");
    updateEditorState();
    var item = findByPath(state.selectedPath);
    if (item) {
      setSelectionToast(item);
    } else {
      setToast("\u672A\u6253\u5F00\u7F16\u8F91\u811A\u672C", "");
    }
  }

  function saveCodeEditor(callback) {
    if (!state.editorPath) {
      setToast("没有打开的脚本", "warn");
      if (callback) {
        callback(false);
      }
      return;
    }

    try {
      fs.writeFileSync(state.editorPath, getEditorValue(), "utf8");
      state.editorDirty = false;
      clearEditorError();
      updateEditorState();
      appendConsole("\u5DF2\u4FDD\u5B58: " + state.editorPath);
      setToast("代码已保存", "ok");
      updateSavedScriptMetadata(state.editorPath);
      selectItem(state.editorPath);
      if (callback) {
        callback(true);
      }
    } catch (err) {
      var saveMessage = friendlyError("\u4EE3\u7801\u4FDD\u5B58\u5931\u8D25", err);
      appendConsole("ERROR: " + saveMessage);
      setToast(saveMessage, "error");
      if (callback) {
        callback(false);
      }
    }
  }

  function updateSavedScriptMetadata(fullPath, options) {
    var item = findByPath(fullPath);
    if (!item) {
      return;
    }
    try {
      var stat = fs.statSync(fullPath);
      item.mtimeMs = stat.mtime.getTime();
      item.mtimeText = formatTime(stat.mtime);
      item.size = stat.size;
      saveCurrentState(buildSnapshotFromFiles(state.files));
      if (!options || options.render !== false) {
        render();
      }
      if (makeFileKey(state.selectedPath) === makeFileKey(fullPath)) {
        updateSelectedMeta(item, getRunText(item));
      }
    } catch (err) {}
  }

  function setRunning(isRunning) {
    state.running = !!isRunning;
    setButtonRunning(el.runBtn, isRunning);
    setButtonRunning(el.runCodeBtn, isRunning);
    setButtonRunning(el.saveRunCodeBtn, isRunning);
    if (!state.running) {
      clearRunningToastFallback();
    }
    renderStatusLine();
    renderListActiveOnly();
  }

  function clearRunningToastFallback() {
    if (!el.toast || !/\brunning\b/.test(el.toast.className || "")) {
      return;
    }
    var item = findByPath(state.selectedPath || state.runningPath);
    setToast(item ? "\u5DF2\u9009\u62E9\u811A\u672C: " + item.name : "\u51C6\u5907\u5C31\u7EEA", "");
  }

  function clearRunCompletionProbe() {
    if (state.runProbeTimer) {
      clearTimeout(state.runProbeTimer);
      state.runProbeTimer = null;
    }
    state.runProbeActive = false;
  }

  function clearRunUiFallback() {
    if (state.runUiTimer) {
      clearTimeout(state.runUiTimer);
      state.runUiTimer = null;
    }
  }

  function armRunUiFallback(runToken, item, startedAt) {
    clearRunUiFallback();
    state.runUiTimer = setTimeout(function () {
      releaseStaleRunningUi(runToken, item, startedAt);
    }, getRunUiFallbackDelay(item));
  }

  function getRunUiFallbackDelay(item) {
    return shouldShowScriptBoostBadge(item) ? 60000 : 120000;
  }

  function releaseStaleRunningUi(runToken, item, startedAt) {
    state.runUiTimer = null;
    if (!state.running || state.runToken !== runToken) {
      return;
    }
    clearRunCompletionProbe();
    var parsed = {
      ok: false,
      message: "\u672A\u6536\u5230\u771F\u5B9E\u8FD0\u884C\u72B6\u6001: " + item.name,
      file: item.fullPath,
      line: "",
      number: "RUN_STATUS_TIMEOUT",
      context: [],
      raw: ""
    };
    finishRunFromParsed(runToken, item, parsed, startedAt, "");
  }

  function armRunCompletionProbe(runToken, item, startedAt) {
    clearRunCompletionProbe();
    state.runProbeTimer = setTimeout(function () {
      requestRunCompletionProbe(runToken, item, startedAt);
    }, 1500);
  }

  function requestRunCompletionProbe(runToken, item, startedAt) {
    if (!state.running || state.runToken !== runToken || state.runProbeActive) {
      return;
    }
    state.runProbeActive = true;
    cs.evalScript("'HGScripts_RUN_PROBE_OK'", function () {
      state.runProbeActive = false;
      state.runProbeTimer = null;
      if (!state.running || state.runToken !== runToken) {
        return;
      }
      state.runningPath = "";
      setRunning(false);
      appendConsole("WARN: \u672A\u6536\u5230\u8FD0\u884C\u7ED3\u679C\u56DE\u8C03\uFF0C\u5DF2\u91CD\u7F6E\u8FD0\u884C\u72B6\u6001: " + item.name);
      setPriorityStatus("\u8FD0\u884C\u72B6\u6001\u5DF2\u91CD\u7F6E: " + item.name, formatDuration(Date.now() - startedAt), "warn", 8000);
      setToast("\u8FD0\u884C\u5DF2\u7ED3\u675F\uFF0C\u9762\u677F\u72B6\u6001\u5DF2\u91CD\u7F6E", "warn");
    });
  }

  function normalizeCppMode(mode) {
    mode = String(mode || "auto").toLowerCase();
    return mode === "cpp" || mode === "jsx" ? mode : "auto";
  }

  function getCppModeLabel(mode) {
    if (mode === "cpp") return isEnglishUi() ? "C++ only" : "仅 C++";
    if (mode === "jsx") return isEnglishUi() ? "Force JSX" : "强制 JSX";
    return t("auto");
  }

  function getCppModeHint(mode) {
    if (mode === "cpp") return isEnglishUi() ? "C++ mode: prefer AIP/C++ acceleration, then fall back to JSX" : "C++模式: 优先 AIP/C++ 加速, 失败后回退 JSX";
    if (mode === "jsx") return isEnglishUi() ? "Force JSX: do not call AIP/C++" : "强制 JSX: 不调用 AIP/C++";
    return isEnglishUi() ? "Auto mode: prefer AIP/C++ acceleration, then fall back to JSX" : "自动模式: 优先 AIP/C++ 加速, 失败后回退 JSX";
  }

  function getCppModeStatusText(mode) {
    if (mode === "cpp") return isEnglishUi() ? "C++: AIP first" : "C++: AIP 优先";
    if (mode === "jsx") return isEnglishUi() ? "JSX: no AIP" : "JSX: 不调用 AIP";
    return isEnglishUi() ? "Auto: AIP first" : "自动: AIP 优先";
  }

  function renderCppMode() {
    if (!el.cppModeSelect) {
      return;
    }
    var mode = normalizeCppMode(state.cppMode);
    el.cppModeSelect.value = mode;
    el.cppModeSelect.className = "cpp-mode-select mode-" + mode;
    el.cppModeSelect.title = t("cppModeTitle") + ": " + getCppModeHint(mode);
  }

  function setButtonRunning(button, isRunning) {
    if (!button) {
      return;
    }
    if (isRunning) {
      if (!button.getAttribute("data-normal-text")) {
        button.setAttribute("data-normal-text", button.textContent);
      }
      button.textContent = isEnglishUi() ? "Running..." : "\u8FD0\u884C\u4E2D...";
      button.classList.add("running");
      button.disabled = true;
      return;
    }
    button.classList.remove("running");
    var normalText = button.getAttribute("data-normal-text");
    if (normalText) {
      button.textContent = normalText;
      button.removeAttribute("data-normal-text");
    }
    if (button === el.runBtn) {
      button.disabled = !state.selectedPath;
    } else {
      button.disabled = !state.editorPath;
    }
  }

  function makeRuntimeScriptPath(item) {
    ensureFolder(RUNTIME_FOLDER);
    var safeBase = sanitizeBaseName(item.base || "runtime") || "runtime";
    return path.join(RUNTIME_FOLDER, safeBase + "_current.jsx");
  }

  function updateEditorState() {
    if (!state.editorPath) {
      el.editorState.textContent = t("noScriptOpen");
      return;
    }
    el.editorState.textContent = state.editorDirty ? (isEnglishUi() ? "Unsaved" : "未保存") : (isEnglishUi() ? "Saved" : "已保存");
    el.editorState.className = state.editorDirty ? "dirty" : "";
  }

  function getEditorValue() {
    return state.ace ? state.ace.getValue() : "";
  }

  function clearEditorError() {
    if (!state.ace) {
      return;
    }
    state.ace.session.clearAnnotations();
    if (state.editorMarker !== null) {
      state.ace.session.removeMarker(state.editorMarker);
      state.editorMarker = null;
    }
  }

  function markEditorError(lineNumber, message) {
    if (!state.ace || !lineNumber || lineNumber < 1) {
      return;
    }
    clearEditorError();
    var row = Math.max(0, lineNumber - 1);
    state.ace.session.setAnnotations([{
      row: row,
      column: 0,
      text: message || "Script error",
      type: "error"
    }]);
    if (window.ace && window.ace.require) {
      var Range = window.ace.require("ace/range").Range;
      state.editorMarker = state.ace.session.addMarker(
        new Range(row, 0, row, 1),
        "ace-error-line",
        "fullLine"
      );
    }
  }

  function appendConsole(message, trustedHtml) {
    var time = formatTime(new Date());
    var entry = document.createElement("div");
    entry.className = "console-entry";
    var decoded = decodeText(message);
    entry.innerHTML = trustedHtml
      ? escapeHtml("[" + time + "] ") + decoded.replace(/\n/g, "<br>")
      : escapeHtml("[" + time + "] " + decoded).replace(/\n/g, "<br>");
    if (el.consoleOutput.textContent === "等待运行结果。" || el.consoleOutput.textContent === "控制台已清空。") {
      el.consoleOutput.innerHTML = "";
    }
    el.consoleOutput.insertBefore(entry, el.consoleOutput.firstChild);
  }

  function writePanelLog(message) {
    try {
      ensureFolder(RUNTIME_FOLDER);
      fs.appendFileSync(RECENT_SORT_LOG_PATH, "[" + new Date().toISOString() + "] " + String(message || "") + "\r\n", "utf8");
    } catch (err) {}
  }

  function describeTopFilteredItems(limit) {
    var list = state.filtered || [];
    var parts = [];
    var count = Math.min(limit || 5, list.length);
    for (var i = 0; i < count; i++) {
      var item = list[i];
      parts.push((i + 1) + ":" + item.name + "#" + getRecentRunIndex(item.key) + "#" + getRunStat(item.key).lastRun);
    }
    return parts.join(" | ");
  }

  function getErrorText(err) {
    return err && err.stack ? err.stack : (err && err.message ? err.message : String(err || ""));
  }

  function parseRunResult(result) {
    try {
      var parsed = JSON.parse(result || "{}");
      return {
        ok: !!parsed.ok,
        message: decodeText(parsed.message || ""),
        file: decodeText(parsed.file || ""),
        line: parsed.line || "",
        number: parsed.number || "",
        context: normalizeErrorContext(parsed.context),
        raw: result || ""
      };
    } catch (err) {
      var text = String(result || "");
      return {
        ok: text.indexOf("OK:") === 0,
        message: decodeText(text || (isEnglishUi() ? "The script finished but returned no result" : "\u811A\u672C\u6267\u884C\u7ED3\u675F\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u7ED3\u679C")),
        file: "",
        line: "",
        number: "",
        context: [],
        raw: text
      };
    }
  }

  function formatRunResult(result) {
    var lines = [];
    var title = result.ok ? "OK: " : "ERROR" + (result.number ? " " + escapeHtml(result.number) : "") + ": ";
    lines.push(title + escapeHtml(result.message));
    if (!result.ok) {
      var hint = getRunErrorHint(result);
      if (hint) {
        lines.push((isEnglishUi() ? "Hint: " : "\u63D0\u793A: ") + escapeHtml(hint));
      }
    }
    if (result.file) {
      lines.push((isEnglishUi() ? "File: " : "\u6587\u4EF6: ") + escapeHtml(result.file));
    }
    if (result.line) {
      lines.push((isEnglishUi() ? "Line: " : "\u884C\u53F7: ") + result.line);
    }
    if (result.context && result.context.length) {
      lines.push("<pre class=\"console-code\">" + formatErrorContext(result.context) + "</pre>");
    }
    if (result.line) {
      lines.push("<button class=\"console-line-link\" data-line=\"" + result.line + "\">" + (isEnglishUi() ? "Jump to line " + result.line : "\u8DF3\u5230\u7B2C " + result.line + " \u884C") + "</button>");
    }
    if (result.number) {
      lines.push((isEnglishUi() ? "Error code: " : "\u9519\u8BEF\u7801: ") + result.number);
    }
    if (typeof result.elapsedMs === "number") {
      lines.push((isEnglishUi() ? "Elapsed: " : "\u8017\u65F6: ") + formatDuration(result.elapsedMs));
    }
    return lines.join("\n");
  }

  function formatRunResultPlain(result) {
    var lines = [];
    var title = result.ok ? "OK: " : "ERROR" + (result.number ? " " + result.number : "") + ": ";
    lines.push(title + result.message);
    if (!result.ok) {
      var hint = getRunErrorHint(result);
      if (hint) {
        lines.push((isEnglishUi() ? "Hint: " : "\u63D0\u793A: ") + hint);
      }
    }
    if (result.file) {
      lines.push((isEnglishUi() ? "File: " : "\u6587\u4EF6: ") + result.file);
    }
    if (result.line) {
      lines.push((isEnglishUi() ? "Line: " : "\u884C\u53F7: ") + result.line);
    }
    if (result.context && result.context.length) {
      lines.push("");
      lines.push(formatErrorContextPlain(result.context));
    }
    if (result.number) {
      lines.push((isEnglishUi() ? "Error code: " : "\u9519\u8BEF\u7801: ") + result.number);
    }
    if (typeof result.elapsedMs === "number") {
      lines.push((isEnglishUi() ? "Elapsed: " : "\u8017\u65F6: ") + formatDuration(result.elapsedMs));
    }
    return lines.join("\n");
  }

  function getRunErrorHint(result) {
    var message = String(result.message || "");
    var number = String(result.number || "");
    if (number === "25" || /\u5E94\u4E3A|Expected|SyntaxError/i.test(message)) {
      return isEnglishUi() ? "This is a syntax error. Check the highlighted line for missing brackets, quotes, semicolons, or a broken function name." : "这是语法错误，优先检查标出的行附近是否少了括号、引号、分号，或函数名被写断。";
    }
    if (/undefined|is not defined/i.test(message)) {
      return isEnglishUi() ? "A variable or function is undefined. Check spelling, scope, or whether it is declared before use." : "有变量或函数未定义，检查名称拼写、作用域，或相关函数是否在运行前声明。";
    }
    if (/No such file|not found|does not exist/i.test(message)) {
      return isEnglishUi() ? "A referenced file or folder does not exist. Check the path, file name, and disk access." : "脚本引用的文件或目录不存在，检查路径、文件名和磁盘是否可访问。";
    }
    if (/permission|access|denied/i.test(message)) {
      return isEnglishUi() ? "The current path may not be writable. Try a normal working folder." : "当前路径可能没有读写权限，可以换到普通工作目录后重试。";
    }
    return result.line ? (isEnglishUi() ? "Check the line number and context. The issue is usually on the highlighted line or nearby." : "查看行号和上下文，通常问题就在标出的行或上一两行。") : "";
  }

  function normalizeErrorContext(context) {
    var rows = [];
    if (!context || !context.length) {
      return rows;
    }
    for (var i = 0; i < context.length; i++) {
      rows.push({
        line: parseInt(context[i].line, 10) || "",
        text: decodeText(context[i].text || ""),
        error: !!context[i].error
      });
    }
    return rows;
  }

  function formatErrorContext(context) {
    var width = 1;
    for (var i = 0; i < context.length; i++) {
      width = Math.max(width, String(context[i].line).length);
    }
    var rows = [];
    for (var j = 0; j < context.length; j++) {
      var mark = context[j].error ? "> " : "  ";
      rows.push("<span class=\"console-code-line\" data-line=\"" + context[j].line + "\">" +
        mark + padLeft(context[j].line, width) + " | " + escapeHtml(context[j].text) + "</span>");
    }
    return rows.join("\n");
  }

  function formatErrorContextPlain(context) {
    var width = 1;
    for (var i = 0; i < context.length; i++) {
      width = Math.max(width, String(context[i].line).length);
    }
    var rows = [];
    for (var j = 0; j < context.length; j++) {
      var mark = context[j].error ? "> " : "  ";
      rows.push(mark + padLeft(context[j].line, width) + " | " + context[j].text);
    }
    return rows.join("\n");
  }

  function padLeft(value, width) {
    var text = String(value || "");
    while (text.length < width) {
      text = " " + text;
    }
    return text;
  }

  function copyConsole() {
    var text = el.consoleOutput.innerText || el.consoleOutput.textContent || "";
    copyTextToClipboard(text, "\u63A7\u5236\u53F0\u5185\u5BB9\u5DF2\u590D\u5236", "\u63A7\u5236\u53F0\u6CA1\u6709\u53EF\u590D\u5236\u5185\u5BB9");
  }

  function copyLatestError() {
    copyTextToClipboard(state.latestErrorText, "\u6700\u65B0\u62A5\u9519\u5DF2\u590D\u5236", "\u5F53\u524D\u6CA1\u6709\u53EF\u590D\u5236\u7684\u62A5\u9519");
  }

  function copyTextToClipboard(text, okMessage, emptyMessage) {
    if (!text.trim()) {
      setToast(emptyMessage, "warn");
      return;
    }

    if (copyTextWithTextarea(text)) {
      setToast(okMessage, "ok");
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setToast(okMessage, "ok");
      }).catch(function () {
        setToast("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u4E2D\u5185\u5BB9\u590D\u5236", "error");
      });
      return;
    }

    setToast("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u4E2D\u5185\u5BB9\u590D\u5236", "error");
  }

  function copyTextWithTextarea(text) {
    var temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "readonly");
    temp.style.position = "fixed";
    temp.style.left = "-9999px";
    temp.style.top = "0";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(temp);
    return ok;
  }

  function decodeText(value) {
    var text = String(value || "");
    try {
      return decodeURIComponent(text);
    } catch (err) {
      try {
        return decodeURI(text);
      } catch (errUri) {
        return text;
      }
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function insertAtCursor(input, text) {
    var start = input.selectionStart;
    var end = input.selectionEnd;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + text.length;
  }

  function jumpToLine(lineNumber) {
    if (!lineNumber || lineNumber < 1 || !state.editorPath) {
      return;
    }
    if (state.ace) {
      state.ace.gotoLine(lineNumber, 0, true);
      state.ace.focus();
    }
  }

  function applyConsoleHeight() {
    var height = parseInt(getStoredValue(CONSOLE_HEIGHT_KEY, "0"), 10);
    if (height) {
      setConsoleHeight(height);
    }
  }

  function bindConsoleResizer() {
    var dragging = false;
    var startY = 0;
    var startHeight = 0;

    el.consoleResizer.addEventListener("mousedown", function (event) {
      dragging = true;
      startY = event.clientY;
      startHeight = el.consoleOutput.parentNode.offsetHeight || 160;
      document.body.classList.add("resizing-console");
      event.preventDefault();
    });

    document.addEventListener("mousemove", function (event) {
      if (!dragging) {
        return;
      }
      var nextHeight = startHeight - (event.clientY - startY);
      setConsoleHeight(nextHeight);
    });

    document.addEventListener("mouseup", function () {
      if (!dragging) {
        return;
      }
      dragging = false;
      document.body.classList.remove("resizing-console");
      setStoredValue(CONSOLE_HEIGHT_KEY, String(el.consoleOutput.parentNode.offsetHeight || 160));
    });
  }

  function setConsoleHeight(height) {
    var editorHeight = el.codeEditor.offsetHeight || 600;
    var minHeight = 80;
    var maxHeight = Math.max(minHeight, editorHeight - 220);
    var next = Math.max(minHeight, Math.min(maxHeight, height));
    el.codeEditor.style.gridTemplateRows = "auto auto minmax(160px, 1fr) 7px " + next + "px";
  }

  function applyMainSplitWidth() {
    var width = parseInt(getStoredValue(MAIN_SPLIT_WIDTH_KEY, "0"), 10);
    if (width) {
      setMainSplitWidth(width);
    }
  }

  function bindMainSplitter() {
    if (!el.mainSplitter || !el.contentPanel) {
      return;
    }
    var dragging = false;
    var startX = 0;
    var startWidth = 0;

    el.mainSplitter.addEventListener("mousedown", function (event) {
      if (state.panelMode === "narrow") {
        return;
      }
      dragging = true;
      startX = event.clientX;
      startWidth = el.scriptList.offsetWidth || 320;
      document.body.classList.add("resizing-main-split");
      event.preventDefault();
    });

    document.addEventListener("mousemove", function (event) {
      if (!dragging) {
        return;
      }
      setMainSplitWidth(startWidth + (event.clientX - startX));
    });

    document.addEventListener("mouseup", function () {
      if (!dragging) {
        return;
      }
      dragging = false;
      document.body.classList.remove("resizing-main-split");
      setStoredValue(MAIN_SPLIT_WIDTH_KEY, String(el.scriptList.offsetWidth || 320));
    });
  }

  function setMainSplitWidth(width) {
    if (!el.contentPanel) {
      return;
    }
    var total = el.contentPanel.clientWidth || 900;
    var splitterWidth = el.mainSplitter ? (el.mainSplitter.offsetWidth || 7) : 7;
    var minList = 180;
    var minDetail = 260;
    var maxList = Math.max(minList, total - splitterWidth - minDetail);
    var next = Math.max(minList, Math.min(maxList, parseInt(width, 10) || minList));
    el.contentPanel.style.gridTemplateColumns = next + "px " + splitterWidth + "px minmax(0, 1fr)";
  }

  function startWatchers() {
    closeWatchers();
    if (!AUTO_REFRESH_ENABLED) {
      setIdleStatus(state.idleCountText, "自动刷新已暂停");
      return;
    }
    var activeCount = 0;
    var watchedCount = 0;

    for (var i = 0; i < state.sources.length; i++) {
      var source = state.sources[i];
      if (source.enabled === false || !fs.existsSync(source.folder)) {
        continue;
      }
      activeCount++;
      try {
        state.watchers.push(fs.watch(source.folder, { persistent: true }, function () {
          debounceRefresh("\u68C0\u6D4B\u5230\u5916\u90E8\u4FEE\u6539");
        }));
        watchedCount++;
      } catch (errWatch) {}
    }

    if (!activeCount) {
      setIdleStatus(state.idleCountText, "监听未启动");
    } else if (watchedCount === activeCount) {
      setIdleStatus(state.idleCountText, "自动监听中");
    } else {
      setIdleStatus(state.idleCountText, "部分目录监听受限，使用轮询");
    }
  }

  function closeWatchers() {
    for (var i = 0; i < state.watchers.length; i++) {
      try {
        state.watchers[i].close();
      } catch (err) {}
    }
    state.watchers = [];
  }

  function startPolling() {
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
    }
    if (!AUTO_REFRESH_ENABLED) {
      state.refreshTimer = null;
      return;
    }

    state.refreshTimer = setInterval(function () {
      var previous = loadPreviousState();
      var result = scanSources();
      if (result.signature !== state.lastSignature) {
        state.files = result.files;
        state.lastSignature = result.signature;
        saveCurrentState(result.snapshot);
        render();
        updateChangeStatus(previous, result.snapshot, "\u8F6E\u8BE2\u5237\u65B0");
      }
    }, REFRESH_INTERVAL_MS);
  }

  function debounceRefresh(reason) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(function () {
      refresh(reason);
    }, 250);
  }

  function updateChangeStatus(previous, current, reason) {
    var added = 0;
    var changed = 0;
    var removed = 0;
    var key;

    for (key in current) {
      if (!previous[key]) {
        added++;
      } else if (previous[key].mtimeMs !== current[key].mtimeMs || previous[key].size !== current[key].size) {
        changed++;
      }
    }

    for (key in previous) {
      if (!current[key]) {
        removed++;
      }
    }

    if (added || changed || removed) {
      setPriorityStatus(reason + ": \u65B0\u589E " + added + "\uFF0C\u4FEE\u6539 " + changed + "\uFF0C\u5220\u9664 " + removed, "", "ok", 5000);
      setToast(reason + ": \u65B0\u589E " + added + "\uFF0C\u4FEE\u6539 " + changed + "\uFF0C\u5220\u9664 " + removed, "ok");
    } else {
      setPriorityStatus(reason + ": 已是最新", "", "", 3000);
      setToast(reason + ": 已是最新", "");
    }
  }

  function getActiveSource() {
    return state.activeSourceId === "all" || state.activeSourceId === "favorites" ? null : findSource(state.activeSourceId);
  }

  function getDefaultSource() {
    for (var i = 0; i < state.sources.length; i++) {
      if (state.sources[i].name === "\u9ED8\u8BA4\u811A\u672C") {
        return state.sources[i];
      }
    }
    return null;
  }

  function findSource(id) {
    for (var i = 0; i < state.sources.length; i++) {
      if (state.sources[i].id === id) {
        return state.sources[i];
      }
    }
    return null;
  }

  function findByPath(fullPath) {
    for (var i = 0; i < state.files.length; i++) {
      if (state.files[i].fullPath === fullPath) {
        return state.files[i];
      }
    }
    return null;
  }

  function moveMetadata(oldKey, newKey, name, sourceName) {
    if (state.favorites[oldKey]) {
      state.favorites[newKey] = {
        name: name,
        sourceName: sourceName,
        time: state.favorites[oldKey].time || Date.now()
      };
      delete state.favorites[oldKey];
      setStoredValue(FAVORITES_KEY, state.favorites);
    }
    if (state.runStats[oldKey]) {
      state.runStats[newKey] = state.runStats[oldKey];
      state.runStats[newKey].name = name;
      state.runStats[newKey].sourceName = sourceName;
      delete state.runStats[oldKey];
      setStoredValue(RUN_STATS_KEY, state.runStats);
    }
    replaceRecentRunKey(oldKey, newKey);
  }

  function getRunStat(key) {
    return state.runStats[key] || { count: 0, lastRun: 0, lastResult: "" };
  }

  function bumpRecentRunKey(key) {
    if (!key) {
      return;
    }
    var next = [key];
    var current = Array.isArray(state.recentRunKeys) ? state.recentRunKeys : [];
    for (var i = 0; i < current.length && next.length < 200; i++) {
      if (current[i] && current[i] !== key) {
        next.push(current[i]);
      }
    }
    state.recentRunKeys = next;
    setStoredValue(RECENT_RUN_KEYS_KEY, state.recentRunKeys);
  }

  function replaceRecentRunKey(oldKey, newKey) {
    if (!oldKey || !newKey || !Array.isArray(state.recentRunKeys)) {
      return;
    }
    var changed = false;
    for (var i = 0; i < state.recentRunKeys.length; i++) {
      if (state.recentRunKeys[i] === oldKey) {
        state.recentRunKeys[i] = newKey;
        changed = true;
      }
    }
    if (changed) {
      setStoredValue(RECENT_RUN_KEYS_KEY, state.recentRunKeys);
    }
  }

  function compareByRecentRun(a, b) {
    var aIndex = getRecentRunIndex(a.key);
    var bIndex = getRecentRunIndex(b.key);
    if (aIndex !== bIndex) {
      if (aIndex < 0) return 1;
      if (bIndex < 0) return -1;
      return aIndex - bIndex;
    }
    return getRunStat(b.key).lastRun - getRunStat(a.key).lastRun || compareByMtimeDesc(a, b);
  }

  function getRecentRunIndex(key) {
    if (!Array.isArray(state.recentRunKeys)) {
      return -1;
    }
    return state.recentRunKeys.indexOf(key);
  }

  function getDefaultDocTemplate(item) {
    if (item && item.english) {
      return "## Purpose\n\n\n## How to Use\n1. \n2. \n3. \n\n## Notes\n- ";
    }
    if (isEnglishUi()) {
      return "## Purpose\n\n\n## How to Use\n1. \n2. \n3. \n\n## Notes\n- ";
    }
    return "## \u7528\u9014\n\n\n## \u4F7F\u7528\u6D41\u7A0B\n1. \n2. \n3. \n\n## \u6CE8\u610F\u4E8B\u9879\n- ";
  }

  function loadScriptIcons() {
    try {
      if (!fs.existsSync(SCRIPT_ICONS_PATH)) {
        return {};
      }
      var icons = JSON.parse(fs.readFileSync(SCRIPT_ICONS_PATH, "utf8"));
      return icons && typeof icons === "object" ? icons : {};
    } catch (err) {
      return {};
    }
  }

  function getScriptIconSrc(item) {
    var icons = state.scriptIcons || {};
    var iconConfig = icons[item.name] || icons[item.base] || icons[item.ext] || "";
    var defaultIcon = DEFAULT_SCRIPT_ICON;
    var iconName = "";

    if (iconConfig && typeof iconConfig === "object") {
      defaultIcon = resolveIconPath(iconConfig.default || "script.svg");
      iconName = iconConfig.icon || "";
    } else {
      iconName = iconConfig;
    }

    if (!iconName) {
      return defaultIcon;
    }

    var resolvedIcon = resolveIconPath(iconName);
    if (iconFileExists(resolvedIcon)) {
      return resolvedIcon;
    }
    return defaultIcon;
  }

  function renderLegacyInlineScriptIcon(imgEl) {
    var wrap = imgEl && imgEl.parentNode ? imgEl.parentNode : null;
    if (!wrap) {
      return;
    }
    imgEl.style.display = "none";
    var existing = wrap.querySelector(".script-icon-inline");
    if (existing) {
      return;
    }
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "script-icon-inline");
    svg.setAttribute("width", "17");
    svg.setAttribute("height", "17");
    svg.setAttribute("viewBox", "0 0 17 17");
    svg.setAttribute("aria-hidden", "true");

    var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "1");
    rect.setAttribute("y", "1");
    rect.setAttribute("width", "15");
    rect.setAttribute("height", "15");
    rect.setAttribute("rx", "2");
    rect.setAttribute("fill", "#17c46b");

    var mark = document.createElementNS("http://www.w3.org/2000/svg", "path");
    mark.setAttribute("d", "M6.25 5.4 4.15 8.5l2.1 3.1M10.75 5.4l2.1 3.1-2.1 3.1M9.45 4.45 7.55 12.55");
    mark.setAttribute("fill", "none");
    mark.setAttribute("stroke", "#0e5638");
    mark.setAttribute("stroke-width", "1.35");
    mark.setAttribute("stroke-linecap", "round");
    mark.setAttribute("stroke-linejoin", "round");

    svg.appendChild(rect);
    svg.appendChild(mark);
    wrap.insertBefore(svg, imgEl);
  }

  function getScriptIconConfig(item) {
    var icons = state.scriptIcons || {};
    return icons[item.name] || icons[item.base] || icons[item.ext] || "";
  }

  function readScriptMeta(fullPath) {
    var meta = { badges: [], cppPlugins: [], cppCommands: [] };
    try {
      var text = fs.readFileSync(fullPath, "utf8");
      var lines = text.split(/\r?\n/).slice(0, 40);
      for (var i = 0; i < lines.length; i++) {
        var badgeMatch = lines[i].match(/^\s*\/\/\s*hgscripts-badge:\s*([A-Za-z0-9_-]+)\s*$/);
        if (badgeMatch && meta.badges.indexOf(badgeMatch[1]) < 0) {
          meta.badges.push(badgeMatch[1]);
        }
        var pluginMatch = lines[i].match(/^\s*\/\/\s*hgscripts-cpp-plugin:\s*([A-Za-z0-9_.-]+)\s*$/);
        if (pluginMatch) {
          var pluginName = normalizeCppPluginName(pluginMatch[1]);
          if (pluginName && meta.cppPlugins.indexOf(pluginName) < 0) {
            meta.cppPlugins.push(pluginName);
          }
        }
        var commandMatch = lines[i].match(/^\s*\/\/\s*hgscripts-cpp-command:\s*([A-Za-z0-9_.-]+)\s*$/);
        if (commandMatch && meta.cppCommands.indexOf(commandMatch[1]) < 0) {
          meta.cppCommands.push(commandMatch[1]);
        }
      }
    } catch (err) {
    }
    return meta;
  }

  function hasScriptBadge(item, badge) {
    return !!(item && item.badges && item.badges.indexOf(badge) >= 0);
  }

  function shouldShowScriptBoostBadge(item) {
    if (!hasScriptBadge(item, "cpp")) {
      return false;
    }
    if (normalizeCppMode(state.cppMode) === "jsx") {
      return false;
    }
    if (typeof process === "undefined" || process.platform !== "win32") {
      return false;
    }
    return hasAvailableCppPlugin(item);
  }

  function getCppBoostBadgeTitle() {
    var mode = normalizeCppMode(state.cppMode);
    var availableText = "已检测到 Illustrator 加速插件";
    if (mode === "cpp") {
      return "C++模式: " + availableText + ", 失败后回退jsx";
    }
    if (mode === "jsx") {
      return "强制JSX: 当前不调用C++";
    }
    return "自动模式: " + availableText + ", 失败后回退jsx";
  }

  function hasAvailableCppPlugin(item) {
    if (!item || !item.cppPlugins || !item.cppPlugins.length) {
      return false;
    }
    for (var i = 0; i < item.cppPlugins.length; i++) {
      if (isCppPluginInstalled(item.cppPlugins[i])) {
        return true;
      }
    }
    return false;
  }

  function normalizeCppPluginName(value) {
    var name = String(value || "").trim();
    if (!name) {
      return "";
    }
    return /\.aip$/i.test(name) ? name : name + ".aip";
  }

  function isCppPluginInstalled(pluginName) {
    pluginName = normalizeCppPluginName(pluginName);
    if (!pluginName || typeof process === "undefined" || process.platform !== "win32") {
      return false;
    }
    var found = false;
    try {
      var roots = [];
      if (process.env.ProgramFiles) {
        roots.push(path.join(process.env.ProgramFiles, "Adobe"));
      }
      if (process.env["ProgramFiles(x86)"]) {
        roots.push(path.join(process.env["ProgramFiles(x86)"], "Adobe"));
      }
      for (var i = 0; i < roots.length && !found; i++) {
        var adobeRoot = roots[i];
        if (!fs.existsSync(adobeRoot)) {
          continue;
        }
        var apps = fs.readdirSync(adobeRoot);
        for (var j = 0; j < apps.length && !found; j++) {
          if (!/^Adobe Illustrator /i.test(apps[j])) {
            continue;
          }
          if (HOST_PROFILE.year && apps[j].indexOf(HOST_PROFILE.year) < 0) {
            continue;
          }
          var plugIns = path.join(adobeRoot, apps[j], "Plug-ins");
          found = fs.existsSync(path.join(plugIns, "HGScripts", pluginName));
        }
      }
    } catch (err) {
      found = false;
    }
    return found;
  }

  function resolveIconPath(iconName) {
    iconName = String(iconName || "").replace(/\\/g, "/");
    if (/^(file|https?):\/\//i.test(iconName)) {
      return iconName;
    }
    if (iconName.indexOf("/") >= 0) {
      return iconName;
    }
    return "assets/icons/" + iconName;
  }

  function iconFileExists(iconSrc) {
    if (/^https?:\/\//i.test(iconSrc)) {
      return true;
    }
    if (/^file:\/\//i.test(iconSrc)) {
      return fs.existsSync(iconSrc.replace(/^file:\/\//i, ""));
    }
    try {
      return fs.existsSync(path.join(EXTENSION_ROOT, iconSrc));
    } catch (err) {
      return false;
    }
  }

  function loadPreviousState() {
    return loadJson(STATE_KEY, {});
  }

  function saveCurrentState(snapshot) {
    setStoredValue(STATE_KEY, snapshot || {}, true);
  }

  function loadJson(key, fallback) {
    try {
      var value = getStoredValue(key, null, key === STATE_KEY);
      return value ? JSON.parse(value) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function getStoredValue(key, fallback, sessionOnly) {
    if (sessionOnly) {
      var sessionRaw = sessionStorage.getItem(key);
      return sessionRaw !== null && sessionRaw !== undefined ? sessionRaw : fallback;
    }
    if (!sessionOnly && settings.storage && settings.storage.hasOwnProperty(key)) {
      return settings.storage[key];
    }
    return fallback;
  }

  function setStoredValue(key, value, sessionOnly) {
    var serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (sessionOnly) {
      sessionStorage.setItem(key, serialized);
      return;
    }
    settings.storage = settings.storage || {};
    settings.storage[key] = serialized;
    saveSettings();
  }

  function loadSettings() {
    var next = cloneSettings(DEFAULT_SETTINGS);
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        var saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
        mergeSettings(next, saved);
      }
    } catch (err) {}
    next.scanDepth = normalizeScanDepth(next.scanDepth, DEFAULT_SETTINGS.scanDepth);
    next.ignoredDirs = parseIgnoredDirs((next.ignoredDirs || DEFAULT_SETTINGS.ignoredDirs).join(","));
    next.languageMode = normalizeLanguageMode(next.languageMode);
    next.storage = next.storage || {};
    return next;
  }

  function detectHostLanguage() {
    try {
      var host = cs.getHostEnvironment ? cs.getHostEnvironment() : cs.hostEnvironment;
      var raw = String((host && (host.appUILocale || host.appLocale)) || navigator.language || "");
      return /^zh/i.test(raw) ? "zh-CN" : "en-US";
    } catch (err) {
      return /^zh/i.test(String(navigator.language || "")) ? "zh-CN" : "en-US";
    }
  }

  function detectHostProfile() {
    var appName = "";
    var appId = "";
    var appVersion = "";
    try {
      var host = cs.getHostEnvironment ? cs.getHostEnvironment() : cs.hostEnvironment;
      appName = String((host && host.appName) || "");
      appId = String((host && host.appId) || "");
      appVersion = String((host && host.appVersion) || "");
    } catch (err) {}
    var raw = (appName + " " + appId).toLowerCase();
    var versionMajor = parseInt((appVersion.match(/^(\d+)/) || [])[1], 10);
    var illustratorYear = "";
    if (versionMajor >= 25 && versionMajor <= 30) {
      illustratorYear = String(1996 + versionMajor);
    }
    if (raw.indexOf("photoshop") >= 0 || raw.indexOf("phxs") >= 0 || raw.indexOf("phsp") >= 0) {
      return {
        key: "photoshop",
        folder: "photoshop",
        label: "Photoshop",
        shortLabel: "Ps",
        version: appVersion,
        year: ""
      };
    }
    if (raw.indexOf("indesign") >= 0 || raw.indexOf("idsn") >= 0) {
      return {
        key: "indesign",
        folder: "indesign",
        label: "InDesign",
        shortLabel: "Id",
        version: appVersion,
        year: ""
      };
    }
    return {
      key: "illustrator",
      folder: "illustrator",
      label: "Illustrator",
      shortLabel: "Ai",
      version: appVersion,
      year: illustratorYear
    };
  }

  function normalizeLanguageMode(value) {
    value = String(value || "auto");
    if (value === "zh-CN" || value === "en-US" || value === "auto") {
      return value;
    }
    return "auto";
  }

  function resolveEffectiveLanguage(mode, detected) {
    mode = normalizeLanguageMode(mode);
    if (mode === "auto") {
      return detected === "zh-CN" ? "zh-CN" : "en-US";
    }
    return mode;
  }

  function saveSettings() {
    try {
      ensureFolder(path.dirname(SETTINGS_PATH));
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
    } catch (err) {
      setToast("\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25: " + err.message, "error");
    }
  }

  function migrateSettingsStorage() {
    settings.storage = settings.storage || {};
    var changed = false;

    if (HOST_PROFILE.key === "illustrator") {
      changed = migrateLegacyHostStorage() || changed;
    }

    if (settings.storage.hasOwnProperty(LEGACY_FOLDER_KEY)) {
      delete settings.storage[LEGACY_FOLDER_KEY];
      changed = true;
    }

    changed = migrateStoredSources() || changed;
    changed = migrateStoredRecentSources() || changed;
    changed = migrateStoredRunStats() || changed;
    clearLegacyLocalStorage();

    if (changed) {
      saveSettings();
    }
  }

  function migrateLegacyHostStorage() {
    var changed = false;
    var pairs = [
      [LEGACY_SOURCES_KEY, SOURCES_KEY],
      [LEGACY_ACTIVE_SOURCE_KEY, ACTIVE_SOURCE_KEY],
      [LEGACY_FAVORITES_KEY, FAVORITES_KEY],
      [LEGACY_RUN_STATS_KEY, RUN_STATS_KEY],
      [LEGACY_RECENT_SOURCES_KEY, RECENT_SOURCES_KEY],
      [LEGACY_CONSOLE_HEIGHT_KEY, CONSOLE_HEIGHT_KEY],
      [LEGACY_PANEL_SIZES_KEY, PANEL_SIZES_KEY]
    ];
    for (var i = 0; i < pairs.length; i++) {
      if (!settings.storage.hasOwnProperty(pairs[i][1]) && settings.storage.hasOwnProperty(pairs[i][0])) {
        settings.storage[pairs[i][1]] = settings.storage[pairs[i][0]];
        changed = true;
      }
    }
    return changed;
  }

  function migrateStoredSources() {
    var raw = settings.storage[SOURCES_KEY];
    var sources = [];
    var changed = false;

    if (raw) {
      try {
        sources = JSON.parse(raw) || [];
      } catch (err) {
        sources = [];
        changed = true;
      }
    }

    if (!sources.length) {
      sources = [{
        id: makeId(),
        name: "\u9ED8\u8BA4\u811A\u672C",
        folder: DEFAULT_FOLDER,
        enabled: true
      }];
      changed = true;
    }

    var normalized = normalizeSources(sources);
    if (JSON.stringify(sources) !== JSON.stringify(normalized)) {
      changed = true;
    }
    settings.storage[SOURCES_KEY] = JSON.stringify(normalized);
    return changed;
  }

  function migrateStoredRecentSources() {
    var raw = settings.storage[RECENT_SOURCES_KEY];
    if (!raw) {
      return false;
    }
    try {
      var list = JSON.parse(raw) || [];
      var next = [];
      var changed = false;
      for (var i = 0; i < list.length; i++) {
        var item = normalizeFsPath(list[i] || "");
        if (!item || samePath(item, EXTERNAL_DEFAULT_FOLDER) || isUnderPath(item, EXTERNAL_DATA_FOLDER)) {
          changed = true;
          continue;
        }
        next.push(item);
      }
      if (changed || JSON.stringify(list) !== JSON.stringify(next)) {
        settings.storage[RECENT_SOURCES_KEY] = JSON.stringify(next);
        return true;
      }
    } catch (err) {
      settings.storage[RECENT_SOURCES_KEY] = "[]";
      return true;
    }
    return false;
  }

  function migrateStoredRunStats() {
    var raw = settings.storage[RUN_STATS_KEY];
    if (!raw) {
      return false;
    }
    try {
      var stats = JSON.parse(raw) || {};
      var next = {};
      var changed = false;
      for (var key in stats) {
        if (!stats.hasOwnProperty(key)) {
          continue;
        }
        if (isExternalManagedPath(key) || String(stats[key].lastResult || "").indexOf(EXTERNAL_DATA_FOLDER) !== -1) {
          changed = true;
          continue;
        }
        next[key] = stats[key];
      }
      if (changed) {
        settings.storage[RUN_STATS_KEY] = JSON.stringify(next);
        return true;
      }
    } catch (err) {
      settings.storage[RUN_STATS_KEY] = "{}";
      return true;
    }
    return false;
  }

  function clearLegacyLocalStorage() {
    var keys = [
      LEGACY_FOLDER_KEY,
      LEGACY_SOURCES_KEY,
      LEGACY_ACTIVE_SOURCE_KEY,
      LEGACY_FAVORITES_KEY,
      LEGACY_RUN_STATS_KEY,
      LEGACY_RECENT_SOURCES_KEY,
      LEGACY_CONSOLE_HEIGHT_KEY,
      LEGACY_PANEL_SIZES_KEY,
      SOURCES_KEY,
      ACTIVE_SOURCE_KEY,
      FAVORITES_KEY,
      RUN_STATS_KEY,
      RECENT_SOURCES_KEY,
      CONSOLE_HEIGHT_KEY,
      PANEL_SIZES_KEY
    ];
    try {
      for (var i = 0; i < keys.length; i++) {
        localStorage.removeItem(keys[i]);
      }
    } catch (err) {}
  }

  function cloneSettings(source) {
    return JSON.parse(JSON.stringify(source));
  }

  function mergeSettings(target, source) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key];
      }
    }
  }

  function parseIgnoredDirs(value) {
    var raw = Array.isArray(value) ? value : String(value || "").split(",");
    var result = [];
    for (var i = 0; i < raw.length; i++) {
      var item = String(raw[i] || "").trim();
      if (item) {
        result.push(item);
      }
    }
    return result.length ? result : DEFAULT_SETTINGS.ignoredDirs.slice();
  }

  function clampNumber(value, min, max, fallback) {
    if (isNaN(value)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, value));
  }

  function normalizeScanDepth(value, fallback) {
    return clampNumber(parseInt(value, 10), 0, 10, fallback);
  }

  function openExternal(filePath) {
    childProcess.execFile("cmd.exe", ["/c", "start", "", filePath], { windowsHide: true });
  }

  function openFolder(folderPath) {
    var normalized = normalizeFsPath(folderPath);
    if (!normalized) {
      setToast("文件夹路径为空", "warn");
      return;
    }
    if (!fs.existsSync(normalized)) {
      setToast("\u6587\u4EF6\u5939\u4E0D\u5B58\u5728: " + normalized, "warn");
      return;
    }
    childProcess.execFile("cmd.exe", ["/c", "start", "", normalized], { windowsHide: true }, function (err) {
      if (err) {
        setToast(friendlyError("打开文件夹失败", err), "error");
      }
    });
  }

  function openCurrentScriptFolder() {
    var scriptPath = state.editorPath || state.selectedPath;
    var item = findByPath(scriptPath);
    if (!item) {
      setToast("请先选择一个脚本", "warn");
      return;
    }
    openFolder(item.scriptFolder || path.dirname(item.fullPath));
  }

  function openCurrentDocumentFolder() {
    cs.evalScript("HGScripts.getActiveDocumentFolder()", function (resultPath) {
      var folderPath = normalizeFsPath(decodeText(resultPath || ""));
      if (!folderPath || folderPath.indexOf("ERROR:") === 0) {
        setToast(folderPath || "\u5F53\u524D\u6587\u6863\u6CA1\u6709\u53EF\u7528\u76EE\u5F55", "warn");
        return;
      }
      openFolder(folderPath);
    });
  }

  function getDialogStartPath() {
    var startPath = normalizeInputPath(el.folderInput.value) || DEFAULT_FOLDER;
    try {
      if (fs.existsSync(startPath) && fs.statSync(startPath).isFile()) {
        return path.dirname(startPath);
      }
    } catch (err) {}
    return startPath;
  }

  function openWindowsFileDialog(startPath, title, filter) {
    var script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "[System.Windows.Forms.Application]::EnableVisualStyles()",
      "[Console]::OutputEncoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false",
      "$dlg = New-Object System.Windows.Forms.OpenFileDialog",
      "$dlg.Title = " + psString(title),
      "$dlg.Filter = " + psString(filter),
      "$dlg.Multiselect = $false",
      setPowerShellInitialDirectory(startPath),
      "if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dlg.FileName) }"
    ].join("\n");
    return runPowerShellDialog(script);
  }

  function openWindowsFolderDialog(startPath, title) {
    var pickerExe = path.join(EXTENSION_ROOT, "bin", "HGFolderPicker.exe");
    if (!fs.existsSync(pickerExe)) {
      throw new Error("Windows folder picker executable missing: " + pickerExe);
    }

    var result = childProcess.execFileSync(pickerExe, [
      startPath || DEFAULT_FOLDER,
      title || "\u9009\u62E9\u6587\u4EF6\u5939"
    ], {
      encoding: "utf8",
      windowsHide: true
    });

    result = String(result || "").replace(/^\uFEFF/, "").trim();
    if (result.indexOf("OK:") === 0) {
      return normalizeFsPath(result.slice(3));
    }
    if (!result || result === "CANCEL") {
      return "";
    }
    throw new Error("Windows folder picker returned: " + result);
  }

  function setPowerShellInitialDirectory(startPath) {
    return [
      "$start = " + psString(startPath || DEFAULT_FOLDER),
      "if ([System.IO.Directory]::Exists($start)) {",
      "  $dlg.InitialDirectory = $start",
      "} elseif ([System.IO.File]::Exists($start)) {",
      "  $dlg.InitialDirectory = [System.IO.Path]::GetDirectoryName($start)",
      "} elseif ([System.IO.Directory]::Exists(" + psString(DEFAULT_FOLDER) + ")) {",
      "  $dlg.InitialDirectory = " + psString(DEFAULT_FOLDER),
      "}"
    ].join("\n");
  }

  function runPowerShellDialog(script) {
    var result = childProcess.execFileSync("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], {
      encoding: "utf8",
      windowsHide: true
    });
    return normalizeInputPath(result);
  }

  function compareByMtimeDesc(a, b) {
    return b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name, "zh-Hans-CN");
  }

  function compareByInitial(a, b) {
    var collator = getPinyinCollator();
    var result = collator
      ? collator.compare(getSortName(a), getSortName(b))
      : getSortName(a).localeCompare(getSortName(b), "zh-Hans-CN");
    return result || compareByMtimeDesc(a, b);
  }

  function getPinyinCollator() {
    if (typeof Intl === "undefined" || !Intl.Collator) {
      return null;
    }
    try {
      return new Intl.Collator("zh-Hans-CN-u-co-pinyin", {
        numeric: true,
        sensitivity: "base"
      });
    } catch (err) {
      return new Intl.Collator("zh-Hans-CN", {
        numeric: true,
        sensitivity: "base"
      });
    }
  }

  function getSortName(item) {
    return (item.base || item.name || "").replace(/^\s+/, "");
  }

  function normalizeInputPath(value) {
    return (value || "").trim().replace(/^"|"$/g, "");
  }

  function normalizeFsPath(value) {
    var normalized = normalizeInputPath(value);
    var isWindows = typeof process !== "undefined" && process.platform === "win32";
    if (isWindows) {
      normalized = normalized.replace(/\//g, "\\");
      var match = normalized.match(/^\\([a-zA-Z]):\\(.*)$/);
      if (match) {
        normalized = match[1].toUpperCase() + ":\\" + match[2];
      }
      match = normalized.match(/^\\([a-zA-Z])\\(.*)$/);
      if (match) {
        normalized = match[1].toUpperCase() + ":\\" + match[2];
      }
      return normalized;
    }
    return normalized.replace(/\\/g, "/");
  }

  function getExtensionRoot() {
    try {
      if (typeof SystemPath !== "undefined" && cs && cs.getSystemPath) {
        var extensionPath = normalizeFsPath(cs.getSystemPath(SystemPath.EXTENSION));
        if (extensionPath) {
          return path.resolve(extensionPath);
        }
      }
    } catch (err) {}
    return path.resolve(__dirname, "..", "..");
  }

  function samePath(a, b) {
    return makeFileKey(normalizeFsPath(a || "")) === makeFileKey(normalizeFsPath(b || ""));
  }

  function isUnderPath(child, parent) {
    var childKey = makeFileKey(normalizeFsPath(child || ""));
    var parentKey = makeFileKey(normalizeFsPath(parent || ""));
    return childKey === parentKey || childKey.indexOf(parentKey + path.sep) === 0;
  }

  function isExternalManagedPath(value) {
    return isUnderPath(value, EXTERNAL_DEFAULT_FOLDER) || isUnderPath(value, EXTERNAL_DATA_FOLDER);
  }

  function inferSourceName(folder) {
    var normalized = normalizeInputPath(folder);
    return path.basename(normalized) || "\u811A\u672C\u76EE\u5F55";
  }

  function sanitizeBaseName(value) {
    return (value || "").trim().replace(/\.(jsx|js)$/i, "").replace(/[\\/:*?"<>|]/g, "");
  }

  function sanitizeScriptFileName(value, fallbackExt) {
    var raw = (value || "").trim().replace(/[\\/:*?"<>|]/g, "");
    var ext = path.extname(raw).toLowerCase();
    if (!SCRIPT_EXTENSIONS[ext]) {
      ext = SCRIPT_EXTENSIONS[fallbackExt] ? fallbackExt : ".jsx";
      raw = raw.replace(/\.[^.]*$/, "");
    } else {
      raw = raw.slice(0, raw.length - ext.length);
    }
    var base = sanitizeBaseName(raw);
    return {
      base: base,
      ext: ext,
      name: base ? base + ext : ""
    };
  }

  function makeFileKey(filePath) {
    return path.normalize(filePath).toLowerCase();
  }

  function makeId() {
    return "src_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  }

  function jsxString(value) {
    return JSON.stringify(String(value)).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  }

  function psString(value) {
    return "'" + String(value).replace(/'/g, "''") + "'";
  }

  function formatTime(date) {
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    return date.getFullYear() + "-" +
      pad(date.getMonth() + 1) + "-" +
      pad(date.getDate()) + " " +
      pad(date.getHours()) + ":" +
      pad(date.getMinutes());
  }

  function formatDuration(ms) {
    if (ms < 1000) {
      return ms + " ms";
    }
    return Math.round(ms / 100) / 10 + (isEnglishUi() ? " sec" : " 秒");
  }

  function formatSize(bytes) {
    if (bytes < 1024) {
      return bytes + " B";
    }
    return Math.round(bytes / 102.4) / 10 + " KB";
  }

  function setToast(message, level) {
    el.toast.textContent = message;
    el.toast.className = "toast" + (level ? " " + level : "");
  }

  function friendlyError(prefix, err) {
    var code = err && err.code ? String(err.code) : "";
    var raw = err && err.message ? String(err.message) : String(err || "");
    var detail = raw;
    if (code === "ENOENT") {
      detail = "\u8DEF\u5F84\u4E0D\u5B58\u5728\u6216\u6587\u4EF6\u5DF2\u88AB\u79FB\u52A8";
    } else if (code === "EACCES" || code === "EPERM") {
      detail = "\u6CA1\u6709\u6743\u9650\u8BBF\u95EE\u8BE5\u8DEF\u5F84\uFF0C\u6216\u6587\u4EF6\u6B63\u5728\u88AB\u5360\u7528";
    } else if (code === "EBUSY") {
      detail = "文件正在被其它程序占用";
    }
    return prefix + (detail ? ": " + detail : "");
  }

  function isEnglishUi() {
    return effectiveLanguage !== "zh-CN";
  }

  function t(key) {
    var lang = isEnglishUi() ? "en-US" : "zh-CN";
    return (UI_TEXT[lang] && UI_TEXT[lang][key]) ||
      (UI_TEXT["zh-CN"] && UI_TEXT["zh-CN"][key]) ||
      key;
  }

  function setText(node, value) {
    if (node) {
      node.textContent = value;
    }
  }

  function setAttr(node, name, value) {
    if (node) {
      node.setAttribute(name, value);
    }
  }

  function queryOne(selector) {
    return selector ? document.querySelector(selector) : null;
  }

  function syncSortLabels() {
    var labels = {
      lastRunDesc: t("sortLastRun"),
      mtimeDesc: t("sortMtime"),
      initialAsc: t("sortInitialAsc"),
      initialDesc: t("sortInitialDesc"),
      nameAsc: t("sortNameAsc"),
      nameDesc: t("sortNameDesc")
    };
    if (el.sortSelect) {
      for (var i = 0; i < el.sortSelect.options.length; i++) {
        var opt = el.sortSelect.options[i];
        opt.textContent = labels[opt.value] || opt.textContent;
      }
    }
    if (el.sortMenu) {
      var buttons = el.sortMenu.querySelectorAll("button[data-sort]");
      for (var j = 0; j < buttons.length; j++) {
        var sort = buttons[j].getAttribute("data-sort");
        buttons[j].textContent = labels[sort] || buttons[j].textContent;
      }
    }
  }

  function getSortLabel(mode) {
    var labels = {
      lastRunDesc: t("sortLastRun"),
      mtimeDesc: t("sortMtime"),
      initialAsc: t("sortInitialAsc"),
      initialDesc: t("sortInitialDesc"),
      nameAsc: t("sortNameAsc"),
      nameDesc: t("sortNameDesc")
    };
    return labels[mode] || t("sortTitle");
  }

  function syncLanguageLabels() {
    if (!el.languageSelect) {
      return;
    }
    for (var i = 0; i < el.languageSelect.options.length; i++) {
      var opt = el.languageSelect.options[i];
      if (opt.value === "auto") opt.textContent = t("auto");
      if (opt.value === "zh-CN") opt.textContent = t("chinese");
    }
  }

  function syncScanDepthLabels() {
    if (!el.scanDepthInput) {
      return;
    }
    for (var i = 0; i < el.scanDepthInput.options.length; i++) {
      var opt = el.scanDepthInput.options[i];
      if (opt.value === "0") {
        opt.textContent = t("scanCurrentOnly");
      } else {
        opt.textContent = opt.value + t("scanChildPrefix") + opt.value + t("scanChildSuffix");
      }
    }
  }

  function syncCreateDocLabel() {
    var label = queryOne(".create-form label");
    if (!label || !el.newScriptDocInput) {
      return;
    }
    var input = el.newScriptDocInput;
    label.innerHTML = "";
    label.appendChild(input);
    label.appendChild(document.createTextNode(t("docCheckbox")));
  }

  function syncContextMenuLabels() {
    if (!el.contextMenu) {
      return;
    }
    var labels = {
      run: t("run"),
      internalEdit: t("editScript"),
      editDoc: t("editDoc"),
      reveal: t("revealExplorer"),
      delete: t("deleteScript")
    };
    var buttons = el.contextMenu.querySelectorAll("button[data-action]");
    for (var i = 0; i < buttons.length; i++) {
      var action = buttons[i].getAttribute("data-action");
      buttons[i].textContent = labels[action] || buttons[i].textContent;
    }
  }

  function syncAboutLabels() {
    var terms = document.querySelectorAll("#aboutView dt");
    var labels = [t("pluginName"), t("version"), t("updateDate"), "Email", "WeChat", "GitHub", t("referenceProjects"), t("description")];
    for (var i = 0; i < terms.length && i < labels.length; i++) {
      terms[i].textContent = labels[i];
    }
    var dds = document.querySelectorAll("#aboutView dd");
    if (dds.length >= 8) {
      dds[7].textContent = t("aboutDescription");
    }
  }

  function getScriptDisplayBase(item) {
    if (!item) {
      return "";
    }
    if (isEnglishUi() && EN_SCRIPT_TITLES[item.base]) {
      return EN_SCRIPT_TITLES[item.base];
    }
    return item.base || "";
  }

  function getScriptDisplayName(item) {
    var base = getScriptDisplayBase(item);
    return base + (item && item.ext ? item.ext : "");
  }

  function getDocPaths(scriptFolder, base) {
    var zhPath = path.join(scriptFolder, base + ".md");
    return {
      zh: zhPath,
      en: path.join(scriptFolder, base + ".en.md"),
      active: isEnglishUi() && fs.existsSync(path.join(scriptFolder, base + ".en.md")) ? path.join(scriptFolder, base + ".en.md") : zhPath
    };
  }

  setTimeout(function () {
    try {
      init();
    } catch (errInit) {
      failBoot("HGScripts 初始化失败", errInit);
    }
  }, 0);
})();
