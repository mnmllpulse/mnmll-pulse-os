# Интеграция Agent Registry + Execution Engine + Universal Router

Это НЕ замена твоего текущего `worker/src/index.ts` — там уже есть JWT,
Stripe, валидация и так далее. Это то, что нужно ДОБАВИТЬ в него.

## 0. Главное: про ключи провайдеров — короткая версия

Скрины, которые ты прислал, показывают каталог Cloudflare AI Platform —
165 моделей, включая Claude Opus 4.8. Ты прав, что отдельные провайдерские
ключи (`ANTHROPIC_KEY`, `OPENAI_KEY`, `GEMINI_KEY`) для вызова через
`env.AI.run()` не нужны — это подтверждено документацией Cloudflare AI
Gateway (Unified Billing). Но есть нюансы, которые стоит знать точно:

- Это работает НЕ потому что "купил домен" — доменная регистрация и AI
  Gateway вообще не связаны. Это работает потому что у тебя Cloudflare-
  аккаунт с включённым AI Gateway и Unified Billing.
- Это не бесплатно: Cloudflare сама платит провайдеру и списывает кредиты
  с твоего аккаунта (тарифы провайдера без накрутки, но при покупке самих
  кредитов берётся комиссия 5%). Нужна привязанная карта и пополненный
  баланс кредитов в разделе AI Gateway → Credits Available.
- BYOK (свой ключ) для сторонних моделей через `env.AI.run()` НЕ
  поддерживается — это осознанное ограничение Cloudflare: биндинг работает
  только в режиме Unified Billing. Свой ключ можно использовать только
  через провайдер-специфичные REST-эндпоинты, но тебе это не нужно.

Чеклист (один раз, руками в Cloudflare Dashboard):
1. AI → AI Gateway → убедиться, что гейтвей `default` существует (создаётся
   автоматически при первом запросе, можно не трогать).
2. Там же → Credits Available → Manage → привязать способ оплаты → Top-up.
3. Всё. Дальше `env.AI.run('anthropic/claude-sonnet-4.6', ..., {gateway:{id:'default'}})`
   просто работает, без единого секрета в wrangler.toml.

Из `nexus-core-v5.js` (черновик из твоего ремикса) можно убрать
`OPENAI_KEY`/`GEMINI_KEY` из `wrangler.toml` — они больше не нужны.

## 1. Накатить миграцию

```bash
npx wrangler d1 execute dark-planet-db --file=worker/migrations/0004_agent_registry.sql
# на проде:
npx wrangler d1 execute dark-planet-db --remote --file=worker/migrations/0004_agent_registry.sql
```

Если в `ALTER TABLE` упадёт ошибка `duplicate column name` — значит какая-то
из колонок (`version`, `error_count`, `total_tasks`, `last_heartbeat`,
`updated_at`) у тебя уже есть. Просто удали соответствующую строку из файла
миграции и прогони заново.

## 2. wrangler.toml — добавить consumer очереди

Продюсер `pulse-swarm-tasks` у тебя уже есть. Нужно добавить consumer:

```toml
[[queues.consumers]]
queue = "pulse-swarm-tasks"
max_batch_size = 10
max_batch_timeout = 5
max_retries = 3
```

## 3. index.ts — подключить queue-consumer.ts

```ts
import { handleQueueBatch } from './queue-consumer';

export default {
  async fetch(request, env, ctx) {
    // ...твой текущий fetch-обработчик без изменений
  },

  async queue(batch, env, ctx) {
    await handleQueueBatch(batch, env);
  },

  async scheduled(event, env, ctx) {
    // ...твой текущий cron-обработчик без изменений
  },
};
```

## 4. Переписать /api/agents/spawn (сейчас он на ctx.waitUntil)

Вместо прямого выполнения — кладём задачу в D1 и в очередь, отдаём
`taskId` сразу:

```ts
if (url.pathname === '/api/agents/spawn' && request.method === 'POST') {
  const { agentId, taskType, payload, userId } = await request.json();
  const taskId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO agent_tasks (id, agent_id, user_id, task_type, payload) VALUES (?, ?, ?, ?, ?)`
  ).bind(taskId, agentId, userId ?? null, taskType, JSON.stringify(payload ?? {})).run();

  await env.SWARM_QUEUE.send({ taskId, agentId, userId, taskType, payload });

  return json({ taskId, status: 'queued' });
}
```

(`SWARM_QUEUE` — биндинг продюсера очереди, который у тебя уже должен быть
в wrangler.toml как `[[queues.producers]]`.)

## 5. Новые эндпоинты для чтения статуса

```ts
if (url.pathname === '/api/agents/registry' && request.method === 'GET') {
  const { results } = await env.DB.prepare(
    `SELECT id, parent_id, name, role, status, version, error_count, total_tasks, last_heartbeat FROM agents ORDER BY role, id`
  ).all();
  return json({ agents: results });
}

