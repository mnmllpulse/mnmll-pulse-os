// DARK MNMLL PULSE OS v14.0 — Cloudflare Worker
// AI-вызовы идут через Universal Router (nexus-router.ts) и Cloudflare AI
// Gateway (Unified Billing) — отдельный ключ провайдера НЕ нужен, см.
// wrangler.toml binding [[ai]].

import { routedRun } from './nexus-router';
import { handleQueueBatch } from './queue-consumer';
import { analyzeTrackAI } from './track-analyzer';

// CORS теперь динамический, не захардкожен под один домен — иначе
// pulse-labs.org получал бы заблокированный браузером ответ, потому что
// Access-Control-Allow-Origin не совпадал бы с его origin. Список
// разрешённых доменов берётся из CORS_ORIGIN в wrangler.toml [vars].
function getCors(env: any, request: Request) {
  const allowed = (env.CORS_ORIGIN || 'https://mnmllpulse.com').split(',');
  const origin = request.headers.get('Origin') || '';
  const allow = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

const SEC_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' https://mnmllpulse.com https://pulse-labs.org",
};

function json(data: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors, ...SEC_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const CORS = getCors(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, version: '14.0', modules: 50 }, 200, CORS);
    }

    // Единая точка входа для AI — раньше тут был прямой fetch на
    // api.anthropic.com с хардкодом ключа. Теперь вся маршрутизация идёт
    // через routedRun(), который сам выбирает модель по intent/сложности
    // и ходит через env.AI.run() + AI Gateway, без сторонних ключей.
    if (url.pathname === '/api/divine' && request.method === 'POST') {
      try {
        const { prompt, system } = await request.json();
        const { text } = await routedRun(env, prompt, {
          system: system || 'You are Azrail, AI of Dark Mnmll Pulse OS. Russian.',
          maxTokens: 1000,
        });
        return json({ output: text }, 200, CORS);
      } catch (err) {
        console.error('/api/divine error:', err);
        return json({ error: 'AI service temporarily unavailable', fallback: true }, 503, CORS);
      }
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { system, messages, max_tokens } = await request.json();
        const lastUser = messages?.[messages.length - 1]?.content || '';
        const { text } = await routedRun(env, lastUser, { system, messages, maxTokens: max_tokens });
        return json({ reply: text }, 200, CORS);
      } catch (err) {
        console.error('/api/chat error:', err);
        return json({ error: 'AI service temporarily unavailable', fallback: true }, 503, CORS);
      }
    }

    // Music Intelligence Layer — Track Analyzer (см. track-analyzer.ts)
    if (url.pathname === '/api/music/analyze' && request.method === 'POST') {
      try {
        const track = await request.json();
        const result = await analyzeTrackAI(env, track);
        return json(result, 200, CORS);
      } catch (err) {
        console.error('/api/music/analyze error:', err);
        return json({ error: 'Analysis failed', message: (err as Error).message }, 500, CORS);
      }
    }

    // Execution Engine — задача ставится в очередь, не выполняется тут же
    if (url.pathname === '/api/agents/spawn' && request.method === 'POST') {
      const { agentId, taskType, payload, userId } = await request.json();
      const taskId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO agent_tasks (id, agent_id, user_id, task_type, payload) VALUES (?, ?, ?, ?, ?)`
      ).bind(taskId, agentId, userId ?? null, taskType, JSON.stringify(payload ?? {})).run();
      await env.SWARM_QUEUE.send({ taskId, agentId, userId, taskType, payload });
      return json({ taskId, status: 'queued' }, 200, CORS);
    }

    const taskMatch = url.pathname.match(/^\/api\/agents\/tasks\/([\w-]+)$/);
    if (taskMatch && request.method === 'GET') {
      const row = await env.DB.prepare(`SELECT * FROM agent_tasks WHERE id=?`).bind(taskMatch[1]).first();
      if (!row) return json({ error: 'not found' }, 404, CORS);
      return json(row, 200, CORS);
    }

    if (url.pathname === '/api/agents/registry' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT id, parent_id, name, role, status, version, error_count, total_tasks, last_heartbeat FROM agents ORDER BY role, id`
      ).all();
      return json({ agents: results }, 200, CORS);
    }

    return json({ error: 'Not found' }, 404, CORS);
  },

  // Execution Engine consumer — реально разгребает очередь pulse-swarm-tasks
  async queue(batch: any, env: any) {
    await handleQueueBatch(batch, env);
  },
};
