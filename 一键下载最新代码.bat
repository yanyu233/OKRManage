@echo off
setlocal
cd /d "%~dp0"

echo === OKRManage Download ===
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0git-download.ps1" -Stash
set EXIT_CODE=%ERRORLEVEL%

echo.
if "%EXIT_CODE%"=="0" (
  echo Download finished successfully.
) else (
  echo Download failed. Exit code: %EXIT_CODE%
)

echo.
pause
exit /b %EXIT_CODE%
