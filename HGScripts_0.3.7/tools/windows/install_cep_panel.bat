@echo off
setlocal EnableExtensions

set "PLUGIN_NAME=HGScripts"
set "SOURCE_DIR=%~dp0..\..\cep\HGScripts"
set "TARGET_DIR=%APPDATA%\Adobe\CEP\extensions\%PLUGIN_NAME%"

echo.
echo ==========================================
echo  HGScripts v0.3.7 Installer
echo ==========================================
echo.
if not exist "%SOURCE_DIR%\CSXS\manifest.xml" (
  echo [ERROR] Plugin folder was not found:
  echo %SOURCE_DIR%
  echo.
  pause
  exit /b 1
)

echo [1/3] Preparing target folders
if exist "%TARGET_DIR%" rmdir /S /Q "%TARGET_DIR%"
mkdir "%TARGET_DIR%"
if not exist "%TARGET_DIR%\data" mkdir "%TARGET_DIR%\data"
if not exist "%TARGET_DIR%\user_scripts" mkdir "%TARGET_DIR%\user_scripts"

echo [2/3] Copying panel files
robocopy "%SOURCE_DIR%\assets" "%TARGET_DIR%\assets" /E /R:2 /W:1 >nul
if errorlevel 8 goto copy_error
robocopy "%SOURCE_DIR%\CSXS" "%TARGET_DIR%\CSXS" /E /R:2 /W:1 >nul
if errorlevel 8 goto copy_error
robocopy "%SOURCE_DIR%\scripts" "%TARGET_DIR%\scripts" /E /R:2 /W:1 >nul
if errorlevel 8 goto copy_error
for %%F in (index.html index_full.html index_legacy_full.html index_2023_safe.html) do (
  copy /Y "%SOURCE_DIR%\%%F" "%TARGET_DIR%\%%F" >nul
  if errorlevel 1 goto copy_error
)
if exist "%SOURCE_DIR%\README.md" (
  copy /Y "%SOURCE_DIR%\README.md" "%TARGET_DIR%\README.md" >nul
  if errorlevel 1 goto copy_error
)
copy /Y "%SOURCE_DIR%\data\script_icons.json" "%TARGET_DIR%\data\script_icons.json" >nul
if errorlevel 1 goto copy_error
copy /Y "%SOURCE_DIR%\data\settings.json" "%TARGET_DIR%\data\settings.json" >nul
if errorlevel 1 goto copy_error

echo [3/4] Copying bundled scripts
robocopy "%SOURCE_DIR%\user_scripts" "%TARGET_DIR%\user_scripts" /E /R:2 /W:1 >nul
if errorlevel 8 goto copy_error

echo [4/4] Adjusting display scale
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Set-CepManifestDpiScale.ps1" -ManifestPath "%TARGET_DIR%\CSXS\manifest.xml"
if errorlevel 1 goto dpi_error

echo.
echo Installation completed.
echo Target: %TARGET_DIR%
echo.
echo Restart Adobe apps, then open Window ^> Extensions ^> HGScripts.
echo.
pause
exit /b 0

:copy_error
echo.
echo [ERROR] Copy failed. Please close Adobe apps and check folder permissions.
echo Target: %TARGET_DIR%
echo.
pause
exit /b 1

:dpi_error
echo.
echo [ERROR] Display scale adjustment failed. Please run again after closing Adobe apps.
echo Target: %TARGET_DIR%\CSXS\manifest.xml
echo.
pause
exit /b 1