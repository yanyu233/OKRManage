@echo off
setlocal
cd /d "%~dp0"

call "%~dp0一键上传当前改动.bat"
exit /b %ERRORLEVEL%
