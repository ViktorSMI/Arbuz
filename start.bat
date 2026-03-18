@echo off
title Arbuz Souls - Server
echo ========================================
echo   ARBUZ SOULS - Game Server
echo ========================================
echo.
echo Starting HTTP server on port 8000...
echo.
echo Open in browser: http://localhost:8000/index3d.html
echo.
start http://localhost:8000/index3d.html
python -m http.server 8000
pause
