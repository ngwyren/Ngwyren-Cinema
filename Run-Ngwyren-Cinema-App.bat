@echo off
chcp 65001 >nul
start "" msedge --app="%~dp0index.html" 2>nul || start "" chrome --app="%~dp0index.html" 2>nul || start "" "%~dp0index.html"
