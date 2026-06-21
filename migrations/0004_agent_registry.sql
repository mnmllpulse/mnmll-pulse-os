-- 0004_agent_registry.sql — Agent Lifecycle + Execution Engine
-- Dark Mnmll Pulse OS
--
-- Дополняет уже существующую таблицу `agents` (см. 0001_init.sql / 0003_swarm.sql)
-- колонками жизненного цикла и добавляет `agent_tasks` — журнал реального
-- выполнения задач роем через Cloudflare Queues.
--
-- ВАЖНО: если в твоей текущей схеме `agents` уже есть какие-то из этих колонок —
-- удали соответствующую строку ALTER TABLE перед применением миграции,
-- иначе D1 вернёт ошибку "duplicate column name".

ALTER TABLE agents ADD COLUMN version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE agents ADD COLUMN error_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN total_tasks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN last_heartbeat TEXT;
ALTER TABLE agents ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

-- Полный состав роя (1 overlord + 3 curators + 5 workers = 9 агентов) —
-- ровно то, что уже нарисовано на вкладке Swarm в интерфейсе.
-- OR IGNORE — не трогает строки, если они уже были вставлены раньше.
INSERT OR IGNORE INTO agents (id, parent_id, name, role, status) VALUES
  ('overlord-1', NULL,        'Azrail',           'overlord', 'online'),
  ('cur-brand',  'overlord-1','Brand Priest',     'curator',  'online'),
  ('cur-tech',   'overlord-1','Tech Oracle',      'curator',  'online'),
  ('cur-mind',   'overlord-1','Mind Oracle',      'curator',  'online'),
  ('w-visual',   'cur-brand', 'Visual Architect', 'worker',   'online'),
  ('w-brand',    'cur-brand', 'Brand Scout',      'worker',   'online'),
  ('w-code',     'cur-tech',  'Code Smith',       'worker',   'online'),
  ('w-qa',       'cur-tech',  'QA Sentinel',      'worker',   'online'),
  ('w-psych',    'cur-mind',  'Psycho Analyst',   'worker',   'offline');

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,                    -- crypto.randomUUID()
  agent_id TEXT NOT NULL REFERENCES agents(id),
  user_id TEXT,
  task_type TEXT NOT NULL,
  payload TEXT,                           -- JSON
  status TEXT NOT NULL DEFAULT 'queued',  -- queued | processing | done | failed
  result TEXT,                            -- JSON или текст ответа агента
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent  ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user   ON agent_tasks(user_id);
