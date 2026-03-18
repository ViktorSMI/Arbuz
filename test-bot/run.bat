@echo off
REM Запуск тестового бота Arbuzilla (Windows)
REM Использование:
REM   test-bot\run.bat              — headless режим
REM   test-bot\run.bat --headed     — с окном браузера

SET SCRIPT_DIR=%~dp0
SET PROJECT_DIR=%SCRIPT_DIR%..

REM Проверяем наличие playwright
npx playwright --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo Устанавливаю Playwright...
    npm install -D playwright
    npx playwright install chromium
)

REM Запускаем HTTP-сервер
echo Запускаю HTTP-сервер на порту 8080...
start /B python -m http.server 8080 --directory "%PROJECT_DIR%"
timeout /t 2 /nobreak >nul

REM Запускаем бота
node "%SCRIPT_DIR%bot.js" %*

REM Останавливаем сервер
taskkill /F /IM python.exe >nul 2>&1
