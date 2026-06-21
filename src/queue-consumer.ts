// queue-consumer.ts — Execution Engine для Dark Mnmll Pulse OS
//
// Это и есть разница между "роем агентов" как идеей и роем, который реально
// что-то делает: задача из /api/agents/spawn попадает в очередь
// pulse-swarm-tasks, этот consumer её забирает, прогоняет через AI Router,
// пишет результат в D1 и обновляет статус агента в Agent Registry.
//
// Подключение (см. INTEGRATION.md):
//   1. экспортировать handleQueueBatch как `queue` в worker/src/index.ts
//   2. в wrangler.toml уже должен быть биндинг очереди pulse-swarm-tasks
//   3. накатить миграцию 0004_agent_registry.sql

import { routedRun } from './nexus-router';

export interface SwarmTask {
  taskId: string;
  agentId: string;
  userId?: string;
  taskType: string;
  payload: Record<string, unknown>;
}

interface AgentRow {
  id: string;
  role: string;
  name: string;
  status: string;
  error_count: number;
}

// После скольких подряд проваленных задач агент автоматически уходит
// в 'offline' — это не "self-healing", это просто честная деградация:
// система не пытается сама переписать код, она перестаёт давать агенту
// новые задачи и ждёт, что человек разберётся.
const MAX_ERRORS_BEFORE_DISABLE = 5;

export async function handleQueueBatch(
  batch: MessageBatch<SwarmTask>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    const task = message.body;
    try {
      await markProcessing(env, task);
      const result = await executeAgentTask(env, task);
      await markDone(env, task, result);
      message.ack();
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      await markFailed(env, task, errMessage);
      if (message.attempts < 3) {
        message.retry();
      } else {
        // отдали 3 попытки — дальше не ретраим бесконечно, оставляем
        // 'failed' в D1 на ручной разбор через Dashboard
        message.ack();
      }
    }
  }
}

async function markProcessing(env: Env, task: SwarmTask): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent_tasks SET status='processing', attempts=attempts+1 WHERE id=?`
  )
    .bind(task.taskId)
    .run();

  await env.DB.prepare(
    `UPDATE agents SET status='busy', last_heartbeat=datetime('now'), updated_at=datetime('now') WHERE id=?`
  )
    .bind(task.agentId)
    .run();
}

async function executeAgentTask(env: Env, task: SwarmTask): Promise<string> {
  const agent = await env.DB.prepare(`SELECT * FROM agents WHERE id=?`)
    .bind(task.agentId)
    .first<AgentRow>();

  if (!agent) throw new Error(`Unknown agent: ${task.agentId}`);

  const systemPrompt =
    `Ты ${agent.name}, роль ${agent.role} в иерархии Dark Mnmll Pulse OS Swarm. ` +
    `Тип задачи: ${task.taskType}. Отвечай по-русски, кратко, по делу, без преамбул.`;

  const userContent =
    typeof task.payload?.command === 'string'
      ? task.payload.command
      : JSON.stringify(task.payload ?? {});

  // FIX: раньше здесь был захардкоженный 'anthropic/claude-sonnet-4-6' —
  // неверный формат слага (нужна точка перед версией: claude-sonnet-4.6,
  // не дефис), и без какой-либо логики выбора модели. Теперь идёт через
  // Universal Router — сам решает, какая модель из каталога подходит под
  // задачу, и не требует ANTHROPIC_KEY/OPENAI_KEY/GEMINI_KEY.
  const { text } = await routedRun(env, userContent, { system: systemPrompt, maxTokens: 1000 });
  return text;
}

async function markDone(env: Env, task: SwarmTask, result: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent_tasks SET status='done', result=?, finished_at=datetime('now') WHERE id=?`
  )
    .bind(result, task.taskId)
    .run();

  await env.DB.prepare(
    `UPDATE agents SET status='online', total_tasks=total_tasks+1, updated_at=datetime('now') WHERE id=?`
  )
    .bind(task.agentId)
    .run();
}

async function markFailed(env: Env, task: SwarmTask, errorMessage: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent_tasks SET status='failed', error=?, finished_at=datetime('now') WHERE id=?`
  )
    .bind(errorMessage, task.taskId)
    .run();

  await env.DB.prepare(
    `UPDATE agents SET error_count=error_count+1, updated_at=datetime('now') WHERE id=?`
  )
    .bind(task.agentId)
    .run();

  const agent = await env.DB.prepare(`SELECT error_count FROM agents WHERE id=?`)
    .bind(task.agentId)
    .first<{ error_count: number }>();

  if (agent && agent.error_count >= MAX_ERRORS_BEFORE_DISABLE) {
    await env.DB.prepare(`UPDATE agents SET status='offline' WHERE id=?`)
      .bind(task.agentId)
      .run();
  } else {
    await env.DB.prepare(`UPDATE agents SET status='online' WHERE id=?`)
      .bind(task.agentId)
      .run();
  }
}
