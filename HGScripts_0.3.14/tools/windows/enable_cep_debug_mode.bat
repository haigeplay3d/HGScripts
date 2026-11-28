@echo off
setlocal EnableExtensions

echo.
echo ==========================================
echo  Enable HGScripts Panel Support
echo ==========================================
echo.
echo This enables unsigned CEP extensions for the current Windows user.
echo.
for %%V in (7 8 9 10 11 12 13 14 15) do (
  reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
  if errorlevel 1 goto reg_error
)

echo Done.
echo Restart Adobe apps, then open Window ^> Extensions ^> HGScripts.
echo.
pause
exit /b 0

:reg_error
echo.
echo [ERROR] Failed to write the setting.
echo.
pause
exit /b 1