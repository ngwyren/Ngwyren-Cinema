@echo off
chcp 65001 >nul
echo ========================================================
echo   NGWYREN CINEMA - CẬP NHẬT PHIM MỚI NHẤT MỖI NGÀY 12H ĐÊM
echo ========================================================
echo.

set NODE_PATH=C:\Users\PC-25\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
if not exist "%NODE_PATH%" set NODE_PATH=node

echo [*] Đang cào các phim mới phát hành từ máy chủ trực tuyến...
"%NODE_PATH%" "%~dp0scripts\daily-movie-update.js"

echo.
echo [*] Đồng bộ lên GitHub Pages...
set GIT_PATH=C:\Users\PC-25\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe
if not exist "%GIT_PATH%" set GIT_PATH=git

"%GIT_PATH%" -C "%~dp0" add js/movies-catalog.js
"%GIT_PATH%" -C "%~dp0" commit -m "chore(auto): cập nhật phim mới phát hành 12h đêm"
"%GIT_PATH%" -C "%~dp0" push origin main

echo.
echo [V] Hoàn tất cập nhật kho phim mới nhất!
pause
