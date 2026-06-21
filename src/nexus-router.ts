// nexus-router.ts — Universal Router для Dark Mnmll Pulse OS
//
// Идея взята из твоего Nexus Core v5 (Math Scan): лёгкая эвристика без
// отдельной ML-модели — считаем лексическое разнообразие, энтропию Шеннона
// и ключевые слова намерения, получаем intent + сложность, выбираем модель.
//
// ГЛАВНОЕ ОТЛИЧИЕ от черновика v5: убран ручной fallback CF AI → OpenAI →
// Gemini с отдельными OPENAI_KEY/GEMINI_KEY. Это больше не нужно — Cloudflare
// AI Gateway Unified Billing (см. INTEGRATION.md) позволяет звать ЛЮБУЮ
// модель каталога (свою и сторонние) через один и тот же env.AI.run(),
// без единого провайдерского ключа на твоей стороне. Подтверждено по
// официальной документации Cloudflare AI Gateway, июнь 2026.

export interface ScanResult {
  intent: 'code' | 'reason' | 'creative' | 'visual' | 'quick' | 'math';
  complexity: number; // 0..1, взвешенная длительность
  lexicalDiversity: number;
  entropy: number;
}

const INTENT_KEYWORDS: Array<[ScanResult['intent'], RegExp]> = [
  ['visual', /\b(картинк|изображени|обложк|логотип|баннер|дизайн|image|cover|poster|illustration)\b/i],
  ['math', /\b(посчита|вычисли|формул|уравнен|статистик|calculate|equation|formula)\b/i],
  ['code', /\b(код|функци|баг|деплой|sql|api|typescript|javascript|python|ошибк|debug|function|refactor)\b/i],
  ['creative', /\b(напиши рассказ|сочини|стих|рассказ|текст песни|story|poem|lyrics)\b/i],
  ['reason', /\b(почему|сравни|анализ|стратеги|план|причин|why|compare|analy[sz]e|strategy)\b/i],
];

function shannonEntropy(text: string): number {
  const freq: Record<string, number> = {};
  for (const ch of text) freq[ch] = (freq[ch] || 0) + 1;
  const len = text.length || 1;
  let entropy = 0;
  for (const ch in freq) {
    const p = freq[ch] / len;
    entropy -= p * Math.log2(p);
  }
  return Math.min(entropy / 6, 1); // нормализация: ~6 бит/символ — практический потолок для текста
}

export function mathScan(prompt: string): ScanResult {
  const text = String(prompt || '');
  const words = text.trim().split(/\s+/).filter(Boolean);
  const unique = new Set(words.map(w => w.toLowerCase()));
  const lexicalDiversity = words.length ? unique.size / words.length : 0;
  const entropy = shannonEntropy(text);

  let intent: ScanResult['intent'] = 'reason';
  for (const [key, re] of INTENT_KEYWORDS) {
    if (re.test(text)) { intent = key; break; }
  }
  if (words.length <= 6 && intent === 'reason') intent = 'quick';

  const lengthScore = Math.min(words.length / 120, 1);
  const complexity = Math.min(1, lengthScore * 0.5 + lexicalDiversity * 0.3 + entropy * 0.2);

  return { intent, complexity, lexicalDiversity, entropy };
}

// Слаги из каталога Cloudflare AI Platform. Проверь актуальный слаг кнопкой
// "Copy ID" в твоём каталоге (Models → карточка модели) перед деплоем —
// каталог обновляется, и точное имя для @cf/-моделей может отличаться.
const MODELS = {
  quick: '@cf/meta/llama-3.1-8b-instruct-fp8',          // Cloudflare-hosted, ~50мс
  visual: '@cf/black-forest-labs/flux-1-schnell',        // Cloudflare-hosted, картинки
  math: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',  // Cloudflare-hosted, рассуждения
  codeSimple: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',// Cloudflare-hosted, средняя сложность
  default: 'anthropic/claude-sonnet-4.6',                 // Third-party через Unified Billing
} as const;

export function selectModel(scan: ScanResult): string {
  if (scan.intent === 'quick') return MODELS.quick;
  if (scan.intent === 'visual') return MODELS.visual;
  if (scan.intent === 'math') return MODELS.math;
  if (scan.intent === 'code' || scan.intent === 'reason') {
    return scan.complexity > 0.5 ? MODELS.default : MODELS.codeSimple;
  }
  return MODELS.default;
}

export interface RoutedRunResult {
  text: string;
  raw: unknown;
  model: string;
  scan: ScanResult;
  fallback: boolean;
}

// Универсальный текстовый вызов с диагностикой и одним уровнем fallback.
// Не используй для intent='visual' — у моделей изображений другой формат
// ответа (бинарные данные/base64), это отдельный путь (см. Auto Site Builder).
export async function routedRun(
  env: { AI: { run: (model: string, input: unknown, opts?: unknown) => Promise<unknown> } },
  prompt: string,
  opts: { system?: string; messages?: Array<{ role: string; content: string }>; maxTokens?: number } = {}
): Promise<RoutedRunResult> {
  const scan = mathScan(prompt);
  const model = scan.intent === 'visual' ? MODELS.default : selectModel(scan);

  const messages = opts.messages?.length ? opts.messages : [{ role: 'user', content: prompt }];
  const input: Record<string, unknown> = { max_tokens: opts.maxTokens || 800, messages };
  if (opts.system) input.system = opts.system;

  try {
    const raw = await env.AI.run(model, input, { gateway: { id: 'default' } });
    return { text: extractText(raw), raw, model, scan, fallback: false };
  } catch (err) {
    // Финальный фоллбэк на CF-нативную модель, а не повторный throw —
    // даже если основная/дефолтная модель недоступна, отдаём хоть
    // какой-то ответ вместо полного отказа. Опция gateway сохранена,
    // чтобы этот вызов тоже шёл через AI Gateway logs/rate-limiting.
    const fallbackModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    try {
      const raw = await env.AI.run(fallbackModel, input, { gateway: { id: 'default' } });
      return { text: extractText(raw), raw, model: fallbackModel, scan, fallback: true };
    } catch (err2) {
      return {
        text: 'AI-сервис временно недоступен. Попробуйте позже.',
        raw: null,
        model: fallbackModel,
        scan,
        fallback: true,
      };
    }
  }
}

// Разные модели возвращают разную форму ответа: Anthropic-стиль —
// {content:[{type:'text',text:...}]}, нативные Workers AI LLM-модели —
// {response:'...'}. Поддерживаем оба, чтобы вызывающий код не думал об этом.
function extractText(raw: unknown): string {
  const r = raw as any;
  if (typeof r === 'string') return r;
  if (Array.isArray(r?.content)) return r.content.map((c: any) => c.text || '').join('');
  if (typeof r?.response === 'string') return r.response;
  return JSON.stringify(r);
}
