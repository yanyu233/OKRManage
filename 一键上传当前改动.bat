@echo off
setlocal
cd /d "%~dp0"

echo === OKRManage Upload ===
echo.
set /p COMMIT_MESSAGE=Commit message (leave blank for auto timestamp): 

if "%COMMIT_MESSAGE%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0git-upload.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0git-upload.ps1" -Message "%COMMIT_MESSAGE%"
)

set EXIT_CODE=%ERRORLEVEL%

echo.
if "%EXIT_CODE%"=="0" (
  echo Upload finished successfully.
) else (
  echo Upload failed. Exit code: %EXIT_CODE%
)

echo.
pause
exit /b %EXIT_CODE%