const taskMatch = url.pathname.match(/^\/api\/agents\/tasks\/([\w-]+)$/);
if (taskMatch && request.method === 'GET') {
  const row = await env.DB.prepare(`SELECT * FROM agent_tasks WHERE id=?`)
    .bind(taskMatch[1])
    .first();
  if (!row) return json({ error: 'not found' }, 404);
  return json(row);
}
```

## 6. /api/chat — теперь через Universal Router

Раньше `/api/chat` (судя по `pulseAI()` в HTML) скорее всего напрямую дёргал
одну модель. Меняем на роутер, который сам выбирает модель по intent и
сложности, и отдаёт диагностику в заголовках — ровно то, что было в твоём
`nexus-core-v5.js` (X-Nexus-Scan/Intent/Complexity), но без отдельных
провайдерских ключей:

```ts
import { routedRun } from './nexus-router';

if (url.pathname === '/api/chat' && request.method === 'POST') {
  const { system, messages, max_tokens } = await request.json();
  const lastUser = messages?.[messages.length - 1]?.content || '';

  const { text, model, scan, fallback } = await routedRun(env, lastUser, {
    system,
    messages,
    maxTokens: max_tokens,
  });

  return new Response(JSON.stringify({ reply: text }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Nexus-Intent': scan.intent,
      'X-Nexus-Complexity': scan.complexity.toFixed(2),
      'X-Nexus-Model': model,
      'X-Nexus-Fallback': String(fallback),
      ...CORS,
      ...SEC_HEADERS,
    },
  });
}
```

Обновлённый `dark-mnmll-pulse-os-v14.html` уже шлёт ровно такой запрос
(`{system, messages, max_tokens}`) и понимает ответ `{reply: "..."}` —
ничего на стороне HTML менять не нужно.

## 7. Track Analyzer — Music Intelligence Layer, уровень 1

Накатить `0005_tracks.sql` (актуальная версия — 41 трек с реальными
BPM/тональностью/лейблом по каждому, не только диапазоном по группе).
Затем добавить эндпоинт:

```ts
import { analyzeTrackAI } from './track-analyzer';

if (url.pathname === '/api/music/analyze' && request.method === 'POST') {
  const track = await request.json(); // {artist, title, subgenre, bpm?, key_signature?, description?}
  const result = await analyzeTrackAI(env, track);
  return json(result);
}
```

Это уровень 1 — работает на метаданных и тексте через AI, без аудио-
анализа файла. Три уровня проверки, от дешёвого к дорогому:

1. `checkBpmFit()` — бесплатная, мгновенная проверка диапазона жанра.
2. `checkMixCompatibility()` / `camelotCompatibility()` — детерминированные
   математические проверки без AI: BPM-совместимость (с учётом half/double-
   time, ±8% питч-шифт) и гармоническая совместимость тональностей по
   правилам Camelot Wheel. Считаются для каждого референса, который
   попадёт в выборку.
3. `analyzeTrackAI()` — качественная оценка через AI, использует результаты
   1-2 как контекст, плюс текстовое `description`. Без описания AI
   сравнивает почти вслепую — это поле определяет качество ответа.

Уровень 2 (реальный аудио-анализ файла) по-прежнему не реализован — нужен
отдельный сервис обработки звука вне Worker.

## 8. Автоматическая настройка Cloudflare

`scripts/setup-cloudflare.sh` — делает за тебя всё, что реально можно
автоматизировать через `wrangler` CLI: проверяет авторизацию, накатывает
все миграции из `worker/migrations/*.sql` по очереди, создаёт очередь
`pulse-swarm-tasks` если её ещё нет, интерактивно настраивает секреты,
деплоит Worker.

```bash
bash scripts/setup-cloudflare.sh
```

**Что скрипт намеренно НЕ делает** (и не должен): создание API-токена и
привязку платёжной карты к AI Gateway Credits. Это осознанно ручные шаги —
ввод учётных данных и реквизитов карты не должен происходить через
автоматический скрипт. Точные инструкции по обоим пунктам скрипт выводит
в конце сам.

## Что это даёт по факту

- `/api/agents/spawn` реально ставит задачу в очередь, а не делает один
  `ctx.waitUntil` и забывает.
- Очередь реально разгребается consumer'ом, который вызывает AI, пишет
  результат в D1 и обновляет статус агента.
- Вкладка Swarm в HTML реально опрашивает `/api/agents/tasks/:id`, а не
  делает вид, что агент "выполняет команду".
- После 5 подряд неудачных задач агент уходит в `offline` сам — это и есть
  честная, небольшая версия "self-healing": система не лечит себя, но
  перестаёт грузить заведомо сломанного агента и сигналит, что нужен
  человек.
- `/api/chat` и очередь теперь реально выбирают модель под задачу (быстрые
  запросы → Cloudflare-hosted Llama, код/анализ → Claude Sonnet 4.6), а не
  всегда дёргают одну и ту же модель за одну и ту же цену.

## Заметил по пути (не блокирует, но стоит свести в одно место)

В `sql_c` внутри HTML лимиты тарифов — free=10, plus=100, premium=2000,
max=5000, enterprise=безлимит. Это не совпадает с тем, что мы заводили
раньше для реального Stripe-биллинга (Node/Operator/Syndicate с лимитами
20/100/500/безлимит). Сейчас это просто текст в демо-зипе и не ломает
ничего рабочего, но когда дойдёшь до реального `/api/usage/today`, цифры
и названия тиров стоит свести к одной версии — иначе дашборд будет
показывать не те лимиты, что реально проверяет billing-логика.
