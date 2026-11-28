(function () {
  "use strict";

  var HGI = window.HGI18N || null;
  var fs = null;
  var path = null;
  var childProcess = null;
  var httpsNode = null;
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
      writeBootStatus(t("bootStarted2023", { version: state.appVersion }), "warn");
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
    writeBootStatus(t("bootPaintFailed"), "warn");
    writeBootLog("UI paint check failed: shell=" + shellHeight + ", topbar=" + topbarHeight);
  }

  try {
    writeBootStatus(t("bootLoading"));
    fs = require("fs");
    path = require("path");
    childProcess = require("child_process");
    httpsNode = require("https");
  } catch (errRequire) {
    failBoot(t("bootNodeFailed"), errRequire);
    return;
  }

  try {
    cs = new CSInterface();
    writeBootLog("CSInterface initialized");
  } catch (errCs) {
    failBoot(t("bootCsFailed"), errCs);
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
  // 面板尺寸用文件持久化，不走 localStorage：CEP 的 localStorage 落在 Temp\cep_cache，
  // 会被系统清理/未正常退出时丢数据，导致每次启动读不到记住的窗口大小。
  var PANEL_SIZES_PATH = path.join(EXTENSION_ROOT, "data", "panel_sizes.json");
  var SCRIPT_ICONS_PATH = path.join(EXTENSION_ROOT, "data", "script_icons.json");
  var RUNTIME_FOLDER = path.join(EXTENSION_ROOT, "data", "runtime");
  var RECENT_SORT_LOG_PATH = path.join(RUNTIME_FOLDER, "recent_sort.log");
  var SHARED_RUNTIME_FOLDER = path.join(process.env.APPDATA || CEP_ROOT, "HGScripts", "runtime");
  var RUN_STATUS_PATH = path.join(SHARED_RUNTIME_FOLDER, "run_status.json");
  var RUN_REQUEST_PATH = path.join(SHARED_RUNTIME_FOLDER, "run_request.json");
  var RUN_HINT_PATH = path.join(SHARED_RUNTIME_FOLDER, "run_hint.json");
  var DEFAULT_SCRIPT_ICON = "assets/icons/script.svg";
  var HOST_ICON_SRC = {
    illustrator: "assets/icons/host-illustrator.svg",
    photoshop: "assets/icons/host-photoshop.svg",
    indesign: "assets/icons/host-indesign.svg"
  };
  var DOC_ICON_SRC = "assets/icons/file-tips-filled.svg";
  var CPP_BOOST_ICON_SRC = "assets/icons/cpp-boost.svg";
  var STAR_OUTLINE_ICON_SRC = "assets/icons/star-outline.svg";
  var STAR_FILLED_ICON_SRC = "assets/icons/star-filled.svg";
  var SCRIPT_EXTENSIONS = { ".jsx": true, ".js": true };
  // 面板尺寸的**唯一**最小闸门是 manifest 的 MinSize（宿主自己执行，拖到就停）。
  // 代码侧不再设「最小尺寸」钳位——2026-11-04 实锤教训：380×420 是当天上午在
  // 100% 缩放环境下标定的数字，被写进 normalizePanelSize 后，用户在宿主允许的
  // 更小尺寸（实测拖到 252×279）上做的每一次拖拽记忆都被偷偷替换成 380×420，
  // 下次启动「恢复」出来的就是被抬高的值——用户看到的「启动自动放大」其实是
  // 自己的代码改掉了自己的偏好。用户拖到哪、记到哪、恢复到哪。
  // 这里只留防呆边界：记忆值超出 [SANITY_MIN, SANITY_MAX] 视为损坏数据，不参与。
  var PANEL_SIZE_SANITY_MIN = 100;
  var PANEL_SIZE_SANITY_MAX_WIDTH = 1400;
  var PANEL_SIZE_SANITY_MAX_HEIGHT = 1800;
  // ---------- 面板尺寸的两个坐标系（2026-11-04 14:55 日志实锤，混用就是「一次比一次大」）----------
  //   请求坐标系 = DIP：resizeContent(w,h) 的入参，manifest 的 Size / MinSize 也是这个单位。
  //   观测坐标系 = CSS px：documentElement.clientWidth 与 resize 事件报的都是这个单位。
  // 本机 150% 缩放（manifest 里 CEF 用 --force-device-scale-factor=1，CSS px 等于屏幕物理像素）：
  //   resizeContent(380,420) → 面板真的变成 570×630，即 CSS = DIP × 1.5。
  // 旧版把观测值（CSS）原样存进 panel_sizes.json，下次又原样发回 resizeContent（被当成 DIP），
  // 于是每重启一次 ×1.5：380 → 570 → 855，这正是海哥报的「380→574→860，一次比一次大」。
  // 铁律：**记忆一律存 DIP，观测值进场先除以倍率**；倍率只从「我们自己请求的回声」量一次，
  // 绝不采纳宿主自己跳变出来的比例（那正是旧版把 380 一路推大的错法）。
  // 首次运行（还没有 panel_sizes.json）的启动尺寸，单位 DIP。252×278 就是宿主允许的最紧凑档
  // （等于 manifest MinSize，再小宿主自己弹回来），也是海哥日常用的尺寸。
  var FIRST_RUN_PANEL_WIDTH = 252;
  var FIRST_RUN_PANEL_HEIGHT = 278;
  // 窄记忆的缺省值——用户从没拖过窄面板时，Ai 图标切到的「窄」档。
  var NARROW_PANEL_WIDTH = 252;
  var NARROW_PANEL_HEIGHT = 278;
  // 宽记忆的缺省值：820×760 是「添加目录」三段式弹窗能完整排开的设计尺寸（DIP）。
  var WIDE_PANEL_WIDTH = 820;
  var WIDE_PANEL_HEIGHT = 760;
  // 宽面板的分界线：宽度到这里右侧详情区才出现（CSS 的 .panel-narrow 隐藏 .detail）。
  // 「是不是宽面板」一律按这个阈值判定，不按按钮点过谁，保证与肉眼看到的一致。
  var WIDE_LAYOUT_THRESHOLD = 720;
  // 启动 resize 的收敛参数：宿主应用 resizeContent 是异步的，还会自己恢复停靠尺寸
  // （实测启动时先把面板盖回 300×300 或 manifest 的 252×279），必须等尺寸「稳定」
  // （连续两次读数一致）才能判定恢复成败；误差容忍 5%，最多原样重发 2 次，总超时 6 秒。
  var STARTUP_SETTLE_POLL_MS = 300;
  var STARTUP_SETTLE_TIMEOUT_MS = 6000;
  var STARTUP_SETTLE_TOLERANCE = 0.05;
  var STARTUP_SETTLE_MAX_RESEND = 2;

  var DEFAULT_SETTINGS = {
    scanDepth: 0,
    ignoredDirs: ["node_modules", ".git", ".svn", ".hg"],
    languageMode: "auto",
    updateCheckEnabled: true,
    updateSnoozeUntil: 0
  };
  var COMMAND_SCENES = HGI ? HGI.SCENES : [];
  // 中文文件名是稳定契约，默认新建脚本名不随界面语言变化 / Chinese file names are a stable contract.
  var NEW_SCRIPT_FILENAME_BASE = "\u65B0\u5EFA\u811A\u672C"; // i18n-ignore: default file name, not UI text
  var settings = loadSettings();
  migrateSettingsStorage();
  var hostLanguage = detectHostLanguage();
  var effectiveLanguage = resolveEffectiveLanguage(settings.languageMode, hostLanguage);
  if (HGI) {
    HGI.setLanguage(effectiveLanguage);
  }

  var storedPanelSizes = loadPanelSizes();
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
    updateBarTimer: null,
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
    startupSizing: false,
    startupSettleAborted: false,
    sizeBeforeSourceModal: null,
    // 目录弹窗把窗口临时放大到宽面板时，这段自动 resize 不能写进用户记忆，
    // 否则「宽面板记忆」会被弹窗的最小尺寸（820×760）覆盖掉。
    suppressSizeMemory: false,
    // CSS px 与 DIP 的换算倍率（= 系统缩放）。0 表示本会话还没量到，
    // 量到之前一律按 1 处理（量到的第一刻就把它纠正过来）。
    panelDipScale: 0,
    panelSizes: storedPanelSizes || {
      narrow: { width: FIRST_RUN_PANEL_WIDTH, height: FIRST_RUN_PANEL_HEIGHT },
      wide: { width: WIDE_PANEL_WIDTH, height: WIDE_PANEL_HEIGHT }
    },
    pendingSwitchPath: "",
    pendingSwitchCallback: null,
    pendingSwitchKind: "code",
    appVersion: "0.3.14",
    idleCountText: t("statusZeroScripts"),
    watchStatusText: t("statusWatchIdle"),
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
    dropZone: document.getElementById("dropZone"),
    sourceDetailName: document.getElementById("sourceDetailName"),
    sourceEmptyNote: document.getElementById("sourceEmptyNote"),
    changePathBtn: document.getElementById("changePathBtn"),
    openFolderBtn: document.getElementById("openFolderBtn"),
    advToggleBtn: document.getElementById("advToggleBtn"),
    advToggleText: document.getElementById("advToggleText"),
    advBody: document.getElementById("advBody"),
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
    detailMetaInfo: document.getElementById("detailMetaInfo"),
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
    editorMetaInfo: document.getElementById("editorMetaInfo"),
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
    updateBar: document.getElementById("updateBar"),
    updateBarText: document.getElementById("updateBarText"),
    updateBarClose: document.getElementById("updateBarClose"),
    updateCheckToggle: document.getElementById("updateCheckToggle"),
    updateCheckText: document.getElementById("updateCheckText"),
    toast: document.getElementById("toast"),
    statusHint: document.getElementById("statusHint"),
    footerbar: document.querySelector(".footerbar")
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
    // 缩放变了，已显示的提示框坐标是旧倍率下的局部值，先收起，下次悬停重新定位。
    hideTip();
    if (el.uiZoomSelect && el.uiZoomSelect.value !== zoom) {
      el.uiZoomSelect.value = zoom;
    }
  }

  function init() {
    writeBootStatus(t("bootInit"));
    writeBootLog("init begin");
    initTooltips();
    if (LEGACY_COMPAT_MODE && document.body) {
      document.body.className += (document.body.className ? " " : "") + "legacy-compat";
    }
    ensureFolder(USER_SCRIPTS_ROOT);
    ensureFolder(DEFAULT_FOLDER);
    migrateFlatUserScriptsToIllustrator();
    ensureFolder(RUNTIME_FOLDER);
    ensureFolder(SHARED_RUNTIME_FOLDER);
    writePanelLog("loaded build=0.3.14-release-20261128 root=" + EXTENSION_ROOT);
    saveSettings();
    renderHostProfile();
    renderCppMode();
    renderAppVersion();
    migrateDefaultSource();
    ensureActiveSource();
    initUpdateControls();
    window.setTimeout(function () {
      checkForUpdate(false);
    }, UPDATE_CHECK_DELAY_MS);
    if (LEGACY_COMPAT_MODE) {
      initLegacyTextEditor();
    } else {
      initAceEditor();
    }
    setupPanelMenu();
    bindEvents();
    renderSources();
    renderSettings();
    translateStaticUi();
    renderLanguageHint();
    applyUiZoom();
    applyConsoleHeight();
    applyMainSplitWidth();
    restoreStartupPanelSize();
    render();
    writeBootLog("init UI ready");
    setTimeout(function () {
      try {
        writeBootLog("startup refresh begin");
        refresh(t("reasonStartup"));
        hideBootStatusIfUiPainted();
        writeBootLog("startup refresh done");
      } catch (errRefresh) {
        failBoot(t("bootScanFailed"), errRefresh);
      }
    }, 0);
    startPolling();
    startWatchers();
    if (LEGACY_COMPAT_MODE) {
      setTimeout(tryUpgradeLegacyAceEditor, 900);
    }
  }

  var panelMenuBound = false;

  function setupPanelMenu() {
    try {
      cs.setPanelFlyoutMenu("<Menu><MenuItem Id=\"" + PANEL_MENU_SETTINGS_ID + "\" Label=\"" + escapeHtml(t("settings")) + "\" Enabled=\"true\" Checked=\"false\"/><MenuItem Id=\"" + PANEL_MENU_ABOUT_ID + "\" Label=\"" + escapeHtml(t("about")) + "\" Enabled=\"true\" Checked=\"false\"/></Menu>");
      if (panelMenuBound) {
        return;
      }
      panelMenuBound = true;
      cs.addEventListener("com.adobe.csxs.events.flyoutMenuClicked", function (event) {
        var data = event && event.data ? event.data : {};
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch (err) {
            data = { menuId: data };
          }
        }
        if (data.menuId === PANEL_MENU_SETTINGS_ID || data.menuName === t("settings")) {
          openSettingsView();
        } else if (data.menuId === PANEL_MENU_ABOUT_ID || data.menuName === t("about")) {
          openAboutView();
        }
      });
    } catch (err) {}
  }

  function renderHostProfile() {
    document.body.setAttribute("data-host", HOST_PROFILE.key);
    if (el.hostBadge) {
      el.hostBadge.textContent = HOST_PROFILE.shortLabel;
      el.hostBadge.title = t("hostCurrent", { host: HOST_PROFILE.label });
    }
    if (el.hostIcon) {
      el.hostIcon.src = HOST_ICON_SRC[HOST_PROFILE.key] || HOST_ICON_SRC.illustrator;
      el.hostIcon.alt = HOST_PROFILE.shortLabel;
    }
    if (el.panelSizeBtn) {
      el.panelSizeBtn.setAttribute("aria-label", t("hostToggle", { host: HOST_PROFILE.label }));
    }
    if (el.openDocFolderBtn) {
      el.openDocFolderBtn.title = t("hostOpenDocFolder", { host: HOST_PROFILE.label });
    }
  }

  function renderAppVersion() {
    var version = "0.3.14";
    try {
      var manifestPath = path.join(EXTENSION_ROOT, "CSXS", "manifest.xml");
      var manifest = fs.readFileSync(manifestPath, "utf8");
      var match = manifest.match(/ExtensionBundleVersion="([^"]+)"/) || manifest.match(/<Extension[^>]+Version="([^"]+)"/);
      if (match && match[1]) {
        version = match[1];
      }
    } catch (err) {
      version = "0.3.14";
    }
    document.title = t("appTitle", { version: version });
    if (el.appVersion) {
      el.appVersion.textContent = "v" + version;
    }
    if (el.aboutVersion) {
      el.aboutVersion.textContent = "v" + version;
    }
    state.appVersion = version;
  }

  var UPDATE_CHECK_URL = "https://haigeplay3d.com/hgscripts/version.json";
  var UPDATE_FALLBACK_URL = "https://haigeplay3d.com/hgscripts/";
  var UPDATE_CHECK_DELAY_MS = 8000;
  var UPDATE_CHECK_TIMEOUT_MS = 8000;
  var UPDATE_RESPONSE_MAX_BYTES = 65536;
  var UPDATE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

  function compareVersionNumbers(localText, remoteText) {
    var localParts = String(localText || "").trim().split(".");
    var remoteParts = String(remoteText || "").trim().split(".");
    var count = Math.max(localParts.length, remoteParts.length);
    for (var i = 0; i < count; i++) {
      var localNum = parseInt(localParts[i], 10) || 0;
      var remoteNum = parseInt(remoteParts[i], 10) || 0;
      if (localNum !== remoteNum) {
        return localNum < remoteNum ? -1 : 1;
      }
    }
    return 0;
  }

  function fetchLatestVersionInfo(callback) {
    var finished = false;
    function settle(result) {
      if (finished) {
        return;
      }
      finished = true;
      callback(result);
    }
    try {
      var request = httpsNode.get(
        UPDATE_CHECK_URL + "?t=" + Date.now(),
        function (response) {
          if (response.statusCode !== 200) {
            response.resume();
            settle(null);
            return;
          }
          var chunks = [];
          var total = 0;
          response.on("data", function (chunk) {
            total += chunk.length;
            if (total > UPDATE_RESPONSE_MAX_BYTES) {
              request.destroy();
              settle(null);
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", function () {
            try {
              var data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
              settle(data && typeof data.version === "string" && data.version ? data : null);
            } catch (errParse) {
              settle(null);
            }
          });
          response.on("error", function () {
            settle(null);
          });
        }
      );
      request.setTimeout(UPDATE_CHECK_TIMEOUT_MS, function () {
        request.destroy();
        settle(null);
      });
      request.on("error", function () {
        settle(null);
      });
    } catch (errFetch) {
      settle(null);
    }
  }

  function hideUpdateBar() {
    if (!el.updateBar) {
      return;
    }
    el.updateBar.hidden = true;
    el.updateBar.className = "update-bar";
    el.updateBar.onclick = null;
    if (state.updateBarTimer) {
      window.clearTimeout(state.updateBarTimer);
      state.updateBarTimer = null;
    }
  }

  // 中性状态提示：复用底部提示条，几秒后自动隐藏。
  function showUpdateStatus(message, kind, autoHideMs) {
    if (!el.updateBar || !el.updateBarText) {
      return;
    }
    if (state.updateBarTimer) {
      window.clearTimeout(state.updateBarTimer);
      state.updateBarTimer = null;
    }
    el.updateBarText.textContent = message;
    el.updateBar.className = "update-bar" + (kind ? " update-bar-" + kind : "");
    el.updateBar.hidden = false;
    el.updateBar.onclick = null;
    if (autoHideMs) {
      state.updateBarTimer = window.setTimeout(function () {
        state.updateBarTimer = null;
        hideUpdateBar();
      }, autoHideMs);
    }
  }

  function snoozeUpdateNotice() {
    settings.updateSnoozeUntil = Date.now() + UPDATE_SNOOZE_MS;
    saveSettings();
    hideUpdateBar();
    writePanelLog("update check: notice dismissed until " + new Date(settings.updateSnoozeUntil).toISOString());
  }

  function showUpdateBar(version, pageUrl) {
    if (!el.updateBar || !el.updateBarText) {
      return;
    }
    if (Date.now() < (Number(settings.updateSnoozeUntil) || 0)) {
      return;
    }
    if (state.updateBarTimer) {
      window.clearTimeout(state.updateBarTimer);
      state.updateBarTimer = null;
    }
    el.updateBarText.textContent = t("updateAvailable", { version: "v" + version });
    el.updateBar.className = "update-bar";
    el.updateBar.hidden = false;
    el.updateBar.onclick = function () {
      openExternal(String(pageUrl || UPDATE_FALLBACK_URL));
    };
  }

  function checkForUpdate(manual) {
    if (!httpsNode || !state.appVersion) {
      return;
    }
    if (!manual) {
      if (settings.updateCheckEnabled === false) {
        writePanelLog("update check: skipped (disabled)");
        return;
      }
      if (Date.now() < (Number(settings.updateSnoozeUntil) || 0)) {
        writePanelLog("update check: skipped (snoozed)");
        return;
      }
    } else {
      showUpdateStatus(t("updateChecking"), "busy", 0);
    }
    try {
      fetchLatestVersionInfo(function (info) {
        if (!info || !info.version) {
          writePanelLog("update check: unavailable or unreachable");
          if (manual) {
            showUpdateStatus(t("updateCheckFailed"), "warn", 4000);
          }
          return;
        }
        if (compareVersionNumbers(state.appVersion, info.version) >= 0) {
          writePanelLog("update check: up to date (remote " + info.version + ")");
          if (manual) {
            showUpdateStatus(t("updateUpToDate", { version: "v" + state.appVersion }), "ok", 4000);
          }
          return;
        }
        writePanelLog("update check: new version " + info.version);
        showUpdateBar(info.version, info.page);
      });
    } catch (errUpdate) {
      writePanelLog("update check failed: " + errUpdate);
      if (manual) {
        showUpdateStatus(t("updateCheckFailed"), "warn", 4000);
      }
    }
  }

  function syncUpdateControls() {
    if (el.updateCheckToggle) {
      el.updateCheckToggle.checked = settings.updateCheckEnabled !== false;
    }
    if (el.updateCheckText) {
      el.updateCheckText.textContent = t("updateCheckToggle");
    }
    if (el.updateBarClose) {
      el.updateBarClose.title = t("updateBarDismiss");
      el.updateBarClose.setAttribute("aria-label", t("updateBarDismiss"));
    }
  }

  function initUpdateControls() {
    syncUpdateControls();
    if (el.updateBarClose) {
      el.updateBarClose.onclick = function (event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        snoozeUpdateNotice();
      };
    }
    if (el.updateCheckToggle) {
      el.updateCheckToggle.onchange = function () {
        settings.updateCheckEnabled = el.updateCheckToggle.checked !== false;
        saveSettings();
        writePanelLog("update check: " + (settings.updateCheckEnabled ? "enabled" : "disabled") + " by user");
        if (settings.updateCheckEnabled) {
          settings.updateSnoozeUntil = 0;
          saveSettings();
          checkForUpdate(true);
        } else {
          hideUpdateBar();
        }
      };
    }
  }

  function applyPanelMode(mode) {
    state.panelMode = mode === "wide" ? "wide" : "narrow";
    if (el.shell) {
      el.shell.classList.toggle("panel-wide", state.panelMode === "wide");
      el.shell.classList.toggle("panel-narrow", state.panelMode === "narrow");
    }
    if (el.panelSizeBtn) {
      el.panelSizeBtn.title = state.panelMode === "wide" ? t("panelSwitchToNarrow") : t("panelSwitchToWide");
      el.panelSizeBtn.classList.toggle("panel-wide-active", state.panelMode === "wide");
    }
    if (el.panelSizeLabel) {
      el.panelSizeLabel.textContent = state.panelMode === "wide" ? t("collapse") : t("expand");
    }
    // 记住「上一次停在哪个模式」，下次启动 Illustrator 沿用它。
    // 弹窗临时放大期间（suppressSizeMemory）和启动恢复（startupSizing）不写：
    // 前者是临时态不算数，后者写回去等于没变化还多一次磁盘 IO。
    if (!state.suppressSizeMemory && !state.startupSizing) {
      state.panelSizes = state.panelSizes || {};
      if (state.panelSizes.lastMode !== state.panelMode) {
        state.panelSizes.lastMode = state.panelMode;
        savePanelSizes(state.panelSizes);
      }
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
    renderFooterStatus();
    if (holdMs) {
      setTimeout(function () {
        renderStatusLine();
        renderFooterStatus();
      }, holdMs + 50);
    }
  }

  function renderFooterStatus() {
    if (!el.footerbar) {
      return;
    }
    var priority = state.running || Date.now() < state.statusHoldUntil;
    if (priority && state.statusMessage) {
      if (el.statusHint) {
        el.statusHint.textContent = state.statusRightText || state.statusMessage;
      }
      el.footerbar.className = "footerbar status-" + (state.statusLevel || "running");
    } else {
      if (el.statusHint) {
        el.statusHint.textContent = "";
      }
      el.footerbar.className = "footerbar";
    }
  }

  function setIdleStatus(leftText, rightText) {
    state.idleCountText = leftText || state.idleCountText || t("statusZeroScripts");
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

  // 只负责把宽窄模式和当前宽度对齐，**不写记忆**。记忆只由用户拖拽（防抖）和显式
  // 模式切换写——宿主自己改尺寸触发的 resize 一律不许落进 panel_sizes.json，
  // 这是 2026-11-04「面板一次比一次大」的根，已焊死。
  function syncPanelModeFromWidth() {
    if (state.startupSizing) {
      return;
    }
    var width = document.documentElement.clientWidth || document.body.clientWidth || 0;
    var nextMode = width >= WIDE_LAYOUT_THRESHOLD ? "wide" : "narrow";
    if (nextMode !== state.panelMode) {
      applyPanelMode(nextMode);
    }
  }

  function resizePanel(mode, silent, sizeOverride) {
    if (state.startupSizing) {
      // 启动收敛未完成时用户/弹窗主动改尺寸：中止轮询并立即解除抑制，
      // 让这次 applyPanelMode 正常写 lastMode；当前尺寸还是宿主恢复的旧值，
      // 不能把它记成上一个模式的用户记忆。
      state.startupSettleAborted = true;
      state.startupSizing = false;
    } else {
      rememberPanelSize(state.panelMode);
    }
    applyPanelMode(mode);
    var size = sizeOverride || getRememberedPanelSize(mode);
    try {
      setPanelContentSize(size);
      if (!silent) {
        setToast(mode === "wide" ? t("panelSwitchedWide") : t("panelSwitchedNarrow"), "ok");
      }
      setTimeout(function () {
        if (state.ace) {
          state.ace.resize(true);
        }
      }, 120);
    } catch (err) {
      if (!silent) {
        setToast(t("panelSwitchFailed", { error: err.message }), "error");
      }
    }
  }

  // 当前是不是宽面板：与 CSS 同一判据——宽度达到阈值时右侧详情区才出现。
  function isWidePanel() {
    var width = document.documentElement.clientWidth || document.body.clientWidth || 0;
    return width >= WIDE_LAYOUT_THRESHOLD;
  }

  // Ai 图标：在「窄面板」与「宽面板」之间来回切，两侧都用用户记忆的尺寸。
  //   窄 = panel_sizes.json 的 narrow（没记忆时就是最小档 380×420）
  //   宽 = panel_sizes.json 的 wide
  // 不在代码里写死任何一档的宽高，用户拖成什么样就记成什么样。
  function togglePanelSize() {
    // 目录弹窗开着时，先关弹窗——关闭会还原到打开前的窄面板尺寸。
    if (el.sourceModal && el.sourceModal.classList.contains("open")) {
      // 关闭前先记下「这个弹窗是不是从窄面板打开的」。用这个标志判断，而不是关闭后
      // 再读窗口宽度：resize 是异步的，读完可能还是弹窗那个宽度。
      var wasOpenedFromNarrow = !!state.sizeBeforeSourceModal;
      closeSourceModal();
      if (wasOpenedFromNarrow) {
        // 已经回窄了，这次点击就到此为止。
        return;
      }
      // 从宽面板打开的弹窗：关掉后仍是宽面板，继续执行「切窄」。
    }
    resizePanel(isWidePanel() ? "narrow" : "wide");
  }

  // 启动尺寸恢复。
  // 2026-11-04 第五版定稿（前一版的「不存在 DPI 换算」结论已被 14:55 日志推翻）：
  //   1. **两个坐标系**：resizeContent 收 DIP，clientWidth / resize 事件报 CSS；本机
  //      150% 缩放下 CSS = DIP × 1.5。记忆存 DIP，观测值进场除以倍率。混用就是
  //      「一次比一次大」（380 → 570 → 855）。
  //   2. **宿主会自己改尺寸**：恢复 manifest 尺寸、恢复它记住的尺寸，随时可能发生。
  //      我们的动作只有一条：把尺寸压回当前模式的记忆值，由 handlePanelResizeEvent 全天候负责。
  //   3. **记忆只能由用户写**：只有连续拖拽（连续 resize 事件流）才写 panel_sizes.json，
  //      宿主单次跳变一律不记。
  // 模式沿用上次（lastMode）：上次停在宽面板，这次启动也是宽面板；无记录回退窄面板。
  function restoreStartupPanelSize() {
    var mode = state.panelSizes && state.panelSizes.lastMode === "wide" ? "wide" : "narrow";
    // 先置位再 applyPanelMode，否则恢复动作本身会把 lastMode 覆写一遍。
    state.startupSizing = true;
    state.startupSettleAborted = false;
    applyPanelMode(mode);
    var size = getRememberedPanelSize(mode);
    writeBootLog("startup restore: mode=" + mode + ", target=" + size.width + "x" + size.height);
    setPanelContentSize(size);
    pollStartupPanelSize(size, { attempts: 0, lastKey: "", startedAt: Date.now() });
  }

  // 收敛轮询：等尺寸稳定（连续两次读数一致）再判定，避免拿宿主还没应用完的旧值下结论。
  // 不匹配就原样重发，最多 2 次；再不匹配就接受现状收尾。**全程不碰任何缩放系数**。
  // 用户在收敛期间主动改尺寸（Ai 图标/弹窗）会置 startupSettleAborted，轮询直接让位。
  function pollStartupPanelSize(size, ctx) {
    setTimeout(function () {
      if (state.startupSettleAborted) {
        writeBootLog("startup settle: aborted by user resize");
        state.startupSizing = false;
        return;
      }
      var after = getPanelClientSize();
      var key = after.width + "x" + after.height;
      if (key === ctx.lastKey) {
        decideStartupPanelSize(size, ctx, after);
        return;
      }
      if (Date.now() - ctx.startedAt < STARTUP_SETTLE_TIMEOUT_MS) {
        ctx.lastKey = key;
        pollStartupPanelSize(size, ctx);
      } else {
        writeBootLog("startup settle: timeout at " + key + ", target=" + size.width + "x" + size.height);
        finishStartupPanelSize(after);
      }
    }, STARTUP_SETTLE_POLL_MS);
  }

  function decideStartupPanelSize(size, ctx, after) {
    var expected = dipSizeToCss(size);
    var ratio = after.width && expected.width ? after.width / expected.width : 1;
    var ratioH = after.height && expected.height ? after.height / expected.height : 1;
    var dev = Math.max(Math.abs(1 - ratio), Math.abs(1 - ratioH));
    var key = after.width + "x" + after.height;
    if (dev <= STARTUP_SETTLE_TOLERANCE) {
      writeBootLog("startup settle: matched, actual=" + key + ", target=" + size.width + "x" + size.height);
      finishStartupPanelSize(after);
      return;
    }
    if (ctx.attempts >= STARTUP_SETTLE_MAX_RESEND) {
      writeBootLog("startup settle: accept mismatch, actual=" + key + ", target=" + size.width + "x" + size.height + ", resend=" + ctx.attempts);
      finishStartupPanelSize(after);
      return;
    }
    ctx.attempts += 1;
    ctx.lastKey = "";
    writeBootLog("startup settle: mismatch (actual=" + key + "), resend target, resend=" + ctx.attempts);
    setPanelContentSize(size);
    pollStartupPanelSize(size, ctx);
  }

  function finishStartupPanelSize(after) {
    // 收尾对齐模式（CSS class / 按钮文案）但不写记忆：宿主恢复失败时给的尺寸不是
    // 用户意愿，不能写进 panel_sizes.json——否则失败结果会成为下次启动的目标，
    // 面板越启越大。注意不能借道 syncPanelModeFromWidth()，它开头就被
    // startupSizing 短路，等于没对齐。
    state.startupSizing = true;
    try {
      var width = (after && after.width) || 0;
      applyPanelMode(width >= WIDE_LAYOUT_THRESHOLD ? "wide" : "narrow");
    } finally {
      state.startupSizing = false;
    }
  }

  // resizeContent 的入参是 **DIP**（逻辑像素），不是 CSS 像素。2026-11-04 14:55 启动日志
  // 实锤：请求 380×420 → 面板变成 570×630（×1.5），请求 252×279 → 378×418。
  // 旧注释里「实测请求 380 得到 380、不存在 DPI 换算」这条结论**已被推翻**：那次是在
  // 100% 缩放环境下测的，把两个坐标系的重合当成了没有换算。教训——记忆存 DIP、
  // 观测值进场除以倍率（cssSizeToDip），不要再让两边混着用。
  function setPanelContentSize(size) {
    // 不做「最小尺寸」钳位：宿主按 manifest MinSize 执行真正的闸门。
    // 这里只做防呆（非负、非 NaN），请求值原样发出——用户记多大就恢复多大。
    var targetWidth = Math.max(1, Math.round(size.width || 0));
    var targetHeight = Math.max(1, Math.round(size.height || 0));
    // 标记「这次 resize 是我们自己发起的」+ 记下请求的目标尺寸：
    // 自守卫只吞「时间窗内 且 尺寸≈请求值」的回声，其余事件交给护栏判定——
    // 宿主常在我们 resize 后 1~2 秒内补一刀（尺寸≠请求值），之前被时间窗
    // 一刀切吞掉，日志一片空白，面板无声放大（2026-11-04 13:28 实测）。
    state.selfResizeAt = Date.now();
    state.selfResizeSize = { width: targetWidth, height: targetHeight };
    if (cs && typeof cs.resizeContent === "function") {
      cs.resizeContent(targetWidth, targetHeight);
    } else if (window.__adobe_cep__ && window.__adobe_cep__.resizeContent) {
      window.__adobe_cep__.resizeContent(targetWidth, targetHeight);
    }
  }

  // 判定一个窗口事件是不是我们自己 resizeContent 的回声：
  // 时间窗内 且 宽高都≈我们请求的目标值（±5%）——目标值要先换算到观测坐标系。
  function isOwnResizeEcho(size, now) {
    var req = state.selfResizeSize;
    if (!req || !req.width || !size.width) {
      return false;
    }
    if (!state.selfResizeAt || now - state.selfResizeAt >= SELF_GUARD_MS) {
      return false;
    }
    var expected = dipSizeToCss(req);
    var devW = Math.abs(1 - size.width / expected.width);
    var devH = expected.height && size.height ? Math.abs(1 - size.height / expected.height) : 0;
    return devW <= 0.05 && devH <= 0.05;
  }

  function getPanelClientSize() {
    var width = document.documentElement.clientWidth || document.body.clientWidth || 0;
    var height = document.documentElement.clientHeight || document.body.clientHeight || 0;
    return { width: width, height: height };
  }

  // ---------- CSS px ↔ DIP 换算（倍率只量一次，量到后本会话锁定）----------
  function getPanelDipScale() {
    return state.panelDipScale > 0 ? state.panelDipScale : 1;
  }

  // 观测值（CSS）→ 记忆值（DIP）
  function cssSizeToDip(size) {
    var k = getPanelDipScale();
    return {
      width: Math.max(1, Math.round((size && size.width ? size.width : 0) / k)),
      height: Math.max(1, Math.round((size && size.height ? size.height : 0) / k))
    };
  }

  // 记忆值（DIP）→ 观测值（CSS），只用于「检查宿主有没有照做」
  function dipSizeToCss(size) {
    var k = getPanelDipScale();
    return {
      width: Math.round((size && size.width ? size.width : 0) * k),
      height: Math.round((size && size.height ? size.height : 0) * k)
    };
  }

  // 量倍率：只看**我们自己刚发出的请求**的回声。宽高比例必须同时吻合（±2%），
  // 且倍率落在 [1, 3] 这种真实缩放区间内才采纳——用户拖拽或宿主自己恢复尺寸
  // 不可能恰好按我们请求的宽高比等比缩放，所以不会误判。量到一次即锁定。
  function maybeMeasurePanelDipScale(size, now) {
    if (state.panelDipScale > 0) {
      return;
    }
    var req = state.selfResizeSize;
    if (!req || !req.width || !req.height || !size || !size.width || !size.height) {
      return;
    }
    if (!state.selfResizeAt || now - state.selfResizeAt >= SELF_GUARD_MS) {
      return;
    }
    var ratioW = size.width / req.width;
    var ratioH = size.height / req.height;
    if (ratioW < 1.02 || ratioW > 3) {
      return;
    }
    if (Math.abs(ratioW - ratioH) > 0.02) {
      return;
    }
    state.panelDipScale = Math.round(ratioW * 100) / 100;
    writeBootLog("panel dip scale measured: " + state.panelDipScale + " (request " + req.width + "x" + req.height + " -> " + size.width + "x" + size.height + ")");
  }

  // ---------- 窗口尺寸护栏（第五版，2026-11-04 18:10）----------
  // 第四版把「离散单次 resize 事件」一律当成宿主跳变、按旧记忆压回去，实机日志
  // `data/runtime/panel_boot.log` 里 6 次触发**全部是误伤用户拖拽**：
  //   [10:07:50.173] resize event: 498x803        ← 用户拖到的新尺寸
  //   [10:07:50.173] host resize guard ... re-apply narrow 250x277, fix=6
  //   [10:07:51.283] resize event: 378x418        ← 1.1 秒后被压回旧尺寸
  // 用户拖拽同样会产生离散事件：松手后的 settle、拖到一半停顿、慢速拖拽，甚至
  // CEP 整轮拖拽只在松手时发一个 resize（日志 10:07:50.173 前 36 秒无事件）。
  // 实测相邻事件间隔可到 652ms，旧阈值 400ms 会把一次拖拽劈成「流 + 离散尾巴」。
  // 第五版不再靠事件间隔猜，改用**确定的因果信号**：宿主补刀一定紧跟我们自己的
  // resizeContent（SELF_GUARD_MS 内），用户拖拽前面不会有它。
  //   · 连续事件流（间隔 < DRAG_GAP_MS，非自身回声）= 拖拽 → 防抖写记忆；
  //   · 离散事件且尺寸变了、但近期没发过 resizeContent = 拖拽 → 放行写记忆，绝不压回；
  //   · 只有「刚发过 resizeContent、尺寸却不是请求值」才压回（不写记忆）。
  // 记忆只由用户拖拽写，宿主跳变一律不写——「面板一次比一次大」的根，必须焊死。
  var lastResizeEventAt = 0;
  var lastResizeEventSize = null;
  var lastUserDragAt = 0;
  var dragRememberTimer = null;
  var hostJumpFixes = 0;
  var HOST_JUMP_MAX_FIX = 8;
  var DRAG_GAP_MS = 1200;
  var DRAG_SETTLE_MS = 600;
  var SELF_GUARD_MS = 2000;

  function handlePanelResizeEvent() {
    var now = Date.now();
    var size = getPanelClientSize();
    var gap = now - lastResizeEventAt;
    var prev = lastResizeEventSize;
    lastResizeEventAt = now;
    lastResizeEventSize = size;
    if (!size.width || !size.height) {
      return false;
    }
    // 先量单位倍率：后面的「回声判定」「记忆写入」「护栏比对」全都要用它。
    maybeMeasurePanelDipScale(size, now);
    // 全量日志（节流 500ms，离散事件必记）：不能再有盲区，排障全靠这个。
    if (gap >= DRAG_GAP_MS || now - (handlePanelResizeEvent.lastLoggedAt || 0) > 500) {
      handlePanelResizeEvent.lastLoggedAt = now;
      writeBootLog("resize event: " + size.width + "x" + size.height + (gap < DRAG_GAP_MS ? " (stream)" : ""));
    }
    // 弹窗的临时放大/还原、启动收敛都自己管，别插手也不写记忆。
    if (state.suppressSizeMemory || state.startupSizing) {
      return true;
    }
    var ownEcho = isOwnResizeEcho(size, now);
    // 用户拖拽：连续事件流（非回声），尺寸由用户说了算，防抖后写记忆。
    // 阈值 1200ms 是实测值：一次拖拽里相邻事件间隔可到 652ms。
    if (!ownEcho && gap < DRAG_GAP_MS) {
      lastUserDragAt = now;
      scheduleDragMemory();
      return true;
    }
    // 自身 resizeContent 的回声：不写记忆。但只有「没有正在进行的拖拽会话」
    // 时才清 timer——第四版在这里无条件 clearTimeout，用户边拖我们边补时，
    // 已经排好的记忆写盘会被整个吞掉。
    if (ownEcho) {
      if (now - lastUserDragAt > DRAG_GAP_MS && dragRememberTimer) {
        clearTimeout(dragRememberTimer);
        dragRememberTimer = null;
      }
      return false;
    }
    // 尺寸没变 = 心跳事件，不写记忆也不压回。
    var remembered = getRememberedPanelSize(state.panelMode);
    var expected = dipSizeToCss(remembered);
    var devW = expected.width ? Math.abs(1 - size.width / expected.width) : 1;
    var devH = expected.height ? Math.abs(1 - size.height / expected.height) : 1;
    if (devW <= 0.05 && devH <= 0.05) {
      return false;
    }
    // 尺寸变了。宿主补刀有个**确定的因果前提**：我们刚发过 resizeContent。
    // 没有这个前提，运行时改尺寸只可能是用户拖拽——包括拖拽尾巴、中途停顿、
    // 慢速拖拽，以及 CEP 只在松手时发一个 resize 的孤立拖拽
    // （实机日志 10:07:50.173 的 498x803，前一条事件在 36 秒前）。
    // 日志里 6 次 guard 全是误伤拖拽、宿主自发跳变 0 次，所以一律放行 + 写记忆，
    // **绝不压回**。判据用 sinceSelfResize，不再靠「事件间隔」猜谁动的手。
    var sinceSelfResize = state.selfResizeAt ? now - state.selfResizeAt : Infinity;
    if (sinceSelfResize >= SELF_GUARD_MS) {
      lastUserDragAt = now;
      scheduleDragMemory();
      return true;
    }
    // 到这里只剩一种可能：紧跟我们自己的 resizeContent，尺寸却不是请求值 = 宿主补刀。
    // 压回记忆值（也就是我们刚请求的那档），不写记忆——宿主给的尺寸不是用户意愿。
    if (hostJumpFixes >= HOST_JUMP_MAX_FIX) {
      writeBootLog("host resize guard: fix cap reached, keep " + size.width + "x" + size.height);
      return true;
    }
    hostJumpFixes += 1;
    writeBootLog("host resize guard: " + (prev ? prev.width + "x" + prev.height : "?") + " -> " + size.width + "x" + size.height + ", re-apply " + state.panelMode + " " + remembered.width + "x" + remembered.height + ", fix=" + hostJumpFixes);
    setPanelContentSize(remembered);
    return true;
  }

  // 拖拽记忆写盘：只用「当前用户真正看到的尺寸」，并把宽窄模式一并对齐。
  // 第四版在防抖回调里用 selfResizeAt 两秒窗口一刀切丢弃，宿主压回一次之后的
  // 整轮真实拖拽都会白费；现在拖拽会话本身就由 lastUserDragAt 界定，不再需要它。
  function scheduleDragMemory() {
    if (dragRememberTimer) {
      clearTimeout(dragRememberTimer);
    }
    dragRememberTimer = setTimeout(function () {
      dragRememberTimer = null;
      if (state.suppressSizeMemory || state.startupSizing) {
        return;
      }
      var s = getPanelClientSize();
      if (!s.width) {
        return;
      }
      var mode = s.width >= WIDE_LAYOUT_THRESHOLD ? "wide" : "narrow";
      if (mode !== state.panelMode) {
        applyPanelMode(mode);
      }
      rememberPanelSize(mode, s);
      var dip = cssSizeToDip(s);
      writeBootLog("drag settle: remembered " + mode + " " + dip.width + "x" + dip.height + " dip (css " + s.width + "x" + s.height + ")");
    }, DRAG_SETTLE_MS);
  }

  function getRememberedPanelSize(mode) {
    var fallback = mode === "wide"
      ? { width: WIDE_PANEL_WIDTH, height: WIDE_PANEL_HEIGHT }
      : { width: NARROW_PANEL_WIDTH, height: NARROW_PANEL_HEIGHT };
    var saved = state.panelSizes && state.panelSizes[mode];
    return normalizePanelSize(saved, fallback);
  }

  function rememberPanelSize(mode, observedSize) {
    if (mode !== "wide" && mode !== "narrow") {
      return;
    }
    // 存 DIP：观测值先除以倍率，否则下次启动把 CSS 值当 DIP 发回宿主，面板 ×1.5。
    // 拖拽落盘时传入同一个观测值，避免「判模式读一次、写记忆又读一次」中间被插事件。
    var size = cssSizeToDip(observedSize || getPanelClientSize());
    var fallback = getRememberedPanelSize(mode);
    var normalized = normalizePanelSize(size, fallback);
    // 最小档（380×420）也是用户可以停留并记住的窄面板尺寸，不再特殊处理——
    // 以前会跳过它以免「切到最窄」污染记忆，现在 Ai 图标切的就是窄记忆，不存在污染。
    state.panelSizes = state.panelSizes || {};
    state.panelSizes[mode] = normalized;
    savePanelSizes(state.panelSizes);
  }

  function loadPanelSizes() {
    try {
      if (fs.existsSync(PANEL_SIZES_PATH)) {
        var parsed = JSON.parse(fs.readFileSync(PANEL_SIZES_PATH, "utf8"));
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch (err) {}
    // 一次性迁移旧 localStorage 数据到文件。
    var legacy = loadJson(PANEL_SIZES_KEY, null);
    if (legacy && typeof legacy === "object") {
      savePanelSizes(legacy);
      return legacy;
    }
    return null;
  }

  function savePanelSizes(sizes) {
    try {
      ensureFolder(path.dirname(PANEL_SIZES_PATH));
      fs.writeFileSync(PANEL_SIZES_PATH, JSON.stringify(sizes, null, 2), "utf8");
    } catch (err) {}
  }

  function normalizePanelSize(size, fallback) {
    var next = {
      width: parseInt(size && size.width, 10),
      height: parseInt(size && size.height, 10)
    };
    // 只挡损坏数据（0 / NaN / 超出防呆边界），不做「最小尺寸」抬升：
    // 用户拖到 252×279 就记 252×279——任何抬升都会在下次启动变成「自动放大」
    // （2026-11-04 实锤：MIN_PANEL 380 钳位把拖拽记忆偷偷换成 380×420）。
    if (!next.width || next.width < PANEL_SIZE_SANITY_MIN || next.width > PANEL_SIZE_SANITY_MAX_WIDTH) {
      next.width = fallback.width;
    }
    if (!next.height || next.height < PANEL_SIZE_SANITY_MIN || next.height > PANEL_SIZE_SANITY_MAX_HEIGHT) {
      next.height = fallback.height;
    }
    return next;
  }

  function bindEvents() {
    el.refreshBtn.addEventListener("click", function () {
      refresh(t("reasonManual"));
    });

    if (el.panelSizeBtn) {
      el.panelSizeBtn.addEventListener("click", togglePanelSize);
    }

    if (el.favoritesFilterBtn) {
      el.favoritesFilterBtn.addEventListener("click", function () {
        state.activeSourceId = "favorites";
        saveSources();
        renderSources();
        render();
      });
    }

    if (el.defaultSourceBtn) {
      el.defaultSourceBtn.addEventListener("click", function () {
        var defaultSource = getDefaultSource() || state.sources[0];
        if (defaultSource) {
          state.activeSourceId = defaultSource.id;
          saveSources();
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
    if (el.scanDepthInput) {
      el.scanDepthInput.addEventListener("change", onSourceDepthChanged);
    }
    if (el.openFolderBtn) {
      el.openFolderBtn.addEventListener("click", function () {
        openSourceFolder(getActiveSource());
      });
    }
    if (el.changePathBtn) {
      el.changePathBtn.addEventListener("click", function () {
        el.folderInput.readOnly = false;
        el.folderInput.focus();
        el.folderInput.select();
        setToast(t("sourcePathEditHint"), "");
      });
    }
    if (el.advToggleBtn) {
      el.advToggleBtn.addEventListener("click", function () {
        var open = el.advBody.classList.toggle("open");
        el.advToggleBtn.setAttribute("aria-expanded", String(open));
        setText(el.advToggleText, open ? t("sourceAdvCollapse") : t("sourceAdvExpand"));
      });
    }
    bindDropZone();
    bindGlobalFileDrop();
    el.closeSettingsViewBtn.addEventListener("click", closeUtilityViews);
    el.closeAboutViewBtn.addEventListener("click", closeUtilityViews);
    el.saveLanguageBtn.addEventListener("click", saveLanguageFromForm);
    if (el.uiZoomSelect) {
      el.uiZoomSelect.addEventListener("change", function () {
        setStoredValue(UI_ZOOM_KEY, normalizeUiZoom(el.uiZoomSelect.value));
        applyUiZoom();
        setToast(t("uiZoomChanged", { percent: Number(el.uiZoomSelect.value) * 100 }), "ok");
      });
    }
    el.githubLink.addEventListener("click", function (event) {
      event.preventDefault();
      openExternal("https://github.com/haigeplay3d/HGScripts");
    });
    el.folderInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !el.folderInput.readOnly) {
        el.folderInput.readOnly = true;
        autoSaveActiveSource();
      }
    });
    el.folderInput.addEventListener("click", function () {
      if (el.folderInput.readOnly && el.folderInput.value) {
        copyTextToClipboard(el.folderInput.value, t("sourcePathCopied"));
      }
    });
    el.folderInput.addEventListener("blur", function () {
      if (!el.folderInput.readOnly) {
        el.folderInput.readOnly = true;
        autoSaveActiveSource();
      }
    });
    el.sourceNameInput.addEventListener("blur", function () {
      autoSaveActiveSource();
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
        var openTarget = event.target;
        while (openTarget && openTarget !== el.sourceList && !(openTarget.getAttribute && openTarget.getAttribute("data-open-folder"))) {
          openTarget = openTarget.parentNode;
        }
        if (openTarget && openTarget !== el.sourceList) {
          event.stopPropagation();
          openSourceFolder(findSource(openTarget.getAttribute("data-open-folder")));
          return;
        }
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
        setToast(t("modeChanged", { mode: getCppModeHint(state.cppMode) }), "ok");
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
    // CEP 面板是嵌在宿主里的独立渲染视图：点击 Illustrator 画布或其它面板时，
    // 事件根本不会派发到这个 document，上面那句「点击就关」收不到，菜单会一直挂着。
    // 用三个标准 DOM 事件覆盖「离开面板」的所有路径，不依赖 CEP 私有 API：
    //   blur             — 面板窗口失去键盘焦点（点到宿主任意位置）
    //   mouseleave       — 指针移出面板可视区；blur 未派发时的兜底，也先于点击触发
    //   visibilitychange — 面板被折叠 / 隐藏
    window.addEventListener("blur", hideContextMenu);
    document.documentElement.addEventListener("mouseleave", hideContextMenu);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        hideContextMenu();
      }
    });
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
      // 先过护栏：用户拖拽 → 防抖写记忆；宿主自己改尺寸 → 压回记忆尺寸，不写记忆。
      // 护栏接管的那轮不进 syncPanelModeFromWidth，避免宿主给的尺寸被当用户意愿。
      var handled = handlePanelResizeEvent();
      if (!handled) {
        syncPanelModeFromWidth();
      }
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
      el.consoleOutput.textContent = t("consoleCleared");
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
        appendConsole(t("legacyAceLoadFailed"));
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
            appendConsole(t("legacyAceLoaded"));
          } catch (errAce) {
            writeBootLog("legacy Ace init failed: " + (errAce && errAce.stack ? errAce.stack : errAce));
            appendConsole(t("legacyAceInitFailed"));
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
      name: inferSourceName(DEFAULT_FOLDER),
      folder: DEFAULT_FOLDER,
      enabled: true
    }];
  }

  /* 语言中立的目录显示名：默认目录永远按当前语言实时取词，不读缓存名，
     避免历史版本把「默认脚本 / Default Scripts」写进 sources 后切语言不重译；
     用户自定义目录保留其原始 name，不做翻译。 */
  function displaySourceName(source) {
    if (!source) {
      return "";
    }
    if (isDefaultSource(source)) {
      return t("sourceDefaultName");
    }
    return source.name || inferSourceName(source.folder);
  }

  /* 保存侧配套：默认目录的名称永远不持久化语言相关占位（输入框里显示的
     「默认脚本 / Default Scripts」只是展示词），统一回落为路径推断的中立名；
     自定义目录保持原行为（用户输入名优先，空则取文件夹名）。 */
  function resolveSourceNameOnSave(source, inputName, folder) {
    if (isDefaultSource(source)) {
      return inferSourceName(folder);
    }
    return inputName || inferSourceName(folder);
  }

  function normalizeSources(sources) {
    var result = [];
    for (var i = 0; i < sources.length; i++) {
      if (!sources[i] || !sources[i].folder) {
        continue;
      }
      var isDefault = isDefaultSource(sources[i]);
      result.push({
        /* 默认目录不再把语言相关名称写进持久化数据：历史上这里每次都被
           t("sourceDefaultName") 覆盖，用户自定义名在默认目录上本就留不住，
           因此统一改存路径推断的中立名；界面显示走 displaySourceName() 实时取词。 */
        id: sources[i].id || makeId(),
        name: isDefault ? inferSourceName(sources[i].folder) : (sources[i].name || inferSourceName(sources[i].folder)),
        folder: normalizeDefaultSourceFolder(sources[i]),
        scanDepth: sources[i].scanDepth,
        enabled: sources[i].enabled !== false
      });
    }
    return result.length ? result : [{
      id: makeId(),
      name: inferSourceName(DEFAULT_FOLDER),
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
      setToast(t("sourceMigrateFailed", { error: err.message }), "warn");
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
    addSourceTab("all", t("all"), state.activeSourceId === "all");

    for (var i = 0; i < state.sources.length; i++) {
      if (defaultSource && state.sources[i].id === defaultSource.id) {
        continue;
      }
      addSourceTab(state.sources[i].id, displaySourceName(state.sources[i]), state.sources[i].id === state.activeSourceId);
    }

    if (el.favoritesFilterBtn) {
      el.favoritesFilterBtn.classList.toggle("active", state.activeSourceId === "favorites");
    }
    if (el.defaultSourceBtn) {
      el.defaultSourceBtn.classList.toggle("active", !!defaultSource && state.activeSourceId === defaultSource.id);
      el.defaultSourceBtn.disabled = !defaultSource;
      el.defaultSourceBtn.title = defaultSource ? t("sourceSwitchTo", { name: displaySourceName(defaultSource) }) : t("sourceNoDefault");
    }

    if (activeSource) {
      el.sourceNameInput.value = displaySourceName(activeSource);
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
    syncSourceDetail();
  }

  function syncSourceDetail() {
    var source = getActiveSource();
    syncSourceDetailHint(source);
    if (el.scanDepthInput && source) {
      el.scanDepthInput.value = String(getSourceScanDepth(source));
    }
    if (el.folderInput) {
      el.folderInput.readOnly = true;
      el.folderInput.title = el.folderInput.value + " · " + t("sourcePathLabel");
    }
    updateSourceEmptyNote(source);
  }

  /* 详情区 hint 同时含固定文案与动态目录名（HTML 里是中文硬编码占位），
     按当前语言用文本节点重新拼装；b 节点对象本身复用，缓存引用 el.sourceDetailName 不失效。 */
  function syncSourceDetailHint(source) {
    var hint = queryOne(".source-detail-section .source-section-hint");
    if (!hint || !el.sourceDetailName) {
      return;
    }
    el.sourceDetailName.textContent = source ? displaySourceName(source) : "—";
    hint.innerHTML = "";
    hint.appendChild(document.createTextNode(t("sourceDetailHint") + (isEnglishUi() ? ": " : "：")));
    hint.appendChild(el.sourceDetailName);
    hint.appendChild(document.createTextNode(isEnglishUi() ? " " : "　"));
    var em = document.createElement("em");
    em.textContent = t("sourceAutoSaveHint");
    hint.appendChild(em);
  }

  function updateSourceEmptyNote(source) {
    if (!el.sourceEmptyNote) {
      return;
    }
    if (!source || !el.sourceModal.classList.contains("open")) {
      setSourceEmptyNote("");
      return;
    }
    var folder = source.folder;
    if (!folder || !fs.existsSync(folder)) {
      setSourceEmptyNote(t("sourceEmptyMissing"));
      return;
    }
    var topFiles = 0;
    var hasSub = false;
    try {
      var names = fs.readdirSync(folder);
      for (var i = 0; i < names.length; i++) {
        var st = fs.statSync(path.join(folder, names[i]));
        if (st.isDirectory()) {
          if (!isIgnoredFolder(names[i])) {
            hasSub = true;
          }
        } else if (SCRIPT_EXTENSIONS[path.extname(names[i]).toLowerCase()]) {
          topFiles++;
        }
      }
    } catch (err) {}
    if (topFiles === 0 && hasSub && getSourceScanDepth(source) === 0) {
      setSourceEmptyNote(t("sourceEmptyDepth"));
    } else if (topFiles === 0 && !hasSub) {
      setSourceEmptyNote(t("sourceEmptyNoJsx"));
    } else {
      setSourceEmptyNote("");
    }
  }

  function setSourceEmptyNote(message) {
    if (!el.sourceEmptyNote) {
      return;
    }
    el.sourceEmptyNote.hidden = !message;
    el.sourceEmptyNote.textContent = message || "";
  }

  function getSourceScanDepth(source) {
    return normalizeScanDepth(source && source.scanDepth, settings.scanDepth);
  }

  function onSourceDepthChanged() {
    var source = getActiveSource();
    if (!source) {
      setToast(t("sourceNeedSpecific"), "warn");
      return;
    }
    source.scanDepth = normalizeScanDepth(el.scanDepthInput.value, DEFAULT_SETTINGS.scanDepth);
    saveSources();
    refresh(t("reasonFolderSaved"));
    renderSources();
    setToast(t("sourceDepthSaved"), "ok");
  }

  function autoSaveActiveSource() {
    var source = getActiveSource();
    if (!source) {
      return;
    }
    var folder = normalizeInputPath(el.folderInput.value);
    var name = el.sourceNameInput.value.trim();
    if (!folder || !fs.existsSync(folder)) {
      return;
    }
    for (var i = 0; i < state.sources.length; i++) {
      if (state.sources[i].id !== source.id && makeFileKey(state.sources[i].folder) === makeFileKey(folder)) {
        setToast(t("sourceDuplicate"), "warn");
        return;
      }
    }
    var resolvedName = resolveSourceNameOnSave(source, name, folder);
    if (resolvedName === source.name && makeFileKey(folder) === makeFileKey(source.folder)) {
      return;
    }
    source.name = resolvedName;
    source.folder = folder;
    saveSources();
    renderSources();
    refresh(t("reasonFolderSaved"));
    setToast(t("sourceAutoSaved"), "ok");
  }

  function pathToFileUrl(fsPath) {
    var normalized = String(fsPath || "").replace(/\\/g, "/");
    if (/^file:\/\//i.test(normalized)) {
      return normalized;
    }
    // Windows: X:/dir/中文 -> file:///X:/dir/%E4%B8%AD%E6%96%87
    return "file:///" + encodeURI(normalized.replace(/^\/+/, ""));
  }

  function openSourceFolder(source) {
    if (!source || !source.folder) {
      return;
    }
    if (!fs.existsSync(source.folder)) {
      setToast(t("sourceFolderMissing"), "error");
      return;
    }
    var folder = normalizeFsPath(source.folder);
    // 走宿主 ExtendScript 的 Folder.execute()：在 Illustrator/Photoshop 主进程的
    // 桌面会话里打开资源管理器，不受 CEP/CEF child_process 的 GUI 限制。
    // 实测此环境下 child_process（explorer.exe / cmd start）虽返回成功但窗口不出现，
    // openURLInDefaultBrowser 同样不弹窗，只有宿主原生 API 可靠。
    var jsLiteral = '"' + folder.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    var opened = false;
    if (cs && typeof cs.evalScript === "function") {
      try {
        cs.evalScript("HGScripts.openFolder(" + jsLiteral + ")", function (result) {
          var ok = typeof result === "string" && result.indexOf("OK") === 0;
          if (ok) {
            setToast(t("sourceOpenFolderToast", { name: displaySourceName(source) }), "ok");
          } else {
            setToast(t("openFolderFailed") + ": " + result, "error");
          }
        });
        opened = true;
      } catch (e) {
        opened = false;
      }
    }
    if (opened) {
      return;
    }
    // 兜底：ExtendScript 通道不可用时退回 child_process。
    try {
      childProcess.execFile("cmd.exe", ["/c", "start", "", folder], { windowsHide: true }, function (err) {
        if (err) {
          setToast(friendlyError(t("openFolderFailed"), err), "error");
          return;
        }
        setToast(t("sourceOpenFolderToast", { name: displaySourceName(source) }), "ok");
      });
    } catch (err) {
      setToast(friendlyError(t("openFolderFailed"), err), "error");
    }
  }

  function copyTextToClipboard(text, okMessage) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setToast(okMessage, "ok");
    } catch (err) {
      setToast(t("copyFailed", { error: err.message }), "warn");
    }
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
    // 三段式目录弹窗在窄面板里放不下（路径行、拖拽区、字段都会被裁掉）。
    // 规则：窄面板打开时切到「宽面板记忆」（按海哥 2026-11-04 的决定不设下限，
    // 记忆多宽就切多宽）；已经是宽面板就沿用当前状态，不做任何切换。
    // 关闭时（按钮 / 遮罩 / Esc 三种都走 closeSourceModal）回到「窄面板记忆」。
    if (!isWidePanel()) {
      // 记 DIP（不是 CSS）：关闭弹窗时这个值要原样发回 resizeContent。
      var current = cssSizeToDip(getPanelClientSize());
      state.sizeBeforeSourceModal = {
        mode: state.panelMode,
        width: current.width,
        height: current.height
      };
      // 弹窗的临时放大 / 还原都不写进用户记忆（suppressSizeMemory），
      // 否则宽记忆会被覆盖，用户拖出来的尺寸就丢了。
      state.suppressSizeMemory = true;
      resizePanel("wide", true);
    } else {
      state.sizeBeforeSourceModal = null;
    }
    el.sourceModal.classList.add("open");
    updateSourceEmptyNote(getActiveSource());
    el.folderInput.focus();
  }

  function closeSourceModal() {
    var wasOpen = el.sourceModal.classList.contains("open");
    el.sourceModal.classList.remove("open");
    var previous = state.sizeBeforeSourceModal;
    state.sizeBeforeSourceModal = null;
    if (!wasOpen || !previous) {
      // 从宽面板打开的弹窗：按规则「沿用当前状态」，不还原、不切换。
      state.suppressSizeMemory = false;
      return;
    }
    // 从窄面板打开的：回到窄面板记忆（用户上次拖出来的窄尺寸）。
    var narrowSize = getRememberedPanelSize("narrow");
    applyPanelMode("narrow");
    try {
      setPanelContentSize({
        width: previous.width || narrowSize.width,
        height: previous.height || narrowSize.height
      });
    } catch (err) {
      writeBootLog("restore panel size after source modal failed: " + (err && err.message));
    }
    setTimeout(function () {
      state.suppressSizeMemory = false;
      if (state.ace) {
        state.ace.resize(true);
      }
    }, 320);
  }

  function openCreateModal(defaultName, defaultSubdir) {
    el.newScriptNameInput.value = defaultName || uniqueScriptBase((getActiveSource() || getDefaultSource() || state.sources[0]).folder, NEW_SCRIPT_FILENAME_BASE);
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
    el.recentSourceSelect.innerHTML = "<option value=\"\">" + escapeHtml(t("sourceRecentPlaceholder")) + "</option>";
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
      empty.textContent = t("sourceEmpty");
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
      name.textContent = displaySourceName(source);
      head.appendChild(name);

      if (isActive) {
        head.appendChild(makeSourceBadge(t("badgeCurrent")));
      }
      if (isDefault) {
        head.appendChild(makeSourceBadge(t("badgeDefault")));
      }
      if (!exists) {
        head.appendChild(makeSourceBadge(t("badgeMissing")));
      }

      var meta = document.createElement("span");
      meta.className = "source-list-meta";
      meta.textContent = t("sourceCount", { n: counts[source.id] || 0 }) + " · " + t("sourceDepthBadge", { n: getSourceScanDepth(source) });
      head.appendChild(meta);

      var pathText = document.createElement("span");
      pathText.className = "source-list-path";
      pathText.textContent = source.folder || "";

      var openBtn = document.createElement("span");
      openBtn.className = "source-list-open";
      openBtn.setAttribute("data-open-folder", source.id);
      openBtn.setAttribute("role", "button");
      openBtn.setAttribute("tabindex", "0");
      openBtn.textContent = t("sourceOpenFolder");
      button.appendChild(head);
      button.appendChild(pathText);
      button.appendChild(openBtn);
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
    syncSourceDetail();
    el.ignoredDirsInput.value = (settings.ignoredDirs || []).join(",");
    el.languageSelect.value = normalizeLanguageMode(settings.languageMode);
    if (el.uiZoomSelect) {
      el.uiZoomSelect.value = normalizeUiZoom(getStoredValue(UI_ZOOM_KEY, "1"));
    }
    renderLanguageHint();
  }

  function saveSettingsFromForm() {
    settings.ignoredDirs = parseIgnoredDirs(el.ignoredDirsInput.value);
    saveSettings();
    refresh(t("reasonSettingsSaved"));
    startWatchers();
  }

  function saveLanguageFromForm() {
    settings.languageMode = normalizeLanguageMode(el.languageSelect.value);
    effectiveLanguage = resolveEffectiveLanguage(settings.languageMode, hostLanguage);
    if (HGI) {
      HGI.setLanguage(effectiveLanguage);
    }
    saveSettings();
    applyLanguageMode(true);
  }

  function applyLanguageMode(showNotice) {
    settings.languageMode = normalizeLanguageMode(settings.languageMode);
    effectiveLanguage = resolveEffectiveLanguage(settings.languageMode, hostLanguage);
    if (HGI) {
      HGI.setLanguage(effectiveLanguage);
    }
    if (el.languageSelect) {
      el.languageSelect.value = settings.languageMode;
    }
    translateStaticUi();
    renderLanguageHint();
    renderCppMode();
    setupPanelMenu();
    renderSources();
    refresh(t("languageRefreshReason"));
    if (showNotice) {
      setToast(t("languageSavedTo", { lang: effectiveLanguage === "zh-CN" ? t("chinese") : t("english") }), "ok");
    }
  }

  function renderLanguageHint() {
    if (!el.languageHint) {
      return;
    }
    var hostText = hostLanguage === "zh-CN" ? t("chinese") : t("english");
    var modeText = settings.languageMode === "auto" ? t("auto") : (settings.languageMode === "zh-CN" ? t("chinese") : t("english"));
    var effectiveText = effectiveLanguage === "zh-CN" ? t("chinese") : t("english");
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
    setText(el.favoritesFilterBtn, isEnglishUi() ? t("favoritesShort") : t("favorites"));
    setAttr(el.favoritesFilterBtn, "title", t("favoritesTitle"));
    setText(el.defaultSourceBtn, t("defaultSource"));
    setAttr(el.defaultSourceBtn, "title", t("defaultSourceTitle"));
    setText(el.quickCreateScriptBtn, t("newScript"));
    setText(el.toggleSourcesBtn, isEnglishUi() ? t("addFolderShort") : t("addFolder"));
    setAttr(el.toggleSourcesBtn, "title", t("addFolderTitle"));
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
    setAttr(el.editorTitleInput, "title", t("editorNameTitle"));
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
    if (el.consoleOutput && (el.consoleOutput.textContent === t("waitingResult") || el.consoleOutput.textContent === "Waiting for run results.")) {
      el.consoleOutput.textContent = t("waitingResult");
    }
    setText(queryOne("#settingsView .view-head h2"), t("settings"));
    setText(queryOne("#settingsView .view-head p"), t("settingsSub"));
    setText(el.closeSettingsViewBtn, t("back"));
    setAttr(el.closeSettingsViewBtn, "title", t("backTitle"));
    setText(queryOne(".settings-panel label[for='languageSelect']"), t("language"));
    syncLanguageLabels();
    setText(queryOne(".settings-panel label[for='uiZoomSelect']"), t("uiZoom"));
    setText(queryOne("#uiZoomSelect + p.setting-hint"), t("uiZoomHint"));
    setText(el.saveLanguageBtn, t("saveLanguage"));
    setText(queryOne("#aboutView .view-head h2"), t("about"));
    setText(el.closeAboutViewBtn, t("back"));
    setAttr(el.closeAboutViewBtn, "title", t("backTitle"));
    syncAboutLabels();
    syncUpdateControls();
    if (state.appVersion) {
      document.title = t("appTitle", { version: state.appVersion });
    }
    if (el.toast && HGI && HGI.TEXT && HGI.TEXT.ready) {
      var readyPair = HGI.TEXT.ready;
      if (!el.toast.textContent || el.toast.textContent === readyPair[0] || el.toast.textContent === readyPair[1]) {
        setText(el.toast, t("ready"));
      }
    }
    if (!state.selectedPath) {
      setText(el.selectedMetaBar, t("noSelection"));
    }
    setText(queryOne(".source-modal .modal-head h2"), t("sourceManager"));
    setText(el.closeSourcesBtn, t("close"));
    setAttr(el.closeSourcesBtn, "title", t("sourceManagerCloseTitle"));
    setAttr(el.sourceNameInput, "placeholder", t("sourceAlias"));
    setAttr(el.folderInput, "placeholder", t("folderPath"));
    setAttr(el.folderInput, "title", t("sourcePathInputTitle"));
    setText(el.addSourceBtn, t("addFolderDialog"));
    setAttr(el.addSourceBtn, "title", t("sourceAddBtnTitle"));
    setText(el.saveSourceBtn, t("saveChanges"));
    setText(el.removeSourceBtn, t("removeFromList"));
    setAttr(el.ignoredDirsInput, "placeholder", t("ignoredDirs"));
    setText(el.saveSettingsBtn, t("saveSettings"));
    setText(el.chooseBtn, t("sourceAddScriptFile"));
    setAttr(el.chooseBtn, "title", t("sourceChooseBtnTitle"));
    setText(el.changePathBtn, t("sourceChangePath"));
    setAttr(el.changePathBtn, "title", t("sourceChangePathTitle"));
    setText(el.openFolderBtn, t("sourceOpenFolder"));
    setAttr(el.openFolderBtn, "title", t("sourceOpenFolderTitle"));
    setText(queryOne(".source-list-section .source-section-hint"), t("sourceSectionHint"));
    setText(queryOne(".source-advanced-section .source-adv-head > span"), t("sourceAdvHead"));
    setText(el.dropZone, t("sourceDragHint"));
    setAttr(el.removeSourceBtn, "title", t("sourceRemoveTitle"));
    setText(queryOne(".added-sources-title"), t("addedSources"));
    /* 详情区三个字段标签：显示名称 / 扫描范围 / 路径（点击可复制），
       只取 .source-detail-section 内的 span，避免误改高级区「忽略目录」。 */
    var detailFieldSpans = document.querySelectorAll(".source-detail-section .source-field > span");
    if (detailFieldSpans.length >= 3) {
      setText(detailFieldSpans[0], t("sourceNameLabel"));
      setText(detailFieldSpans[1], t("sourceDepthLabel"));
      setText(detailFieldSpans[2], t("sourcePathLabel"));
    }
    /* 高级区头部「展开 / 收起」初始态与当前 aria-expanded 保持一致。 */
    if (el.advToggleBtn && el.advToggleText) {
      var advOpen = el.advToggleBtn.getAttribute("aria-expanded") === "true";
      setText(el.advToggleText, advOpen ? t("sourceAdvCollapse") : t("sourceAdvExpand"));
    }
    setText(queryOne(".source-adv-hint"), t("sourceAdvHint"));
    setText(queryOne(".source-advanced-section .source-field > span"), t("sourceIgnoredLabel"));
    syncScanDepthLabels();
    syncSourceDetailHint(getActiveSource());
    setText(queryOne(".create-modal .modal-head h2"), t("newScript"));
    setText(el.closeCreateBtn, t("close"));
    setAttr(el.closeCreateBtn, "title", t("sourceCreateCloseTitle"));
    setAttr(el.newScriptNameInput, "placeholder", t("newScriptName"));
    syncCreateDocLabel();
    setAttr(queryOne(".create-form label"), "title", t("sourceCreateDocTitle"));
    setText(el.createScriptBtn, t("create"));
    setAttr(el.createScriptBtn, "title", t("sourceNewScriptTitle"));
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
    button.title = id === "all" ? t("showAllFolders") : (id === "favorites" ? t("favoritesTitle") : label);
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
      var picked = openWindowsFolderDialog(getDialogStartPath(), t("sourcePickFolder"));
      if (picked) {
        setFolderInput(picked);
      }
    } catch (err) {
      setToast(t("sourceOpenFolderFailed", { error: err.message }), "error");
    }
  }

  function chooseAndAddSourceWithWindowsDialog() {
    try {
      var picked = openWindowsFolderDialog(getDialogStartPath(), t("sourceAddFolderTitle"));
      if (picked) {
        setFolderInput(picked);
        addSourceFromPath(picked);
      }
    } catch (err) {
      setToast(t("sourceOpenFolderFailed", { error: err.message }), "error");
    }
  }

  function chooseScriptWithWindowsDialog() {
    try {
      var picked = openWindowsFileDialog(getDialogStartPath(), t("sourcePickJsx"), t("sourceJsxFilter"));
      if (picked) {
        var folder = path.dirname(picked);
        setFolderInput(folder);
        addSourceFromPath(folder);
      }
    } catch (err) {
      setToast(t("sourceOpenJsxFailed", { error: err.message }), "error");
    }
  }

  function chooseCurrentDocumentFolder() {
    cs.evalScript("HGScripts.getActiveDocumentFolder()", function (resultPath) {
      if (!resultPath || String(resultPath).indexOf("ERROR:") === 0) {
        setToast(resultPath || t("sourceNoDocFolder"), "warn");
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
    if (!el.dropZone) {
      return;
    }
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
      handleDroppedPaths(event.dataTransfer && event.dataTransfer.files);
    });
  }

  /* CEF 默认把拖进面板的文件当成导航目标：拖一个 .jsx 进来会整页打开成纯文本，
     面板 UI 全部被替换掉（只宿主的标题栏还在）。必须在 window 捕获阶段拦掉默认行为，
     并让「拖到面板任意位置」等价于「拖到脚本目录弹窗里的拖放区」。
     注意：窄面板下 .source-drop-zone 被 CSS 隐藏，全局入口是唯一可用的拖放入口。 */
  function bindGlobalFileDrop() {
    if (!document.body) {
      return;
    }
    var hint = document.createElement("div");
    hint.className = "hg-file-drop-hint";
    hint.setAttribute("aria-hidden", "true");
    document.body.appendChild(hint);

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
    function showHint() {
      var label = t("sourceDropAnywhereHint");
      if (hint.textContent !== label) {
        hint.textContent = label;
      }
      document.body.classList.add("hg-file-drag-active");
    }
    function hideHint() {
      document.body.classList.remove("hg-file-drag-active");
    }
    window.addEventListener("dragenter", function (event) {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      showHint();
    }, true);
    window.addEventListener("dragover", function (event) {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      showHint();
    }, true);
    window.addEventListener("drop", function (event) {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      hideHint();
      // 弹窗里的拖放区有自己的处理逻辑，这里只负责阻止导航，避免重复添加。
      if (el.dropZone && event.target && el.dropZone.contains(event.target)) {
        return;
      }
      handleDroppedPaths(event.dataTransfer.files);
    }, true);
    window.addEventListener("dragleave", function (event) {
      if (!event.relatedTarget) {
        hideHint();
      }
    }, true);
    window.addEventListener("dragend", hideHint, true);
    window.addEventListener("blur", hideHint);
    window.addEventListener("resize", hideHint);
    document.documentElement.addEventListener("mouseleave", hideHint);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        hideHint();
      }
    });
  }

  function handleDroppedPaths(files) {
    if (!files || !files.length) {
      return;
    }
    var added = 0;
    for (var i = 0; i < files.length; i++) {
      var droppedPath = files[i] && files[i].path;
      if (!droppedPath) {
        continue;
      }
      var folder = resolveDroppedSourcePath(droppedPath);
      if (!folder) {
        continue;
      }
      // 不先写输入框，addSourceFromPath 会把「当前目录的显示名」安到新目录上。
      setFolderInput(folder);
      addSourceFromPath(folder);
      added++;
    }
    if (!added) {
      setToast(t("sourceDropUnsupported"), "warn");
    }
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
      setToast(t("sourceFolderEmpty"), "warn");
      return;
    }
    if (!fs.existsSync(folder)) {
      setToast(t("sourceFolderMissing"), "error");
      return;
    }
    for (var i = 0; i < state.sources.length; i++) {
      if (makeFileKey(state.sources[i].folder) === makeFileKey(folder)) {
        state.activeSourceId = state.sources[i].id;
        setFolderInput(folder);
        saveSources();
        renderSources();
        render();
        setToast(t("sourceFolderExists"), "");
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
    refresh(t("reasonFolderAdded"));
    startWatchers();
  }

  function saveActiveSourceFromInput() {
    var source = getActiveSource();
    if (!source) {
      setToast(t("sourceNeedSpecific"), "warn");
      return;
    }

    var folder = normalizeInputPath(el.folderInput.value);
    if (!folder) {
      setToast(t("sourceFolderEmpty"), "warn");
      return;
    }
    if (!fs.existsSync(folder)) {
      setToast(t("sourceFolderMissing"), "error");
      return;
    }
    for (var i = 0; i < state.sources.length; i++) {
      if (state.sources[i].id !== source.id && makeFileKey(state.sources[i].folder) === makeFileKey(folder)) {
        setToast(t("sourceDuplicate"), "warn");
        return;
      }
    }
    source.name = resolveSourceNameOnSave(source, el.sourceNameInput.value.trim(), folder);
    source.folder = folder;
    addRecentSource(folder);
    saveSources();
    renderSources();
    refresh(t("reasonFolderSaved"));
    startWatchers();
  }

  function removeActiveSource() {
    var source = getActiveSource();
    if (!source || state.sources.length <= 1) {
      setToast(t("sourceKeepOne"), "warn");
      return;
    }

    if (!window.confirm(t("sourceConfirmRemove", { name: displaySourceName(source) }))) {
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
    refresh(t("reasonFolderRemoved"));
    startWatchers();
  }

  function createNewScript() {
    var source = getActiveSource();
    if (!source) {
      source = getDefaultSource() || state.sources[0];
    }

    var base = sanitizeBaseName(el.newScriptNameInput.value);
    if (!base) {
      setToast(t("sourceNameEmpty"), "warn");
      el.newScriptNameInput.focus();
      return;
    }

    var targetFolder = source.folder;
    var scriptPath = path.join(targetFolder, base + ".jsx");
    var docPath = path.join(targetFolder, base + ".md");
    var enDocPath = path.join(targetFolder, base + ".en.md");

    if (fs.existsSync(scriptPath)) {
      setToast(t("sourceScriptExists"), "error");
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
      setToast(t("sourceCreated", { name: base + ".jsx" }), "ok");
      refresh(t("reasonScriptCreated"));
      selectItem(scriptPath);
      openCodeEditor(scriptPath);
    } catch (err) {
      setToast(t("sourceCreateFailed", { error: err.message }), "error");
    }
  }

  function quickCreateScript() {
    var source = getActiveSource() || getDefaultSource() || state.sources[0];
    if (!source) {
      setToast(t("noSourceAvailable"), "warn");
      return;
    }
    openCreateModal(uniqueScriptBase(source.folder, NEW_SCRIPT_FILENAME_BASE), "");
  }

  function uniqueScriptBase(folder, base) {
    var candidate = sanitizeBaseName(base) || NEW_SCRIPT_FILENAME_BASE;
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
    updateSourceEmptyNote(getActiveSource());
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
      el.folderHint.textContent = t("folderHintNone", { host: HOST_PROFILE.label });
      setToast(t("folderMissingChoose"), "error");
    } else {
      el.folderHint.textContent = t("folderHintSummary", {
        host: HOST_PROFILE.label,
        sources: state.sources.length,
        files: files.length
      }) + (missing.length ? t("folderHintMissing", { n: missing.length }) : "");
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
    scanDirectory(source, source.folder, 0, files, snapshot, getSourceScanDepth(source));
  }

  function scanDirectory(source, folder, depth, files, snapshot, maxDepth) {
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
        if (depth < maxDepth && !isIgnoredFolder(name)) {
          scanDirectory(source, fullPath, depth + 1, files, snapshot, maxDepth);
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
          doc = t("docReadFailed", { error: errDoc.message });
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
    setIdleStatus(t("statusCount", { shown: list.length, total: state.files.length }));
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
      // title 会被悬浮提示层搬走（见 adoptTitles）：选中态 / 运行态判据不能依赖它，
      // 路径另存一份纯数据属性。
      row.setAttribute("data-hg-path", item.fullPath);
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
      var showCppBoost = shouldShowScriptBoostBadge(item);
      var tags = row.querySelector(".script-tags");
      // 右侧第一槽位固定存在，保证说明/闪电/空白三种状态下列宽对齐：
      //   1. 有同名 .md：仍是说明按钮；C++ 脚本只把图标替换为闪电，点击仍打开说明
      //   2. 无 .md 但有 C++：只显示闪电状态，不制造可点击的说明按钮
      //   3. 两者都没有：同尺寸空白占位，不出现第三个按钮
      if (item.hasDoc) {
        var docButton = document.createElement("button");
        docButton.className = "doc-icon-btn";
        docButton.title = showCppBoost
          ? t("editDoc") + "\n" + t("cppDocBoost") + "\n" + getCppBoostBadgeTitle()
          : t("editDoc");
        docButton.innerHTML = "<img class=\"doc-icon-img\" src=\"" + (showCppBoost ? CPP_BOOST_ICON_SRC : DOC_ICON_SRC) + "\" alt=\"\" aria-hidden=\"true\">";
        docButton.addEventListener("click", function (event) {
          event.stopPropagation();
          if (selectItem(item.fullPath)) {
            editSelectedDoc(item);
          }
        });
        tags.appendChild(docButton);
      } else if (showCppBoost) {
        var cppBoostBadge = document.createElement("span");
        cppBoostBadge.className = "cpp-boost-badge";
        cppBoostBadge.title = t("cppDocBoost") + "\n" + getCppBoostBadgeTitle();
        cppBoostBadge.innerHTML = "<img class=\"cpp-boost-img\" src=\"" + CPP_BOOST_ICON_SRC + "\" alt=\"\" aria-hidden=\"true\">";
        tags.appendChild(cppBoostBadge);
      } else {
        var docPlaceholder = document.createElement("span");
        docPlaceholder.className = "doc-icon-placeholder";
        docPlaceholder.setAttribute("aria-hidden", "true");
        tags.appendChild(docPlaceholder);
      }
      var star = document.createElement("button");
      var favorited = !!state.favorites[item.key];
      star.className = "star" + (favorited ? " favorited" : "");
      star.title = favorited ? t("starRemove") : t("starAdd");
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
        clearDetail(t("scriptMoved"));
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
      chip.title = t("sceneFilter", { label: getSceneLabel(scene.id) });
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
      hint.textContent = t("sceneQuickEmpty");
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
      button.querySelector("span").textContent = state.favorites[item.key] ? t("favorites") : (stat.count ? t("sceneRunTimes", { n: stat.count }) : getSceneLabel(getItemSceneId(item)));
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
    return scene ? getSceneLabel(scene.id) + " " + (scene.aliases || []).join(" ") : "";
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
    return HGI ? HGI.sceneLabel(sceneId) : sceneId;
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
    setToast(t("toastSelected", { name: getScriptDisplayName(item) }), "");
  }

  function renderListActiveOnly() {
    var rows = el.scriptList.querySelectorAll(".script-item");
    for (var i = 0; i < rows.length; i++) {
      var rowPath = rows[i].getAttribute("data-hg-path") || "";
      rows[i].classList.toggle("active", rowPath === state.selectedPath);
      var isRunningRow = !!state.running && !!state.runningPath && makeFileKey(rowPath) === makeFileKey(state.runningPath);
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
      el.switchTitle.textContent = state.pendingSwitchKind === "doc" ? t("unsavedDoc") : t("unsavedScript");
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
      setToast(t("toastCancelledSwitch"), "");
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

  function buildMetaText(item) {
    if (!item) {
      return "";
    }
    var runText = getRunText(item);
    var text = item.mtimeText + " · " + formatSize(item.size);
    if (runText) {
      text += " · " + runText;
    }
    return text;
  }

  function updateSelectedMeta(item, runText) {
    if (!el.selectedMetaBar) {
      return;
    }
    if (!item) {
      el.selectedMetaBar.textContent = t("noSelection");
      return;
    }
    // 状态栏右侧已腾空，留给「脚本/插件运行提示区」；文件元信息移到详情/编辑器的路径下方。
    el.selectedMetaBar.textContent = "";
    el.selectedMetaBar.title = item.fullPath;
  }

  function getRunText(item) {
    var stat = getRunStat(item.key);
    return stat.lastRun ? t("metaLastRun", { time: formatTime(new Date(stat.lastRun)), n: stat.count }) : "";
  }

  function showDetail(item) {
    var runText = getRunText(item);
    el.detailTitle.textContent = getScriptDisplayName(item);
    el.detailMeta.textContent = item.fullPath;
    el.detailMetaInfo.textContent = buildMetaText(item);
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
    el.detailTitle.textContent = message || t("selectScript");
    el.detailMeta.textContent = "";
    el.detailMetaInfo.textContent = "";
    updateSelectedMeta(null);
    el.renameInput.value = "";
    el.renameInput.disabled = true;
    el.renameBtn.disabled = true;
    if (el.favoriteBtn) {
      el.favoriteBtn.disabled = true;
      el.favoriteBtn.textContent = "☆";
    }
    state.docLoading = true;
    el.detailDoc.value = t("docPlaceholder");
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
      setToast(t("toastUnfavorited", { name: getScriptDisplayName(item) }), "");
    } else {
      state.favorites[item.key] = {
        name: item.name,
        sourceName: item.sourceName,
        time: Date.now()
      };
      setToast(t("toastFavorited", { name: getScriptDisplayName(item) }), "ok");
    }
    setStoredValue(FAVORITES_KEY, state.favorites);
    showDetail(item);
    render();
  }

  function saveSelectedDoc(callback) {
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast(t("needScript"), "warn");
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
      setToast(t("docSaved", { name: path.basename(savePath) }), "ok");
      refresh(t("reasonDocSaved"));
      selectItem(item.fullPath, { force: true });
      if (callback) {
        callback(true);
      }
    } catch (err) {
      setToast(t("docSaveFailed", { error: err.message }), "error");
      if (callback) {
        callback(false);
      }
    }
  }

  function renameSelected() {
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast(t("needScript"), "warn");
      return;
    }

    var nextName = sanitizeScriptFileName(el.renameInput.value, item.ext);
    if (!nextName.base) {
      setToast(t("renameEmpty"), "warn");
      return;
    }
    if (nextName.name === item.name) {
      setToast(t("renameUnchanged"), "");
      return;
    }

    var targetFolder = item.scriptFolder || item.sourceFolder;
    var nextScriptPath = path.join(targetFolder, nextName.name);
    var nextDocPath = path.join(targetFolder, nextName.base + ".md");
    var nextEnDocPath = path.join(targetFolder, nextName.base + ".en.md");
    if (fs.existsSync(nextScriptPath)) {
      setToast(t("renameExists"), "error");
      return;
    }
    if (item.hasZhDoc && fs.existsSync(nextDocPath)) {
      setToast(t("renameDocExists"), "error");
      return;
    }
    if (item.hasEnDoc && fs.existsSync(nextEnDocPath)) {
      setToast(t("renameEnDocExists"), "error");
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
      setToast(t("renameDone", { name: nextName.name }), "ok");
      refresh(t("reasonScriptRenamed"));
      selectItem(nextScriptPath);
    } catch (err) {
      setToast(t("renameFailed", { error: err.message }), "error");
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
      setToast(t("needScript"), "warn");
      return;
    }

    if (state.editorDirty) {
      if (!window.confirm(t("duplicateUnsavedConfirm"))) {
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
      setToast(t("duplicateCreated", { name: nextBase + item.ext }), "ok");
      refresh(t("reasonDuplicate"));
      selectItem(nextScriptPath);
      openCodeEditor(nextScriptPath, true);
    } catch (err) {
      setToast(t("duplicateFailed", { error: err.message }), "error");
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
      setToast(t("needScript"), "warn");
      return;
    }
    var nextBase = window.prompt(t("promptRename"), item.name);
    if (nextBase === null) {
      return;
    }
    el.renameInput.value = nextBase;
    renameSelected();
  }

  // ---- 自定义悬浮提示（替掉浏览器原生 title tooltip）------------------------------
  // 原生 title 提示框由 CEF 宿主绘制，字号固定，完全不跟随 body{zoom}：界面缩放调到
  // 150% 后，它比周围文字小一圈（2026-11-04 海哥反馈）。这里把提示接管成 body 内的
  // DOM 节点，用同一套 12px 字体，zoom 会连字号一起放大。
  // 不改任何写 title 的业务代码：MutationObserver 把 title 搬到 data-hg-tip 后删掉，
  // 静态 HTML、i18n 的 data-i18n-title、动态创建的脚本行都会被自动接管。
  var TIP_ATTR = "data-hg-tip";
  var TIP_DELAY_MS = 320;
  var tipNode = null;
  var tipAnchor = null;
  var tipTimer = null;
  var tipX = 0;
  var tipY = 0;

  // body{zoom} 下 fixed 浮层的统一倍率来源：读我们自己写进 body.style.zoom 的确定值，
  // 不做任何自校准（同 showContextMenu 的坐标说明）。
  function getPanelZoom() {
    var zoom = parseFloat(document.body && document.body.style.zoom);
    return isFinite(zoom) && zoom > 0 ? zoom : 1;
  }

  function ensureTipNode() {
    if (!tipNode) {
      tipNode = document.createElement("div");
      tipNode.className = "hg-tip";
      tipNode.setAttribute("role", "tooltip");
      document.body.appendChild(tipNode);
    }
    return tipNode;
  }

  function hideTip() {
    if (tipTimer) {
      window.clearTimeout(tipTimer);
      tipTimer = null;
    }
    tipAnchor = null;
    if (tipNode) {
      tipNode.classList.remove("open");
    }
  }

  function showTip(target, clientX, clientY) {
    var text = target && target.getAttribute(TIP_ATTR);
    if (!text) {
      return;
    }
    var tip = ensureTipNode();
    tip.textContent = text;
    tip.classList.add("open");

    // 与 showContextMenu 同一套换算：clientX/Y、window.inner* 是物理视口坐标，
    // fixed 的 style.left/top 与 offsetWidth/Height 是缩放后局部坐标。
    var zoom = getPanelZoom();
    var viewWidth = window.innerWidth / zoom;
    var viewHeight = window.innerHeight / zoom;
    tip.style.maxWidth = Math.max(120, Math.min(320, viewWidth - 24)) + "px";
    tip.style.maxHeight = Math.max(48, viewHeight * 0.35) + "px";
    var width = tip.offsetWidth || 160;
    var height = tip.offsetHeight || 30;
    var x = clientX / zoom;
    var y = clientY / zoom;
    var left = Math.max(8, Math.min(x + 14, viewWidth - width - 8));
    var top = y + 18;
    if (top + height > viewHeight - 8) {
      top = Math.max(8, y - height - 10);
    }
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
  }

  function findTipTarget(node) {
    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute(TIP_ATTR)) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function adoptTitles(root) {
    if (!root || root.nodeType !== 1 || root === tipNode) {
      return;
    }
    var list = [];
    if (root.hasAttribute && root.hasAttribute("title")) {
      list.push(root);
    }
    if (root.querySelectorAll) {
      var found = root.querySelectorAll("[title]");
      for (var i = 0; i < found.length; i++) {
        list.push(found[i]);
      }
    }
    for (var j = 0; j < list.length; j++) {
      var node = list[j];
      // 搬走后必须删掉 title，否则宿主仍会弹出那个小字提示，和自定义提示叠两层。
      node.setAttribute(TIP_ATTR, node.getAttribute("title") || "");
      node.removeAttribute("title");
    }
  }

  function initTooltips() {
    if (!document.body) {
      return;
    }
    adoptTitles(document.body);
    if (window.MutationObserver) {
      var observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var rec = records[i];
          if (rec.type === "attributes") {
            adoptTitles(rec.target);
          } else if (rec.addedNodes) {
            for (var j = 0; j < rec.addedNodes.length; j++) {
              adoptTitles(rec.addedNodes[j]);
            }
          }
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["title"]
      });
    }

    document.addEventListener("mouseover", function (event) {
      var target = findTipTarget(event.target);
      if (!target) {
        hideTip();
        return;
      }
      tipX = event.clientX;
      tipY = event.clientY;
      if (target !== tipAnchor) {
        hideTip();
        tipAnchor = target;
        tipTimer = window.setTimeout(function () {
          tipTimer = null;
          if (tipAnchor) {
            showTip(tipAnchor, tipX, tipY);
          }
        }, TIP_DELAY_MS);
      }
    });
    document.addEventListener("mousemove", function (event) {
      tipX = event.clientX;
      tipY = event.clientY;
    });
    document.addEventListener("mouseout", function (event) {
      if (!tipAnchor) {
        return;
      }
      var next = event.relatedTarget;
      if (next && (next === tipAnchor || (tipAnchor.contains && tipAnchor.contains(next)))) {
        return;
      }
      hideTip();
    });
    document.addEventListener("focusin", function (event) {
      var target = findTipTarget(event.target);
      if (!target) {
        return;
      }
      var rect = target.getBoundingClientRect();
      hideTip();
      tipAnchor = target;
      showTip(target, rect.left + 8, rect.bottom);
    });
    document.addEventListener("focusout", hideTip);
    document.addEventListener("click", hideTip);
    document.addEventListener("contextmenu", hideTip);
    document.addEventListener("scroll", hideTip, true);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        hideTip();
      }
    });
    document.documentElement.addEventListener("mouseleave", hideTip);
    window.addEventListener("blur", hideTip);
    window.addEventListener("resize", hideTip);
  }

  function showContextMenu(x, y, item) {
    var menu = el.contextMenu;
    menu.classList.add("open");
    menu.style.left = "0px";
    menu.style.top = "0px";

    // 界面缩放 body{zoom} 下同时存在两套坐标（2026-11-04 Chrome headless 实测 zoom=1.5）：
    //   event.clientX/Y、window.innerWidth/Height、getBoundingClientRect = 物理视口坐标；
    //   fixed 元素的 style.left/top、offsetWidth/offsetHeight = 缩放后局部坐标，
    //   渲染时会再乘回 zoom（style.top=100 -> rect.top=150；offsetHeight=165 -> rect.height=247.5；
    //   elementFromPoint(10,160) 命中 rect.top=150 的元素，证实 client 坐标是物理值）。
    // 旧代码两边混用：菜单被放到点击点 1.5 倍远处（「选项放得老远」），边界又用物理视口
    // 减局部菜单高，算出的 top 让菜单底部溢出面板被裁（小面板只剩「运行」一项可见）。
    // 这里统一换算到局部坐标系：读的是我们自己写进 body.style.zoom 的确定值，不是猜系数。
    var zoom = getPanelZoom();
    var viewWidth = window.innerWidth / zoom;
    var viewHeight = window.innerHeight / zoom;

    // 面板拖到最矮时也要能点到全部选项：可用高度不够就让菜单内部滚动。
    menu.style.maxHeight = Math.max(80, viewHeight - 16) + "px";
    menu.style.overflowY = "auto";

    var menuWidth = menu.offsetWidth || 180;
    var menuHeight = menu.offsetHeight || 240;
    var left = Math.max(8, Math.min(x / zoom, viewWidth - menuWidth - 8));
    var top = Math.max(8, Math.min(y / zoom, viewHeight - menuHeight - 8));

    menu.style.left = Math.round(left) + "px";
    menu.style.top = Math.round(top) + "px";
  }

  function hideContextMenu() {
    el.contextMenu.classList.remove("open");
    hideTip();
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
      setToast(t("needScript"), "warn");
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
      setToast(t("needScript"), "warn");
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
      setToast(t("needScript"), "warn");
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
      setToast(t("toastEditingDoc", { name: item.name }), "");
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
      setToast(t("needScript"), "warn");
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
      setToast(t(hadZhDoc || hadEnDoc ? "deletedWithGuides" : "deletedScript", { name: getScriptDisplayName(item) }), "ok");
      refresh(t("reasonScriptDeleted"));
      clearDetail();
    } catch (err) {
      setToast(friendlyError(t("deleteFailed"), err), "error");
    }
  }

  function runSelected() {
    if (state.running) {
      setToast(t("runBusy"), "warn");
      return;
    }
    var item = findByPath(state.selectedPath);
    if (!item) {
      setToast(t("needScript"), "warn");
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
    setPriorityStatus(t("runRunningStatus", { name: getScriptDisplayName(item) }), formatSize(item.size), "running");
    setToast(t("runRunningToast", { name: getScriptDisplayName(item) }), "running");
    renderListActiveOnly();
    appendConsole(t("runConsolePrefix", { name: getScriptDisplayName(item) }) + "\n" + displayPath);
    var script = "HGScripts.runScript(" + jsxString(scriptPath) + ", " + jsxString(state.cppMode) + ", " + jsxString(runToken) + ", " + jsxString(RUN_STATUS_PATH) + ", " + jsxString(RUN_REQUEST_PATH) + ", " + jsxString(RUN_HINT_PATH) + ", " + jsxString(effectiveLanguage) + ")";
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
        parsed.message = t("runExecuted", { name: getScriptDisplayName(item) });
      }
      finishRunFromParsed(runToken, item, parsed, startedAt, result);
    });
  }

  function runFromEditor() {
    if (state.running) {
      setToast(t("runBusy"), "warn");
      return;
    }
    var item = findByPath(state.editorPath || state.selectedPath);
    if (!item || !state.editorPath) {
      setToast(t("runNeedOpen"), "warn");
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
      var message = friendlyError(t("runTempFailed"), err);
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
      appendConsole("WARN: " + t("runStatusWriteFailed", { error: err.message }));
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
      var hint = readRunHint(runToken);
      if (hint && hint.text) {
        setPriorityStatus(hint.text, hint.text, normalizeHintLevel(hint.level), 0);
      } else {
        setPriorityStatus(t("runRunningStatus", { name: item.name }), formatDuration(Date.now() - startedAt), "running");
      }
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

  function readRunHint(runToken) {
    try {
      if (!fs.existsSync(RUN_HINT_PATH)) {
        return null;
      }
      var hint = JSON.parse(fs.readFileSync(RUN_HINT_PATH, "utf8") || "{}");
      if (String(hint.runId || "") !== String(runToken || "")) {
        return null;
      }
      return hint;
    } catch (err) {
      return null;
    }
  }

  function normalizeHintLevel(level) {
    if (level === "ok") {
      return "ok";
    }
    if (level === "warn") {
      return "warn";
    }
    if (level === "error") {
      return "error";
    }
    return "running"; // info 等其余级别按「进行中」视觉处理
  }

  function getRunStatusMessage(status, item) {
    if (status.message) {
      return decodeText(status.message);
    }
    return status.state === "done" ? t("runStatusDone", { name: item.name }) : t("runStatusFailed", { name: item.name });
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
        setPriorityStatus(t("runStatusDone", { name: item.name }), formatDuration(parsed.elapsedMs), "ok", 5000);
        setToast(parsed.message, "ok");
      } else {
        state.latestErrorText = formatRunResultPlain(parsed);
        if (state.editorPath && makeFileKey(state.editorPath) === makeFileKey(item.fullPath)) {
          markEditorError(parseInt(parsed.line, 10), parsed.message);
        }
        setPriorityStatus(t("runStatusFailed", { name: item.name }), formatDuration(parsed.elapsedMs), "error", 8000);
        setToast(parsed.message || t("scriptError"), "error");
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
      setToast(t("editorNotFound"), "warn");
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
      el.editorMetaInfo.textContent = buildMetaText(item);
      state.ace.setReadOnly(false);
      el.saveCodeBtn.disabled = false;
      el.runCodeBtn.disabled = false;
      el.saveRunCodeBtn.disabled = false;
      el.reloadCodeBtn.disabled = false;
      el.duplicateCodeBtn.disabled = false;
      el.codeEditor.classList.add("open");
      el.contentPanel.classList.add("editor-open");
      updateEditorState();
      appendConsole(t("openInEditor", { name: item.name }));
      setPriorityStatus(t("openInEditor", { name: item.name }), formatSize(item.size), "ok", 5000);
      setToast(t("openInEditor", { name: item.name }), "ok");
      setTimeout(function () {
        state.ace.resize(true);
        state.ace.focus();
        state.editorLoading = false;
      }, 0);
    } catch (err) {
      state.editorLoading = false;
      var readMessage = friendlyError(t("readScriptFailed"), err);
      setToast(readMessage, "error");
      appendConsole("ERROR: " + readMessage);
    }
  }

  function closeCodeEditor() {
    if (state.editorDirty && !window.confirm(t("editorCloseConfirm"))) {
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
      el.editorTitle.textContent = t("editorTitle");
    }
    el.editorTitleInput.value = "";
    el.editorTitleInput.disabled = true;
    el.editorPath.textContent = "";
    el.editorMetaInfo.textContent = "";
    el.codeEditor.classList.remove("open");
    el.contentPanel.classList.remove("editor-open");
    updateEditorState();
    var item = findByPath(state.selectedPath);
    if (item) {
      setSelectionToast(item);
    } else {
      setToast(t("editorNoEditTarget"), "");
    }
  }

  function saveCodeEditor(callback) {
    if (!state.editorPath) {
      setToast(t("editorNotOpen"), "warn");
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
      appendConsole(t("codeSavedPath", { path: state.editorPath }));
      setToast(t("codeSaved"), "ok");
      updateSavedScriptMetadata(state.editorPath);
      selectItem(state.editorPath);
      if (callback) {
        callback(true);
      }
    } catch (err) {
      var saveMessage = friendlyError(t("saveCodeFailed"), err);
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
    setToast(item ? t("toastSelected", { name: item.name }) : t("ready"), "");
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
      message: t("runStaleState", { name: item.name }),
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
      appendConsole("WARN: " + t("runProbeTimeout", { name: item.name }));
      setPriorityStatus(t("runStateReset", { name: item.name }), formatDuration(Date.now() - startedAt), "warn", 8000);
      setToast(t("runStateResetShort"), "warn");
    });
  }

  function normalizeCppMode(mode) {
    mode = String(mode || "auto").toLowerCase();
    return mode === "cpp" || mode === "jsx" ? mode : "auto";
  }

  function getCppModeLabel(mode) {
    if (mode === "cpp") return t("modeCppOnly");
    if (mode === "jsx") return t("modeForceJsx");
    return t("auto");
  }

  function getCppModeHint(mode) {
    if (mode === "cpp") return t("modeCppHint");
    if (mode === "jsx") return t("modeJsxHint");
    return t("modeAutoHint");
  }

  function getCppModeStatusText(mode) {
    if (mode === "cpp") return t("modeCppStatus");
    if (mode === "jsx") return t("modeJsxStatus");
    return t("modeAutoStatus");
  }

  function renderCppMode() {
    if (!el.cppModeSelect) {
      return;
    }
    var mode = normalizeCppMode(state.cppMode);
    var optionLabels = { auto: t("auto"), cpp: "C++", jsx: "JSX" };
    el.cppModeSelect.value = mode;
    el.cppModeSelect.className = "cpp-mode-select mode-" + mode;
    el.cppModeSelect.title = t("cppModeTitle") + ": " + getCppModeHint(mode);
    for (var i = 0; i < el.cppModeSelect.options.length; i++) {
      var option = el.cppModeSelect.options[i];
      option.textContent = optionLabels[option.value] || option.textContent;
    }
  }

  function setButtonRunning(button, isRunning) {
    if (!button) {
      return;
    }
    if (isRunning) {
      if (!button.getAttribute("data-normal-text")) {
        button.setAttribute("data-normal-text", button.textContent);
      }
      button.textContent = t("editorRunning");
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
    el.editorState.textContent = state.editorDirty ? t("editorUnsaved") : t("editorSaved");
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
    if (el.consoleOutput.textContent === t("waitingResult") || el.consoleOutput.textContent === t("consoleCleared")) {
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
        message: decodeText(text || t("runNoResult")),
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
        lines.push(escapeHtml(t("runHintPrefix")) + escapeHtml(hint));
      }
    }
    if (result.file) {
      lines.push(escapeHtml(t("runFilePrefix")) + escapeHtml(result.file));
    }
    if (result.line) {
      lines.push(escapeHtml(t("runLinePrefix", { n: result.line })));
    }
    if (result.context && result.context.length) {
      lines.push("<pre class=\"console-code\">" + formatErrorContext(result.context) + "</pre>");
    }
    if (result.line) {
      lines.push("<button class=\"console-line-link\" data-line=\"" + result.line + "\">" + escapeHtml(t("runJumpToLine", { n: result.line })) + "</button>");
    }
    if (result.number) {
      lines.push(escapeHtml(t("runErrorCode", { n: result.number })));
    }
    if (typeof result.elapsedMs === "number") {
      lines.push(escapeHtml(t("runElapsed", { n: formatDuration(result.elapsedMs) })));
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
        lines.push(t("runHintPrefix") + hint);
      }
    }
    if (result.file) {
      lines.push(t("runFilePrefix") + result.file);
    }
    if (result.line) {
      lines.push(t("runLinePrefix", { n: result.line }));
    }
    if (result.context && result.context.length) {
      lines.push("");
      lines.push(formatErrorContextPlain(result.context));
    }
    if (result.number) {
      lines.push(t("runErrorCode", { n: result.number }));
    }
    if (typeof result.elapsedMs === "number") {
      lines.push(t("runElapsed", { n: formatDuration(result.elapsedMs) }));
    }
    return lines.join("\n");
  }

  function getRunErrorHint(result) {
    var message = String(result.message || "");
    var number = String(result.number || "");
    if (number === "25" || /\u5E94\u4E3A|Expected|SyntaxError/i.test(message)) {
      return t("runHintSyntax");
    }
    if (/undefined|is not defined/i.test(message)) {
      return t("runHintUndefined");
    }
    if (/No such file|not found|does not exist/i.test(message)) {
      return t("runHintMissing");
    }
    if (/permission|access|denied/i.test(message)) {
      return t("runHintPermission");
    }
    return result.line ? t("runHintLine") : "";
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
    copyTextToClipboard(text, t("consoleCopied"), t("consoleCopyEmpty"));
  }

  function copyLatestError() {
    copyTextToClipboard(state.latestErrorText, t("errorCopied"), t("errorCopyEmpty"));
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
        setToast(t("copyManual"), "error");
      });
      return;
    }

    setToast(t("copyManual"), "error");
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
      setIdleStatus(state.idleCountText, t("watchPaused"));
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
          debounceRefresh(t("watchDetected"));
        }));
        watchedCount++;
      } catch (errWatch) {}
    }

    if (!activeCount) {
      setIdleStatus(state.idleCountText, t("statusWatchIdle"));
    } else if (watchedCount === activeCount) {
      setIdleStatus(state.idleCountText, t("watchActive"));
    } else {
      setIdleStatus(state.idleCountText, t("watchPartial"));
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
        updateChangeStatus(previous, result.snapshot, t("watchPolling"));
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
      var changeText = t("changeSummary", { reason: reason, added: added, changed: changed, removed: removed });
      setPriorityStatus(changeText, "", "ok", 5000);
      setToast(changeText, "ok");
    } else {
      setPriorityStatus(t("changeUpToDate", { reason: reason }), "", "", 3000);
      setToast(t("changeUpToDate", { reason: reason }), "");
    }
  }

  function getActiveSource() {
    return state.activeSourceId === "all" || state.activeSourceId === "favorites" ? null : findSource(state.activeSourceId);
  }

  function getDefaultSource() {
    /* 不再依赖持久化的中文 name 判定（默认目录名已改为语言中立），
       统一走 isDefaultSource 的路径 / 固定 id 判据。 */
    for (var i = 0; i < state.sources.length; i++) {
      if (isDefaultSource(state.sources[i])) {
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
    if (mode === "cpp") {
      return t("cppBoostCpp");
    }
    if (mode === "jsx") {
      return t("cppBoostJsx");
    }
    return t("cppBoostAuto");
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
    next.updateCheckEnabled = next.updateCheckEnabled !== false;
    next.updateSnoozeUntil = Number(next.updateSnoozeUntil) || 0;
    next.storage = next.storage || {};
    return next;
  }

  function detectHostLanguage() {
    return HGI ? HGI.detectHostLanguage(cs) : (/^zh/i.test(String(navigator.language || "")) ? "zh-CN" : "en-US");
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
    if (versionMajor >= 25) {
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
    return HGI ? HGI.normalizeMode(value) : (String(value || "auto") === "zh-CN" || String(value || "auto") === "en-US" ? String(value) : "auto");
  }

  function resolveEffectiveLanguage(mode, detected) {
    return HGI ? HGI.resolve(mode, detected) : (normalizeLanguageMode(mode) === "auto" ? detected : normalizeLanguageMode(mode));
  }

  function saveSettings() {
    try {
      ensureFolder(path.dirname(SETTINGS_PATH));
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
    } catch (err) {
      setToast(t("settingsSaveFailed", { error: err.message }), "error");
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
        name: inferSourceName(DEFAULT_FOLDER),
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
      setToast(t("folderPathEmpty"), "warn");
      return;
    }
    if (!fs.existsSync(normalized)) {
      setToast(t("folderMissing", { path: normalized }), "warn");
      return;
    }
    childProcess.execFile("cmd.exe", ["/c", "start", "", normalized], { windowsHide: true }, function (err) {
      if (err) {
        setToast(friendlyError(t("openFolderFailed"), err), "error");
      }
    });
  }

  function openCurrentScriptFolder() {
    var scriptPath = state.editorPath || state.selectedPath;
    var item = findByPath(scriptPath);
    if (!item) {
      setToast(t("needScript"), "warn");
      return;
    }
    openFolder(item.scriptFolder || path.dirname(item.fullPath));
  }

  function openCurrentDocumentFolder() {
    cs.evalScript("HGScripts.getActiveDocumentFolder()", function (resultPath) {
      var folderPath = normalizeFsPath(decodeText(resultPath || ""));
      if (!folderPath || folderPath.indexOf("ERROR:") === 0) {
        setToast(folderPath || t("sourceNoDocFolder"), "warn");
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
      title || t("sourcePickFolder")
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
    return path.basename(normalized) || t("sourceScriptFolder");
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
    return t("durationSeconds", { n: Math.round(ms / 100) / 10 });
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
      detail = t("errorNotFound");
    } else if (code === "EACCES" || code === "EPERM") {
      detail = t("errorNoAccess");
    } else if (code === "EBUSY") {
      detail = t("errorBusy");
    }
    return prefix + (detail ? ": " + detail : "");
  }

  function isEnglishUi() {
    return HGI ? HGI.isEnglish() : effectiveLanguage !== "zh-CN";
  }

  function t(key, params) {
    if (HGI) {
      return HGI.t(key, params);
    }
    return key;
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
    var label = el.scanDepthInput.parentNode;
    if (label && label.tagName === "LABEL") {
      label.innerHTML = "";
      label.appendChild(document.createTextNode(t("scanDepth") + " "));
      label.appendChild(el.scanDepthInput);
    }
    /* 实际 DOM 是 div.source-field > span + select（不是 LABEL 包裹），
       上面的 LABEL 分支不命中；这里翻译同级 span 标签。 */
    var depthSpan = label ? label.querySelector("span") : null;
    if (depthSpan) {
      depthSpan.textContent = t("sourceDepthLabel");
    }
    el.scanDepthInput.title = t("scanDepthTitle");
    for (var i = 0; i < el.scanDepthInput.options.length; i++) {
      var opt = el.scanDepthInput.options[i];
      if (opt.value === "0") {
        opt.textContent = t("scanCurrentOnly");
      } else {
        opt.textContent = t("scanChildPrefix") + opt.value + t("scanChildSuffix");
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
      dds[0].textContent = t("aboutProductName");
      dds[7].textContent = t("aboutDescription");
    }
  }

  function getScriptDisplayBase(item) {
    if (!item) {
      return "";
    }
    return HGI ? HGI.scriptTitle(item.base || "") : (item.base || "");
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
      failBoot(t("bootInitFailed"), errInit);
    }
  }, 0);
})();
