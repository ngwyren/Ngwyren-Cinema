@echo off
title Ngwyren Cinema - Ket Noi Google OAuth Tu Dong
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup_google_oauth.ps1"
pause
