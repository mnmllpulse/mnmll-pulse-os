#!/bin/bash
# setup-cloudflare.sh — Dark Mnmll Pulse OS
#
# Автоматизирует всё, что реально можно автоматизировать через wrangler CLI.
# Honestly: НЕ может за тебя создать API-токен и привязать карту к AI
# Gateway Credits — это осознанно ручные шаги (создание токена — это ввод
# учётных данных, платёжная карта — это деньги, оба шага не должны
# выполняться скриптом из соображений безопасности). Эти два шага описаны
# отдельно ниже, выполняются один раз руками в дашборде.
#
# Запуск: bash scripts/setup-cloudflare.sh

set -e

echo "════════════════════════════════════════════════════"
echo " Dark Mnmll Pulse OS — Cloudflare Setup"
echo "════════════════════════════════════════════════════"
echo

# ── Шаг 0: проверка авторизации ─────────────────────────────────────
if ! command -v npx &> /dev/null; then
  echo "❌ npx не найден. Установи Node.js сначала."
  exit 1
fi

echo "→ Проверяю авторизацию wrangler..."
if ! npx wrangler whoami &> /dev/null; then
  echo
  echo "Не авторизован. Откроется браузер для логина в Cloudflare."
  echo "(Если на Termux нет браузера — см. ручную альтернативу через"
  echo " API-токен ниже, в разделе 'РУЧНЫЕ ШАГИ'.)"
  npx wrangler login
fi
echo "✅ Авторизация OK"
echo

# ── Шаг 1: проверка существования D1 (НЕ создаём заново) ───────────
echo "→ Проверяю D1 базу dark-planet-db..."
if npx wrangler d1 list 2>/dev/null | grep -q "dark-planet-db"; then
  echo "✅ dark-planet-db уже существует, пропускаю создание"
else
  echo "⚠️  dark-planet-db не найдена в этом аккаунте."
  read -p "Создать новую? (y/N) " confirm
  if [[ "$confirm" == "y" ]]; then
    npx wrangler d1 create dark-planet-db
    echo "⚠️  Скопируй database_id из вывода выше в worker/wrangler.toml вручную"
  else
    echo "Пропускаю. Проверь, что имя базы в wrangler.toml совпадает с реальным."
  fi
fi
echo

# ── Шаг 2: применить миграции ────────────────────────────────────────
echo "→ Применяю миграции к боевой D1..."
for migration in worker/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "  применяю $migration..."
    npx wrangler d1 execute dark-planet-db --remote --file="$migration"
  fi
done
echo "✅ Миграции применены"
echo

# ── Шаг 3: создать очередь (если ещё не создана) ────────────────────
echo "→ Проверяю очередь pulse-swarm-tasks..."
if npx wrangler queues list 2>/dev/null | grep -q "pulse-swarm-tasks"; then
  echo "✅ Очередь уже существует"
else
  npx wrangler queues create pulse-swarm-tasks
  echo "✅ Очередь создана"
fi
echo

# ── Шаг 4: секреты Worker (интерактивно, по одному) ──────────────────
echo "→ Секреты Worker — вводи значения, когда спросит (или Ctrl+C чтобы пропустить):"
read -p "Настроить STRIPE_SECRET сейчас? (y/N) " s1
[[ "$s1" == "y" ]] && npx wrangler secret put STRIPE_SECRET
read -p "Настроить STRIPE_WEBHOOK_SECRET сейчас? (y/N) " s2
[[ "$s2" == "y" ]] && npx wrangler secret put STRIPE_WEBHOOK_SECRET
read -p "Настроить SECRET_KEY (для JWT) сейчас? (y/N) " s3
[[ "$s3" == "y" ]] && npx wrangler secret put SECRET_KEY
echo

# ── Шаг 5: деплой ────────────────────────────────────────────────────
echo "→ Деплою Worker..."
cd worker && npx wrangler deploy && cd ..
echo "✅ Worker задеплоен"
echo

echo "════════════════════════════════════════════════════"
echo " ГОТОВО (автоматическая часть)"
echo "════════════════════════════════════════════════════"
echo
echo "РУЧНЫЕ ШАГИ (нельзя/не нужно автоматизировать):"
echo
echo "1. API-токен с ограниченным сроком жизни:"
echo "   dash.cloudflare.com/profile/api-tokens → Create Token → Custom Token"
echo "   Права: Account.Workers Scripts:Edit, Account.D1:Edit, Account.Workers AI:Edit"
echo "   TTL: поставь дату окончания, не оставляй 'No expiration'"
echo "   Скопируй токен — показывается один раз"
echo
echo "2. GitHub Secrets (Settings → Secrets and variables → Actions):"
echo "   CF_API_TOKEN     = токен из пункта 1"
echo "   CF_ACCOUNT_ID    = $(npx wrangler whoami 2>/dev/null | grep -oP 'Account ID: \K[a-f0-9]+' || echo 'см. dash.cloudflare.com → правый сайдбар')"
echo "   VITE_WORKER_URL  = https://mnmll-pulse-core.<твой-субдомен>.workers.dev"
echo
echo "3. AI Gateway Credits (для routedRun / Universal Router):"
echo "   dash.cloudflare.com → AI → AI Gateway → Credits Available → Manage"
echo "   Привязать карту, пополнить баланс — без этого AI-вызовы не пройдут"
