@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===================================================
echo   NGWYREN CINEMA - AUTO PUSH TO GITHUB
echo   Repo: https://github.com/ngwyren/Ngwyren-Cinema.git
echo ===================================================
git init
git checkout -B main
git add -A
git commit -m "feat: Ngwyren Cinema minimal monochrome UI & full movie sync"
git remote remove origin 2>nul
git remote add origin https://github.com/ngwyren/Ngwyren-Cinema.git
git push -u origin main --force
echo.
echo Hoan tat!
pause
