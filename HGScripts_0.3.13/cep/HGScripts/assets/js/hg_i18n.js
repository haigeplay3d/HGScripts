/*
 * HGScripts 共享语言模块（由 Trae CN 维护）
 *
 * 约定：
 * 1. 所有面向用户的文本只写在本文件；面板 JS 通过 HGI18N.t(key, params) 读取。
 * 2. 每个词条是 [中文, 英文] 数组，两边必须同时存在。
 * 3. 占位符统一写成 {name}，禁止在代码里拼接句子。
 * 4. 语言解析顺序：手动设置 → 宿主 UI 语言 → 浏览器语言。
 * 5. 回退顺序：当前语言 → 另一种语言 → key；命中回退只写一次启动警告。
 */
(function (global) {
  "use strict";

  var TEXT = {
    /* 顶部栏与通用按钮 */
    searchPlaceholder: ["搜索脚本", "Search scripts"],
    cppModeTitle: ["C++ / JSX 运行模式", "C++ / JSX run mode"],
    refresh: ["刷新", "Refresh"],
    refreshTitle: ["立即刷新脚本列表", "Refresh the script list now"],
    expand: ["展开", "Expand"],
    collapse: ["收起", "Collapse"],
    sort: ["排序", "Sort"],
    sortTitle: ["排序", "Sort"],
    sortLastRun: ["最近使用", "Last used"],
    sortMtime: ["最近修改", "Modified"],
    sortInitialAsc: ["首字母 A-Z", "Initials A-Z"],
    sortInitialDesc: ["首字母 Z-A", "Initials Z-A"],
    sortNameAsc: ["名称 A-Z", "Name A-Z"],
    sortNameDesc: ["名称 Z-A", "Name Z-A"],
    favorites: ["收藏", "Favorites"],
    favoritesTitle: ["只显示收藏脚本", "Show favorite scripts only"],
    defaultSource: ["默认", "Default"],
    defaultSourceTitle: ["切换到默认脚本目录", "Switch to the default script folder"],
    newScript: ["新建", "New"],
    addFolder: ["添加目录", "Add Folder"],
    addFolderTitle: ["管理脚本目录", "Manage script folders"],
    /* 顶部工具栏紧凑按钮专用短词：仅英文取缩写，中文值与原词一致，保证中文界面零变化；
       全称仍由对应 *Title 悬停提示与弹窗内文案承担。 */
    favoritesShort: ["收藏", "Fav"],
    addFolderShort: ["添加目录", "Add"],
    addFolderDialog: ["添加文件夹…", "Add Folder…"],
    folderLoading: ["正在读取脚本目录...", "Reading script folders..."],
    all: ["全部", "All"],
    splitterTitle: ["拖动调整脚本列表宽度", "Drag to resize the script list"],
    selectScript: ["选择一个脚本", "Select a script"],
    rename: ["重命名", "Rename"],
    renameTitle: ["重命名脚本并同步同名说明", "Rename the script and matching guides"],
    editorNameTitle: ["修改脚本名后按 Enter 确认，Esc 取消", "Change the script name, then press Enter to confirm; Esc cancels"],
    run: ["运行", "Run"],
    openExternal: ["外部打开", "Open"],
    reveal: ["定位", "Reveal"],
    docTitle: ["使用说明", "Guide"],
    saveDoc: ["保存说明", "Save Guide"],
    saveDocTitle: ["保存同名 Markdown 说明", "Save the matching Markdown guide"],
    docPlaceholder: ["同名 .md 会显示在这里。", "The matching .md guide appears here."],
    close: ["关闭", "Close"],
    save: ["保存", "Save"],
    saveRun: ["保存并运行", "Save & Run"],
    reload: ["重新读取", "Reload"],
    duplicate: ["创建副本", "Duplicate"],
    noScriptOpen: ["未打开脚本", "No script open"],
    console: ["控制台", "Console"],
    copyAll: ["复制全部", "Copy All"],
    copyError: ["复制报错", "Copy Error"],
    clear: ["清空", "Clear"],
    waitingResult: ["等待运行结果。", "Waiting for run results."],
    settings: ["设置", "Settings"],
    settingsSub: ["插件界面和运行偏好", "Panel UI and run preferences"],
    back: ["返回", "Back"],
    language: ["语言", "Language"],
    auto: ["自动", "Auto"],
    chinese: ["中文", "Chinese"],
    english: ["English", "English"],
    saveLanguage: ["保存语言设置", "Save Language"],
    languageSavedTo: ["语言已保存：{lang}", "Language saved: {lang}"],
    languageRefreshReason: ["语言切换", "Language changed"],
    languageHintPrefix: ["当前界面语言已启用。选项：", "Active: "],
    languageHintHost: ["，Illustrator/CEP：", ", Illustrator/CEP: "],
    languageHintEffective: ["，实际语言：", ", effective: "],
    languageHintSuffix: ["。", "."],
    about: ["关于", "About"],
    pluginName: ["插件名称", "Plugin name"],
    aboutProductName: ["海哥的Adobe脚本管理 / HGScripts", "HGScripts"],
    version: ["版本", "Version"],
    updateDate: ["更新日期", "Updated"],
    referenceProjects: ["参考项目", "Reference projects"],
    description: ["说明", "Description"],
    aboutDescription: ["免费开源发布，当前以 Illustrator 为主，正在准备 Photoshop / InDesign 支持。", "Free and open source. Illustrator is the primary host; Photoshop and InDesign support is being prepared."],
    ready: ["准备就绪", "Ready"],
    noSelection: ["未选择脚本", "None selected"],
    needScript: ["请先选择一个脚本", "Select a script first"],
    sourceManager: ["脚本目录", "Script Folders"],
    sourceAlias: ["显示名称", "Display name"],
    folderPath: ["脚本目录路径", "Script folder path"],
    saveChanges: ["应用更改", "Apply Changes"],
    removeFromList: ["从列表移除", "Remove from List"],
    scanDepth: ["扫描范围", "Scan range"],
    scanDepthTitle: ["仅这一层：不读取子文件夹里的脚本", "Current level only; subfolders are not scanned"],
    scanCurrentOnly: ["仅这一层", "Current level only"],
    scanChildPrefix: ["含 ", "Include "],
    scanChildSuffix: [" 层子文件夹", " subfolder levels"],
    ignoredDirs: ["忽略目录，如 node_modules,.git,.svn,.hg", "Ignored folders, e.g. node_modules,.git,.svn,.hg"],
    saveSettings: ["保存", "Save"],
    addedSources: ["已添加目录", "Added Folders"],
    newScriptName: ["新脚本名", "New script name"],
    docCheckbox: ["使用说明", "Guide"],
    create: ["创建", "Create"],
    unsavedScript: ["当前脚本未保存", "Current script is not saved"],
    unsavedDoc: ["当前说明未保存", "Current guide is not saved"],
    saveThenSwitch: ["保存后切换", "Save then Switch"],
    switchDirectly: ["直接切换", "Switch Directly"],
    cancel: ["取消", "Cancel"],
    editScript: ["编辑脚本", "Edit Script"],
    editDoc: ["编辑说明", "Edit Guide"],
    revealExplorer: ["定位到资源管理器", "Reveal in Explorer"],
    deleteScript: ["删除脚本", "Delete Script"],
    panelSizeTitle: ["切换窄 / 宽面板", "Toggle narrow/wide panel"],
    closeEditorTitle: ["关闭内部编辑器", "Close the internal editor"],
    consoleResizerTitle: ["拖动调整控制台高度", "Drag to resize the console"],
    backTitle: ["返回脚本列表", "Back to script list"],

    /* 设置页 */
    uiZoom: ["界面缩放", "UI zoom"],
    uiZoomHint: ["高分辨率屏幕下文字偏小时可调大；选择后立即生效并自动保存，默认 100%。", "Increase this when text looks small on high-DPI screens. Applies and saves immediately; default 100%."],
    uiZoomChanged: ["界面缩放已调整为 {percent}%", "UI zoom set to {percent}%"],
    languageHintInitial: ["跟随 Illustrator 界面语言，可手动覆盖。", "Follows the Illustrator UI language; you can override it."],

    /* 启动与宿主 */
    bootLoading: ["正在加载 HGScripts 运行环境...", "Loading the HGScripts runtime..."],
    bootInit: ["正在初始化 HGScripts...", "Initializing HGScripts..."],
    bootNodeFailed: ["HGScripts 无法启用 CEP Node.js 环境", "HGScripts could not start the CEP Node.js runtime"],
    bootCsFailed: ["HGScripts 无法初始化 CSInterface", "HGScripts could not initialize CSInterface"],
    bootStarted2023: ["HGScripts v{version} 已在 Illustrator 2023 启动。若下方仍是空白，请继续让 Codex 读取日志。", "HGScripts v{version} started in Illustrator 2023. If the area below stays blank, let Codex read the log."],
    bootPaintFailed: ["HGScripts 已启动，但旧版 Illustrator 面板高度异常。请拖大面板或重开面板。", "HGScripts started, but the legacy Illustrator panel height is abnormal. Resize or reopen the panel."],
    bootScanFailed: ["HGScripts 启动扫描失败", "HGScripts startup scan failed"],
    bootInitFailed: ["HGScripts 初始化失败", "HGScripts initialization failed"],
    routerTitle: ["HGScripts", "HGScripts"],
    routerChoosing: ["正在选择 HGScripts 面板...", "Choosing the HGScripts panel..."],
    routerOpeningFull: ["正在打开完整面板...", "Opening the full panel..."],
    routerTryingLegacy: ["正在尝试旧版 Illustrator 完整面板...", "Trying the legacy Illustrator full panel..."],
    routerOpeningSafe: ["正在打开安全面板...", "Opening the safe panel..."],
    safeBoot: ["正在启动兼容面板...", "Starting the compatibility panel..."],
    safeWaiting: ["等待操作", "Waiting"],
    appTitle: ["海哥的Adobe脚本管理 v{version}", "HGScripts v{version}"],

    hostCurrent: ["当前宿主: {host}", "Current host: {host}"],
    hostToggle: ["当前宿主: {host}，点击切换窄 / 宽面板", "Current host: {host}. Click to toggle narrow/wide panel."],
    hostOpenDocFolder: ["打开当前 {host} 文档所在文件夹", "Open the folder of the current {host} document"],

    /* 状态栏与面板 */
    statusZeroScripts: ["0 个脚本", "0 scripts"],
    updateAvailable: ["发现新版本 {version}，点击前往下载页", "New version {version} available. Click to open the download page."],
    updateChecking: ["正在检测更新…", "Checking for updates..."],
    updateUpToDate: ["已是最新版本 {version}", "You are up to date ({version})"],
    updateCheckFailed: ["检测失败，请稍后重试", "Update check failed, try again later"],
    updateCheckToggle: ["检测更新", "Check updates"],
    updateBarDismiss: ["关闭，7 天不再提示", "Dismiss for 7 days"],
    statusWatchIdle: ["监听未启动", "Watcher not started"],
    statusCount: ["{shown} / {total} 个脚本", "{shown} / {total} scripts"],
    statusSourceCount: ["{n} 个脚本", "{n} scripts"],
    folderHintNone: ["{host} / 没有可读取的脚本目录", "{host} / No readable script folder"],
    folderHintSummary: ["{host} / {sources} 个目录源，{files} 个脚本", "{host} / {sources} folders, {files} scripts"],
    folderHintMissing: ["，失效 {n} 个", ", {n} missing"],
    panelSwitchToNarrow: ["切换到窄面板", "Switch to narrow panel"],
    panelSwitchToWide: ["切换到宽面板", "Switch to wide panel"],
    panelSwitchedNarrow: ["已切换到窄面板", "Switched to the narrow panel"],
    panelSwitchedWide: ["已切换到宽面板", "Switched to the wide panel"],
    panelSwitchFailed: ["面板尺寸切换失败: {error}", "Panel resize failed: {error}"],
    consoleCleared: ["控制台已清空。", "Console cleared."],

    /* 刷新原因 */
    reasonStartup: ["启动扫描", "Startup scan"],
    reasonManual: ["手动刷新", "Manual refresh"],
    reasonSettingsSaved: ["设置已保存", "Settings saved"],
    reasonFolderAdded: ["添加目录", "Folder added"],
    reasonFolderSaved: ["目录已保存", "Folder saved"],
    reasonFolderRemoved: ["移除目录", "Folder removed"],
    reasonScriptCreated: ["新建脚本", "Script created"],
    reasonDocSaved: ["保存说明", "Guide saved"],
    reasonScriptRenamed: ["重命名脚本", "Script renamed"],
    reasonScriptDeleted: ["删除脚本", "Script deleted"],
    reasonDuplicate: ["创建副本", "Copy created"],
    toastEditingDoc: ["正在编辑说明: {name}", "Editing guide: {name}"],
    duplicateFailed: ["创建副本失败: {error}", "Could not create the copy: {error}"],

    /* 旧版兼容编辑器 */
    legacyAceLoadFailed: ["旧版模式: Ace 加载失败，继续使用兼容编辑器。", "Legacy mode: Ace failed to load; using the compatibility editor."],
    legacyAceLoaded: ["旧版模式: Ace 编辑器已延迟加载。", "Legacy mode: Ace editor loaded lazily."],
    legacyAceInitFailed: ["旧版模式: Ace 初始化失败，继续使用兼容编辑器。", "Legacy mode: Ace initialization failed; using the compatibility editor."],

    /* 脚本目录 */
    sourceDefaultName: ["默认脚本", "Default Scripts"],
    sourceScriptSource: ["脚本来源", "Script Source"],
    sourceScriptFolder: ["脚本目录", "Script Folder"],
    runSelectedBtn: ["运行选中脚本", "Run Selected"],
    copyResult: ["复制结果", "Copy Result"],
    safeLoaded: ["已加载 {n} 个 Illustrator 脚本", "Loaded {n} Illustrator scripts"],
    safeNoScripts: ["没有找到脚本", "No scripts found"],
    safeSelected: ["已选中: {name}", "Selected: {name}"],
    resultCopied: ["结果已复制", "Result copied"],
    copyFailed: ["复制失败: {error}", "Copy failed: {error}"],
    consoleCopied: ["控制台内容已复制", "Console content copied"],
    consoleCopyEmpty: ["控制台没有可复制内容", "Nothing in the console to copy"],
    errorCopied: ["最新报错已复制", "Latest error copied"],
    errorCopyEmpty: ["当前没有可复制的报错", "No error to copy"],
    copyManual: ["复制失败，请手动选中内容复制", "Copy failed; select the content and copy manually"],
    settingsSaveFailed: ["设置保存失败: {error}", "Could not save settings: {error}"],
    openInEditor: ["已打开编辑脚本: {name}", "Editing script: {name}"],
    safeStarted: ["安全面板已启动。双击脚本也可以运行。", "Safe panel started. Double-click a script to run it."],
    safeStartFailed: ["安全面板启动失败", "Safe panel failed to start"],
    safeDropBlocked: ["这里不支持拖入文件，请在完整版面板里添加脚本目录", "Dropping files is not supported here; add the script folder in the full panel"],
    sourceMigrateFailed: ["旧脚本目录迁移失败: {error}", "Legacy script folder migration failed: {error}"],
    sourceSwitchTo: ["切换到: {name}", "Switch to: {name}"],
    sourceNoDefault: ["没有可用的默认目录", "No default folder available"],
    sourceRecentPlaceholder: ["最近目录", "Recent folders"],
    sourceEmpty: ["还没有添加脚本目录", "No script folders added yet"],
    sourceOpenFolder: ["打开文件夹", "Open folder"],
    sourceOpenFolderToast: ["打开文件夹：{name}", "Open folder: {name}"],
    sourceAddScriptFile: ["添加脚本文件…", "Add Script File…"],
    sourceChangePath: ["更改…", "Change…"],
    sourcePathLabel: ["路径（点击可复制）", "Path (click to copy)"],
    sourceNameLabel: ["显示名称", "Display name"],
    sourceDepthLabel: ["扫描范围", "Scan range"],
    sourceDetailHint: ["使用中的目录", "Active folder"],
    sourceAutoSaveHint: ["改动立即生效，无需保存", "Changes apply immediately"],
    sourceSectionHint: ["面板会扫描这些目录里的 .jsx / .js 文件", "The panel scans .jsx / .js files in these folders"],
    sourceDragHint: ["把 .jsx / .js 文件拖到这里，会自动添加它所在的文件夹", "Drop a .jsx / .js file here to add its folder"],
    sourceDropAnywhereHint: ["松开即添加该脚本所在的文件夹", "Release to add the folder that contains this script"],
    sourceDropUnsupported: ["只支持拖入 .jsx / .js 文件或脚本文件夹", "Only .jsx / .js files or script folders can be dropped"],
    sourceAdvHead: ["高级：忽略目录（对所有目录生效）", "Advanced: ignored folders (applies to all)"],
    sourceAdvExpand: ["展开", "Expand"],
    sourceAdvCollapse: ["收起", "Collapse"],
    sourceAdvHint: ["这一项影响全部目录", "Applies to all folders"],
    sourcePathCopied: ["已复制完整路径", "Full path copied"],
    sourcePathEditHint: ["现在可以修改路径，改完点别处即自动保存", "Edit the path, then click elsewhere to save"],
    sourceAutoSaved: ["已自动保存", "Saved automatically"],
    sourceDepthSaved: ["扫描范围已更新", "Scan range updated"],
    sourceDepthBadge: ["深度 {n}", "depth {n}"],
    sourceEmptyMissing: ["这个目录现在找不到，点「更改…」重新指定路径。", "This folder is missing. Click Change… to set a new path."],
    sourceEmptyDepth: ["脚本可能在子文件夹里：把「扫描范围」改成「含 1 层子文件夹」再试。", "Scripts may be in subfolders: set Scan range to include 1 subfolder level."],
    sourceEmptyNoJsx: ["这个目录里没有 .jsx / .js 文件，点「打开文件夹」把脚本放进去。", "No .jsx / .js files here. Click Open folder and put your scripts inside."],
    sourceIgnoredLabel: ["忽略目录", "Ignored folders"],
    sourceRemoveTitle: ["只从列表移除，不会删除电脑上的文件", "Removes from the list only; files on disk are untouched"],
    badgeCurrent: ["使用中", "In use"],
    badgeDefault: ["默认", "Default"],
    badgeMissing: ["找不到", "Missing"],
    sourceCount: ["{n} 个脚本", "{n} scripts"],
    sourcePickFolder: ["选择脚本文件夹", "Choose a script folder"],
    sourceAddFolderTitle: ["添加文件夹", "Add a folder"],
    sourcePickJsx: ["选择一个脚本文件", "Choose a script file"],
    sourceJsxFilter: ["脚本文件 (*.jsx;*.js)|*.jsx;*.js|所有文件 (*.*)|*.*", "Scripts (*.jsx;*.js)|*.jsx;*.js|All files (*.*)|*.*"],
    sourceOpenFolderFailed: ["打开目录选择窗口失败: {error}", "Could not open the folder picker: {error}"],
    sourceOpenJsxFailed: ["打开 JSX 选择窗口失败: {error}", "Could not open the JSX picker: {error}"],
    sourceManagerCloseTitle: ["关闭脚本目录", "Close the script folder manager"],
    sourceAddBtnTitle: ["选择或添加一个脚本文件夹", "Choose or add a script folder"],
    sourceChooseBtnTitle: ["选择一个脚本文件，自动添加它所在的文件夹", "Choose a script file; its folder is added automatically"],
    sourcePathInputTitle: ["点击复制完整路径", "Click to copy the full path"],
    sourceChangePathTitle: ["重新指定这个目录的路径", "Set a new path for this folder"],
    sourceOpenFolderTitle: ["在资源管理器中打开这个目录", "Open this folder in File Explorer"],
    sourceNewScriptTitle: ["新建 JSX 脚本", "New JSX script"],
    sourceCreateDocTitle: ["同时创建同名 Markdown 说明", "Also create the matching Markdown guide"],
    sourceCreateCloseTitle: ["关闭新建脚本", "Close the new-script dialog"],
    sourceNoDocFolder: ["当前文档没有可用目录", "The current document has no usable folder"],
    sourceFolderEmpty: ["脚本目录不能为空", "The script folder cannot be empty"],
    sourceFolderMissing: ["目录不存在，请先确认路径", "The folder does not exist; check the path first"],
    sourceFolderExists: ["目录已存在，已切换到该目录源", "This folder already exists; switched to it"],
    sourceNeedSpecific: ["请先选择一个具体目录源", "Select a specific folder source first"],
    sourceNoSource: ["没有可用目录源", "No folder source available"],
    sourceDuplicate: ["这个目录已在列表里，不需要重复保存", "This folder is already in the list"],
    sourceKeepOne: ["至少保留一个脚本目录", "Keep at least one script folder"],
    sourceConfirmRemove: ["从列表移除目录「{name}」？脚本文件仍保留在电脑里。", "Remove \"{name}\" from the list? The script files stay on disk."],
    sourceNameEmpty: ["新脚本名不能为空", "The new script name cannot be empty"],
    sourceScriptExists: ["已存在同名 JSX，新建已取消", "A JSX file with this name already exists; creation canceled"],
    sourceCreated: ["已新建脚本: {name}", "Script created: {name}"],
    sourceCreateFailed: ["新建脚本失败: {error}", "Could not create the script: {error}"],

    /* 说明与重命名 */
    docReadFailed: ["说明文件读取失败: {error}", "Could not read the guide: {error}"],
    docNeedScript: ["请先选择一个脚本", "Select a script first"],
    docSaved: ["说明已保存: {name}", "Guide saved: {name}"],
    docSaveFailed: ["说明保存失败: {error}", "Could not save the guide: {error}"],
    renameEmpty: ["脚本名不能为空", "The script name cannot be empty"],
    renameUnchanged: ["脚本名没有变化", "The script name is unchanged"],
    renameExists: ["已存在同名脚本，重命名已取消", "A script with this name already exists; rename canceled"],
    renameDocExists: ["已存在同名说明文件，重命名已取消", "A guide with this name already exists; rename canceled"],
    renameEnDocExists: ["已存在同名英文说明文件，重命名已取消", "An English guide with this name already exists; rename canceled"],
    renameDone: ["已重命名为: {name}", "Renamed to: {name}"],
    renameFailed: ["重命名失败: {error}", "Rename failed: {error}"],
    renameNeedScript: ["请先选择一个脚本", "Select a script first"],
    duplicateNeedScript: ["请先选择一个脚本", "Select a script first"],
    duplicateUnsavedConfirm: ["当前代码尚未保存。是否先保存再创建副本？", "The current code is not saved. Save before creating a copy?"],
    duplicateCreated: ["已创建副本: {name}", "Copy created: {name}"],

    /* 场景与快捷入口 */
    sceneFilter: ["筛选: {label}", "Filter: {label}"],
    sceneQuickEmpty: ["运行或收藏脚本后，这里会出现快捷入口", "Run or favorite scripts to show quick entries here"],
    sceneRunTimes: ["运行 {n} 次", "Run {n} times"],
    sceneScript: ["脚本", "Script"],
    sceneRecent: ["最近", "Recent"],
    sceneSelect: ["选择", "Select"],
    sceneColor: ["颜色", "Color"],
    sceneSize: ["尺寸", "Size"],
    sceneAlign: ["对齐", "Align"],
    sceneArtboard: ["画板", "Artboard"],
    sceneExport: ["导出", "Export"],
    sceneDiagnostic: ["诊断", "Diagnostics"],
    photoshop: ["PS", "PS"],

    /* 选择与收藏 */
    toastSelected: ["已选择脚本: {name}", "Selected script: {name}"],
    toastFavorited: ["已收藏: {name}", "Added to favorites: {name}"],
    toastUnfavorited: ["已取消收藏: {name}", "Removed from favorites: {name}"],
    metaLastRun: [" / 上次运行 {time} / 运行 {n} 次", " / Last run {time} / Run {n} times"],
    toastCancelledSwitch: ["已取消切换", "Switch canceled"],

    /* 运行与错误 */
    deleteNeedScript: ["请先选择一个脚本", "Select a script first"],
    deletedWithGuides: ["脚本和说明已移到回收站: {name}", "Script and guides moved to the Recycle Bin: {name}"],
    deletedScript: ["脚本已移到回收站: {name}", "Script moved to the Recycle Bin: {name}"],
    deleteFailed: ["删除失败", "Delete failed"],
    runBusy: ["脚本正在运行，请稍等", "A script is running; please wait"],
    runNeedScript: ["请先选择一个脚本", "Select a script first"],
    runNeedOpen: ["请先打开一个脚本", "Open a script first"],
    runStatusDone: ["已完成: {name}", "Completed: {name}"],
    runStatusFailed: ["运行失败: {name}", "Run failed: {name}"],
    runStatusWriteFailed: ["写入运行状态请求失败: {error}", "Could not write the run status request: {error}"],
    runTempFailed: ["临时运行失败", "Temporary run failed"],
    runRunningStatus: ["运行中: {name}", "Running: {name}"],
    runRunningToast: ["正在运行: {name}", "Running: {name}"],
    runConsolePrefix: ["运行 {name}", "Run {name}"],
    runExecuted: ["已执行 {name}", "Executed {name}"],
    runNoResult: ["脚本执行结束，但没有返回结果", "The script finished but returned no result"],
    runStaleState: ["未收到真实运行状态: {name}", "No real run status received: {name}"],
    runProbeTimeout: ["未收到运行结果回调，已重置运行状态: {name}", "No run result callback received; run state reset: {name}"],
    runStateReset: ["运行状态已重置: {name}", "Run state reset: {name}"],
    runStateResetShort: ["运行已结束，面板状态已重置", "The run ended; panel state reset"],
    runHintPrefix: ["提示: ", "Hint: "],
    runFilePrefix: ["文件: ", "File: "],
    runLinePrefix: ["行号: {n}", "Line: {n}"],
    runJumpToLine: ["跳到第 {n} 行", "Jump to line {n}"],
    runErrorCode: ["错误码: {n}", "Error code: {n}"],
    runElapsed: ["耗时: {n}", "Elapsed: {n}"],
    runHintSyntax: ["这是语法错误，优先检查标出的行附近是否少了括号、引号、分号，或函数名被写断。", "This is a syntax error. Check the highlighted line for missing brackets, quotes, semicolons, or a broken function name."],
    runHintUndefined: ["有变量或函数未定义，检查名称拼写、作用域，或相关函数是否在运行前声明。", "A variable or function is undefined. Check spelling, scope, or whether it is declared before use."],
    runHintMissing: ["脚本引用的文件或目录不存在，检查路径、文件名和磁盘是否可访问。", "A referenced file or folder does not exist. Check the path, file name, and disk access."],
    runHintPermission: ["当前路径可能没有读写权限，可以换到普通工作目录后重试。", "The current path may not be writable. Try a normal working folder."],
    runHintLine: ["查看行号和上下文，通常问题就在标出的行或上一两行。", "Check the line number and context. The issue is usually on the highlighted line or nearby."],
    errorNotFound: ["路径不存在或文件已被移动", "The path does not exist or the file moved"],
    errorNoAccess: ["没有权限访问该路径，或文件正在被占用", "No permission to access this path, or the file is in use"],
    errorBusy: ["文件正在被其它程序占用", "The file is in use by another program"],

    /* 运行模式与编辑器 */
    modeCppOnly: ["仅 C++", "C++ only"],
    modeForceJsx: ["强制 JSX", "Force JSX"],
    modeCppHint: ["C++模式: 优先 AIP/C++ 加速, 失败后回退 JSX", "C++ mode: prefer AIP/C++ acceleration, then fall back to JSX"],
    modeJsxHint: ["强制 JSX: 不调用 AIP/C++", "Force JSX: do not call AIP/C++"],
    modeAutoHint: ["自动模式: 优先 AIP/C++ 加速, 失败后回退 JSX", "Auto mode: prefer AIP/C++ acceleration, then fall back to JSX"],
    modeCppStatus: ["C++: AIP 优先", "C++: AIP first"],
    modeJsxStatus: ["JSX: 不调用 AIP", "JSX: no AIP"],
    modeAutoStatus: ["自动: AIP 优先", "Auto: AIP first"],
    modeChanged: ["运行模式: {mode}", "Run mode: {mode}"],
    editorRunning: ["运行中...", "Running..."],
    editorUnsaved: ["未保存", "Unsaved"],
    editorSaved: ["已保存", "Saved"],
    durationSeconds: ["{n} 秒", "{n} sec"],
    scriptError: ["脚本错误", "Script error"],

    /* 文件监听与刷新 */
    watchPaused: ["自动刷新已暂停", "Auto refresh paused"],
    watchDetected: ["检测到外部修改", "External change detected"],
    watchPolling: ["轮询刷新", "Polling refresh"],
    watchActive: ["自动监听中", "Watching for changes"],
    watchPartial: ["部分目录监听受限，使用轮询", "Some folders cannot be watched; using polling"],
    changeSummary: ["{reason}: 新增 {added}，修改 {changed}，删除 {removed}", "{reason}: added {added}, changed {changed}, removed {removed}"],
    changeUpToDate: ["{reason}: 已是最新", "{reason}: up to date"],
    cppBoostCpp: ["C++模式: 已检测到 Illustrator 加速插件, 失败后回退jsx", "C++ mode: Illustrator accelerator detected; fall back to JSX on failure"],
    cppBoostJsx: ["强制JSX: 当前不调用C++", "Force JSX: C++ is not called"],
    cppBoostAuto: ["自动模式: 已检测到 Illustrator 加速插件, 失败后回退jsx", "Auto mode: Illustrator accelerator detected; fall back to JSX on failure"],
    cppDocBoost: ["本脚本具有 C++ 加速", "This script supports C++ acceleration"],

    /* 文件打开与编辑器 */
    folderPathEmpty: ["文件夹路径为空", "The folder path is empty"],
    folderMissing: ["文件夹不存在: {path}", "The folder does not exist: {path}"],
    openFolderFailed: ["打开文件夹失败", "Could not open the folder"],
    editorNotFound: ["找不到要编辑的脚本", "Could not find the script to edit"],
    editorTitle: ["脚本编辑器", "Script Editor"],
    editorNotOpen: ["没有打开的脚本", "No script is open"],
    editorNoEditTarget: ["未打开编辑脚本", "No script open for editing"],
    editorCloseConfirm: ["当前代码尚未保存，确定关闭编辑器？", "The current code is not saved. Close the editor anyway?"],
    codeSaved: ["代码已保存", "Code saved"],
    codeSavedPath: ["已保存: {path}", "Saved: {path}"],
    readScriptFailed: ["读取脚本失败", "Could not read the script"],
    saveCodeFailed: ["代码保存失败", "Could not save the code"],
    starAdd: ["收藏脚本", "Add to favorites"],
    starRemove: ["取消收藏", "Remove from favorites"],
    scriptMoved: ["脚本已被移动或删除", "The script was moved or deleted"],
    promptRename: ["重命名脚本", "Rename script"],
    showAllFolders: ["显示所有脚本目录", "Show all script folders"],
    folderMissingChoose: ["目录不存在，请重新选择", "The folder does not exist; choose it again"],
    noSourceAvailable: ["没有可用目录源", "No folder source available"]
  };

  /* 场景配置：label 与 aliases 同时保留中英文，供中文与英文检索使用。 */
  var SCENES = [
    { id: "all", labelKey: "all", aliases: [] },
    { id: "favorites", labelKey: "favorites", aliases: ["收藏", "常用", "星标", "favorite", "favorites", "star"] },
    { id: "recent", labelKey: "sceneRecent", aliases: ["最近", "刚用", "上次", "recent", "last"] },
    { id: "select", labelKey: "sceneSelect", aliases: ["选择", "选中", "对象", "空对象", "同色", "无填颜色", "无描边", "select", "selection", "object", "empty"] },
    { id: "color", labelKey: "sceneColor", aliases: ["颜色", "填充", "描边", "黑", "白", "同色", "转颜色", "改颜色", "color", "fill", "stroke", "black", "white"] },
    { id: "size", labelKey: "sceneSize", aliases: ["尺寸", "缩放", "长边", "1024", "宽", "高", "整数", "小数", "size", "scale", "long edge", "width", "height"] },
    { id: "align", labelKey: "sceneAlign", aliases: ["对齐", "居中", "左对齐", "右对齐", "顶部", "底部", "基准", "align", "center", "left", "right", "top", "bottom"] },
    { id: "artboard", labelKey: "sceneArtboard", aliases: ["画板", "外框", "背景", "新画板", "artboard", "frame", "background"] },
    { id: "export", labelKey: "sceneExport", aliases: ["导出", "保存", "输出", "复制到新画板", "export", "save", "output", "copy to new artboard"] },
    { id: "diagnostic", labelKey: "sceneDiagnostic", aliases: ["诊断", "记录", "恢复", "测试", "实验", "调试", "diagnostic", "record", "restore", "test", "debug"] },
    { id: "photoshop", labelKey: "photoshop", aliases: ["photoshop", "ps", "图层", "蒙版", "剪贴板", "beauty", "layer", "mask", "clipboard"] }
  ];

  /* 英文脚本标题：覆盖 user_scripts 下全部脚本；中文文件名不变，仅影响显示。 */
  var SCRIPT_TITLES_EN = {
    "illustrator坐标转换器": "Illustrator Coordinate Converter",
    "为选择对象创建外框": "Create Frame Around Selection",
    "单色转自定义颜色": "Single Color to Another Color",
    "单色转自定义颜色-其它转自定义颜色": "Single Color and Others to Custom Colors",
    "填充颜色同步到描边颜色": "Sync Fill Color to Stroke",
    "复制选中对象按原图层分组": "Duplicate Selected Objects and Group by Original Layer",
    "尺寸无小数": "Remove Decimal Dimensions",
    "选择文字转曲": "Outline Selected Text",
    "字体还原": "Restore Text from Outlines",
    "纸杯展开": "Paper Cup Template",
    "应用对象中心相对画板位置": "Apply Object Center Relative to Artboard",
    "当前画板创建黑色背景矩形": "Create Black Background on Current Artboard",
    "子对象对齐画板-整组移动": "Child Object Align to Artboard - Move Group",
    "子对象改尺寸-整组缩放": "Child Object Resize - Scale Group",
    "子对象改坐标-整组移动": "Child Object Move to XY - Move Group",
    "描边颜色同步到填充颜色": "Sync Stroke Color to Fill",
    "生成UPC-A条形码": "Generate UPC-A Barcode",
    "记录对象中心相对画板位置": "Record Object Center Relative to Artboard",
    "选择同色对象-严格版": "Select Same-Color Objects - Strict",
    "选择同色对象-宽松版": "Select Same-Color Objects - Loose",
    "选择对象上方创建白色矩形": "Create White Rectangle Above Selection",
    "选择对象黑白互换": "Swap Black and White in Selection",
    "选择对象改颜色_排除一些": "Change Selection Color - Exclude Some",
    "选择对象转自定义颜色": "Turn Selection to Custom Color",
    "选择转自定义颜色-其余转自定义颜色": "Selection to Custom Color, Others to Custom Color",
    "选择-真正无用的空对象": "Select Truly Useless Empty Objects",
    "InDesign_Document_Info": "InDesign Document Info",
    "Photoshop_Document_Info": "Photoshop Document Info",
    "复制Beauty和Denoised beauty置顶": "Copy Beauty and Denoised Beauty to Top",
    "复制当前选择图层到剪贴板": "Copy Selected Layer to Clipboard",
    "恢复当前文档图层可见": "Restore Layer Visibility in Current Document",
    "粘贴剪贴板到当前图层蒙版": "Paste Clipboard into Current Layer Mask",
    "记录当前文档图层可见": "Record Layer Visibility in Current Document",
    "选择图层添加白色颜色叠加": "Apply White Color Overlay to Selected Layers"
  };

  var LANGUAGE_KEY = "hgscripts.language";
  var currentLanguage = "zh-CN";
  var warned = {};

  function normalizeMode(value) {
    value = String(value || "auto");
    if (value === "zh-CN" || value === "en-US" || value === "auto") {
      return value;
    }
    return "auto";
  }

  function detectHostLanguage(cs) {
    try {
      var host = cs && cs.getHostEnvironment ? cs.getHostEnvironment() : (cs && cs.hostEnvironment);
      var raw = String((host && (host.appUILocale || host.appLocale)) || (global.navigator && global.navigator.language) || "");
      return /^zh/i.test(raw) ? "zh-CN" : "en-US";
    } catch (err) {
      return /^zh/i.test(String((global.navigator && global.navigator.language) || "")) ? "zh-CN" : "en-US";
    }
  }

  function resolve(mode, detected) {
    mode = normalizeMode(mode);
    if (mode === "auto") {
      return detected === "zh-CN" ? "zh-CN" : "en-US";
    }
    return mode;
  }

  function setLanguage(value) {
    currentLanguage = value === "en-US" ? "en-US" : "zh-CN";
    try {
      if (global.document && global.document.body) {
        global.document.body.setAttribute("data-language", currentLanguage);
      }
    } catch (err) {}
    return currentLanguage;
  }

  function getLanguage() {
    return currentLanguage;
  }

  function isEnglish() {
    return currentLanguage === "en-US";
  }

  function warnOnce(key, reason) {
    if (warned[key]) {
      return;
    }
    warned[key] = true;
    try {
      if (global.console && global.console.warn) {
        global.console.warn("[HGI18N] " + reason + ": " + key);
      }
    } catch (err) {}
  }

  function format(value, params) {
    if (!params) {
      return value;
    }
    return String(value).replace(/\{(\w+)\}/g, function (match, name) {
      return params.hasOwnProperty(name) ? String(params[name]) : match;
    });
  }

  function t(key, params) {
    var row = TEXT[key];
    if (!row) {
      warnOnce(key, "missing key");
      return format(key, params);
    }
    var value = row[isEnglish() ? 1 : 0];
    if (!value) {
      warnOnce(key, "missing " + (isEnglish() ? "en-US" : "zh-CN") + " text");
      value = row[isEnglish() ? 0 : 1] || key;
    }
    return format(value, params);
  }

  function sceneLabel(sceneId) {
    for (var i = 0; i < SCENES.length; i++) {
      if (SCENES[i].id === sceneId) {
        return t(SCENES[i].labelKey);
      }
    }
    return t("sceneScript");
  }

  function scriptTitle(base) {
    if (isEnglish() && SCRIPT_TITLES_EN[base]) {
      return SCRIPT_TITLES_EN[base];
    }
    return base || "";
  }

  function applyStatic(scope) {
    var doc = global.document;
    if (!doc) {
      return;
    }
    var rootNode = scope || doc;
    var nodes = rootNode.querySelectorAll ? rootNode.querySelectorAll("[data-i18n],[data-i18n-placeholder],[data-i18n-title]") : [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.getAttribute("data-i18n")) {
        node.textContent = t(node.getAttribute("data-i18n"));
      }
      if (node.getAttribute("data-i18n-placeholder")) {
        node.setAttribute("placeholder", t(node.getAttribute("data-i18n-placeholder")));
      }
      if (node.getAttribute("data-i18n-title")) {
        node.setAttribute("title", t(node.getAttribute("data-i18n-title")));
      }
    }
  }

  global.HGI18N = {
    TEXT: TEXT,
    SCENES: SCENES,
    SCRIPT_TITLES_EN: SCRIPT_TITLES_EN,
    normalizeMode: normalizeMode,
    detectHostLanguage: detectHostLanguage,
    resolve: resolve,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    isEnglish: isEnglish,
    t: t,
    applyStatic: applyStatic,
    sceneLabel: sceneLabel,
    scriptTitle: scriptTitle,
    LANGUAGE_KEY: LANGUAGE_KEY
  };

  /* 启动时先按浏览器语言给静态 HTML 一个合理初值，面板加载设置后会再次覆盖。 */
  setLanguage(resolve("auto", detectHostLanguage(null)));

  /* 静态 HTML 文本在 DOM 就绪后按 data-i18n 标记翻译一次。 */
  try {
    if (global.document && global.document.addEventListener) {
      if (global.document.readyState === "loading") {
        global.document.addEventListener("DOMContentLoaded", function () {
          applyStatic();
        });
      } else {
        applyStatic();
      }
    }
  } catch (err) {}
})(typeof window !== "undefined" ? window : this);
