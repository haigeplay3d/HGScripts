@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SOURCE_ROOT=%~dp0..\..\plugins\illustrator-win"
set "FOUND=0"
set "INSTALLED=0"

echo.
echo ==========================================
echo  HGScripts Illustrator Acceleration
echo ==========================================
echo.
echo This installs the matching unified HGScripts .aip file for each Illustrator version.
echo C++ acceleration supports Illustrator versions: 2023, 2024, 2025, 2026.
echo Illustrator 2021 uses the CEP/JSX panel only; no HGScripts .aip is bundled for 2021.
echo Please run this file as administrator.
echo.

for /D %%I in ("C:\Program Files\Adobe\Adobe Illustrator *") do (
  if exist "%%~fI\Plug-ins" (
    set "FOUND=1"
    call :detect_year "%%~nxI"
    if defined AI_YEAR (
      call :install_one "%%~fI\Plug-ins" "!AI_YEAR!"
    )
  )
)

echo.
if "%FOUND%"=="0" (
  echo [ERROR] No Illustrator Plug-ins folder was found.
  echo.
  pause
  exit /b 1
)

if "%INSTALLED%"=="0" (
  echo [ERROR] No plugin was installed. Please run as administrator.
  echo.
  pause
  exit /b 1
)

echo Installation completed.
echo Please restart Illustrator.
echo.
pause
exit /b 0

:detect_year
set "AI_YEAR="
set "AI_NAME=%~1"
echo %AI_NAME% | findstr /C:"2021" >nul && echo Illustrator 2021 detected: skipping C++ acceleration plugin.
echo %AI_NAME% | findstr /C:"2023" >nul && set "AI_YEAR=2023"
echo %AI_NAME% | findstr /C:"2024" >nul && set "AI_YEAR=2024"
echo %AI_NAME% | findstr /C:"2025" >nul && set "AI_YEAR=2025"
echo %AI_NAME% | findstr /C:"2026" >nul && set "AI_YEAR=2026"
exit /b 0

:install_one
set "PLUGIN_ROOT=%~1\HGScripts"
set "AI_YEAR=%~2"
set "SOURCE_DIR=%SOURCE_ROOT%\%AI_YEAR%"

if not exist "%SOURCE_DIR%\*.aip" (
  echo Missing plugin files for Illustrator %AI_YEAR%: %SOURCE_DIR%
  exit /b 0
)

echo Installing Illustrator %AI_YEAR% plugins to:
echo %PLUGIN_ROOT%

if exist "%PLUGIN_ROOT%" rmdir /S /Q "%PLUGIN_ROOT%"
mkdir "%PLUGIN_ROOT%"
if errorlevel 1 goto install_error

for %%F in ("%SOURCE_DIR%\*.aip") do (
  copy /Y "%%~fF" "%PLUGIN_ROOT%\%%~nxF" >nul
  if errorlevel 1 goto install_error
)

set "INSTALLED=1"
echo Done.
echo.
exit /b 0

:install_error
echo [ERROR] Failed to install to: %PLUGIN_ROOT%
echo.
exit /b 1