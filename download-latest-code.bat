@echo off
setlocal
cd /d "%~dp0"

call "%~dp0一键下载最新代码.bat"
exit /b %ERRORLEVEL%
