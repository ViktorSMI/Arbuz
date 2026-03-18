#!/bin/bash
# Запуск тестового бота Arbuzilla
# Использование:
#   ./test-bot/run.sh              — headless режим
#   ./test-bot/run.sh --headed     — с окном браузера
#   ./test-bot/run.sh --url http://... — свой URL

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Проверяем что playwright установлен
if ! npx playwright --version &>/dev/null; then
  echo "Устанавливаю Playwright..."
  npm install -D playwright
  npx playwright install chromium
fi

# Запускаем локальный сервер если не указан URL
if [[ ! "$*" == *"--url"* ]]; then
  echo "Запускаю локальный HTTP-сервер..."
  # Пробуем разные серверы
  if command -v python3 &>/dev/null; then
    python3 -m http.server 8080 --directory "$PROJECT_DIR" &
    SERVER_PID=$!
  elif command -v npx &>/dev/null; then
    npx -y serve "$PROJECT_DIR" -l 8080 -s &
    SERVER_PID=$!
  else
    echo "ОШИБКА: Нужен python3 или npx serve для запуска HTTP-сервера"
    exit 1
  fi
  sleep 2
  echo "Сервер запущен на http://localhost:8080"
  trap "kill $SERVER_PID 2>/dev/null" EXIT
fi

# Запускаем бота
node "$SCRIPT_DIR/bot.js" "$@"
