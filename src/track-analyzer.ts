// track-analyzer.ts — Music Intelligence Layer, уровень 1
// Dark Mnmll Pulse OS
//
// Что это делает РЕАЛЬНО (без аудио-анализа, на метаданных + тексте):
//   1. checkBpmFit()       — попадает ли BPM трека в целевой диапазон жанра.
//   2. toCamelot()          — нормализует тональность (любая запись —
//                              "F Major", "Cm", "8A") к единому коду Camelot.
//   3. camelotCompatibility() — гармоническая совместимость двух тональностей
//                              по правилам Camelot Wheel (DJ-стандарт).
//   4. checkMixCompatibility() — совместимость по BPM для микса: прямая,
//                              через питч-шифт, либо half/double-time.
//   5. analyzeTrackAI()    — сравнение нового трека с референс-каталогом
//                              через Universal Router, с учётом 1-4.
//
// Чего это НЕ делает (уровень 2, отдельная задача):
//   реальный аудио-анализ файла — нужен внешний сервис обработки звука.

import { routedRun } from './nexus-router';

// ── BPM-диапазон жанра ──────────────────────────────────────────────
const BPM_RANGES: Record<string, [number, number]> = {
  'Melodic House & Techno': [120, 130],
  'Techno (Peak Time / Driving)': [126, 136],
};

export interface BpmCheckResult {
  inRange: boolean;
  range: [number, number] | null;
  distance: number;
}

export function checkBpmFit(subgenre: string, bpm: number): BpmCheckResult {
  const range = BPM_RANGES[subgenre] ?? null;
  if (!range) return { inRange: true, range: null, distance: 0 };
  const [lo, hi] = range;
  if (bpm >= lo && bpm <= hi) return { inRange: true, range, distance: 0 };
  const distance = bpm < lo ? lo - bpm : bpm - hi;
  return { inRange: false, range, distance };
}

// ── Нормализация тональности → Camelot ──────────────────────────────
// Стандартная Camelot Wheel-таблица (используется в Mixed In Key,
// Rekordbox, Serato). Энгармонические варианты (Eb/D#, Gb/F# и т.д.)
// смаплены на один и тот же код.
const CAMELOT_MAP: Record<string, string> = {
  'G# MINOR': '1A', 'AB MINOR': '1A',
  'D# MINOR': '2A', 'EB MINOR': '2A',
  'A# MINOR': '3A', 'BB MINOR': '3A',
  'F MINOR': '4A',
  'C MINOR': '5A',
  'G MINOR': '6A',
  'D MINOR': '7A',
  'A MINOR': '8A',
  'E MINOR': '9A',
  'B MINOR': '10A',
  'F# MINOR': '11A', 'GB MINOR': '11A',
  'C# MINOR': '12A', 'DB MINOR': '12A',
  'B MAJOR': '1B',
  'F# MAJOR': '2B', 'GB MAJOR': '2B',
  'C# MAJOR': '3B', 'DB MAJOR': '3B',
  'G# MAJOR': '4B', 'AB MAJOR': '4B',
  'D# MAJOR': '5B', 'EB MAJOR': '5B',
  'A# MAJOR': '6B', 'BB MAJOR': '6B',
  'F MAJOR': '7B',
  'C MAJOR': '8B',
  'G MAJOR': '9B',
  'D MAJOR': '10B',
  'A MAJOR': '11B',
  'E MAJOR': '12B',
};

// Принимает любую запись тональности: "F Major", "Fm", "F minor",
// "8A" (уже Camelot) — возвращает код Camelot или null, если не распознано.
export function toCamelot(key: string | null | undefined): string | null {
  if (!key) return null;
  const raw = key.trim().toUpperCase();
  if (/^([1-9]|1[0-2])[AB]$/.test(raw)) return raw; // уже Camelot

  // "Fm" / "F#m" → "F MINOR" / "F# MINOR"
  let normalized = raw
    .replace(/^([A-G]#?)M$/, '$1 MINOR')
    .replace(/\bMIN\b/, 'MINOR')
    .replace(/\bMAJ\b/, 'MAJOR');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  if (!/MAJOR|MINOR/.test(normalized)) normalized += ' MAJOR'; // голая буква без указания лада — допускаем как major

  return CAMELOT_MAP[normalized] ?? null;
}

export interface KeyCompatibility {
  compatible: boolean;
  relation: 'same' | 'relative' | 'adjacent' | 'incompatible' | 'unknown';
  note: string;
}

// Совместимость по правилам Camelot Wheel: тот же код — идеально;
// тот же номер, другая буква (relative major/minor) — совместимо;
// соседний номер (±1), та же буква — совместимо; всё остальное — нет.
export function camelotCompatibility(keyA: string | null | undefined, keyB: string | null | undefined): KeyCompatibility {
  const a = toCamelot(keyA);
  const b = toCamelot(keyB);
  if (!a || !b) return { compatible: false, relation: 'unknown', note: 'Тональность не распознана для одного из треков' };

  const [, numAstr, letA] = a.match(/^(\d+)([AB])$/)!;
  const [, numBstr, letB] = b.match(/^(\d+)([AB])$/)!;
  const numA = parseInt(numAstr), numB = parseInt(numBstr);

  if (numA === numB && letA === letB) return { compatible: true, relation: 'same', note: `Точное совпадение (${a})` };
  if (numA === numB && letA !== letB) return { compatible: true, relation: 'relative', note: `Параллельные тональности (${a} / ${b})` };

  const diff = Math.min(Math.abs(numA - numB), 12 - Math.abs(numA - numB));
  if (diff === 1 && letA === letB) return { compatible: true, relation: 'adjacent', note: `Соседние по кругу Camelot (${a} → ${b})` };

  return { compatible: false, relation: 'incompatible', note: `Не совместимо по Camelot (${a} vs ${b})` };
}

// ── BPM-совместимость для микса ──────────────────────────────────────
export interface MixCompatibility {
  compatible: boolean;
  pitchShiftPercent: number | null;
  note: string;
}

// ±8% — стандартный практический предел питч-шифта без заметной потери
// качества для большинства DJ-софта.
const MAX_PITCH_SHIFT = 8;

export function checkMixCompatibility(trackBpm: number, refBpm: number): MixCompatibility {
  const directPct = (Math.abs(trackBpm - refBpm) / refBpm) * 100;
  if (directPct <= MAX_PITCH_SHIFT) {
    return {
      compatible: true,
      pitchShiftPercent: Math.round(directPct * 10) / 10,
      note: `Совместимо напрямую, питч-шифт ~${directPct.toFixed(1)}%`,
    };
  }

  const halfPct = (Math.abs(trackBpm * 2 - refBpm) / refBpm) * 100;
  if (halfPct <= MAX_PITCH_SHIFT) {
    return {
      compatible: true,
      pitchShiftPercent: Math.round(halfPct * 10) / 10,
      note: `Похоже на half-time (${trackBpm} BPM ≈ ${(trackBpm * 2).toFixed(0)} в double-time) — совместимо`,
    };
  }

  const doublePct = (Math.abs(trackBpm / 2 - refBpm) / refBpm) * 100;
  if (doublePct <= MAX_PITCH_SHIFT) {
    return {
      compatible: true,
      pitchShiftPercent: Math.round(doublePct * 10) / 10,
      note: `Похоже на double-time (${trackBpm} BPM ≈ ${(trackBpm / 2).toFixed(0)} в half-time) — совместимо`,
    };
  }

  return {
    compatible: false,
    pitchShiftPercent: null,
    note: `BPM несовместим для микса (${trackBpm} vs ${refBpm}) — слишком большая разница даже с учётом half/double-time`,
  };
}

export interface TrackInput {
  artist: string;
  title: string;
  subgenre: string;
  bpm?: number;
  key_signature?: string;
  description?: string; // свободное описание звучания от автора — обязательно для качественного анализа
}

interface ReferenceRow {
  artist: string;
  title: string;
  sound_direction: string | null;
  notes: string | null;
  bpm: number | null;
  key_signature: string | null;
}

export interface ReferenceCompat {
  artist: string;
  title: string;
  bpmCompat: MixCompatibility | null;
  keyCompat: KeyCompatibility | null;
}

export interface TrackAnalysis {
  bpmCheck: BpmCheckResult | null;
  referenceCompat: ReferenceCompat[];
  aiAssessment: string;
  referencesUsed: number;
}

export async function analyzeTrackAI(
  env: { DB: { prepare: (q: string) => any }; AI: any },
  track: TrackInput
): Promise<TrackAnalysis> {
  const bpmCheck = track.bpm != null ? checkBpmFit(track.subgenre, track.bpm) : null;

  // Тянем до 8 референсов того же поджанра — достаточно для контекста,
  // не раздувает промпт. Теперь забираем и bpm/key_signature — нужны для
  // математического сравнения, не только для текста промпта.
  const queryResult = (await env.DB.prepare(
    `SELECT artist, title, sound_direction, notes, bpm, key_signature FROM tracks
     WHERE subgenre = ? AND role = 'reference'
     ORDER BY RANDOM() LIMIT 8`
  )
    .bind(track.subgenre)
    .all()) as { results: ReferenceRow[] };
  const results = queryResult.results ?? [];

  // Математическая совместимость по BPM и тональности с каждым референсом
  // — без AI, детерминированно.
  const referenceCompat: ReferenceCompat[] = results.map((r) => ({
    artist: r.artist,
    title: r.title,
    bpmCompat: track.bpm != null && r.bpm != null ? checkMixCompatibility(track.bpm, r.bpm) : null,
    keyCompat: track.key_signature && r.key_signature ? camelotCompatibility(track.key_signature, r.key_signature) : null,
  }));

  const refList = results
    .map((r) => {
      const bpmKey = [r.bpm ? `${r.bpm} BPM` : null, r.key_signature ?? null].filter(Boolean).join(', ');
      return `- ${r.artist} — ${r.title}${r.sound_direction ? ` [${r.sound_direction}]` : ''}${bpmKey ? ` (${bpmKey})` : ''}`;
    })
    .join('\n');

  const bpmNote = bpmCheck
    ? bpmCheck.inRange
      ? `BPM ${track.bpm} — в целевом диапазоне ${bpmCheck.range?.[0]}-${bpmCheck.range?.[1]}.`
      : `BPM ${track.bpm} — ВНЕ диапазона ${bpmCheck.range?.[0]}-${bpmCheck.range?.[1]}, отклонение ${bpmCheck.distance}. Возможно несовместимо для прямого микса с референсами этого поджанра.`
    : 'BPM не указан.';

  const system =
    `Ты Track Analyzer проекта Dark Mnmll Pulse OS. Оцениваешь, насколько ` +
    `новый трек соответствует целевому звучанию поджанра "${track.subgenre}". ` +
    `Не выдумывай факты о референс-треках сверх того, что дано. Отвечай по-русски, ` +
    `структурированно: 1) насколько похоже звучание по описанию, 2) что сближает ` +
    `с референсами, 3) что отличается, 4) короткая рекомендация. Без воды.`;

  const userMsg =
    `Новый трек: ${track.artist} — ${track.title}\n` +
    `Поджанр: ${track.subgenre}\n${bpmNote}\n` +
    `Тональность: ${track.key_signature ?? 'не указана'}\n` +
    `Описание звучания от автора: ${track.description ?? 'не дано'}\n\n` +
    `Референс-треки того же поджанра:\n${refList || '(в базе пока нет референсов этого поджанра)'}`;

  let text: string;
  try {
    const result = await routedRun(env, userMsg, { system, maxTokens: 600 });
    text = result.text;
  } catch (err) {
    // Даже если AI недоступен — математическая часть (BPM/Camelot) уже
    // посчитана выше и попадёт в referenceCompat. Не теряем её из-за
    // сбоя AI-вызова.
    console.error('Track Analyzer AI call failed:', err);
    text = 'AI-анализ временно недоступен. Математическая совместимость рассчитана.';
  }

  return {
    bpmCheck,
    referenceCompat,
    aiAssessment: text,
    referencesUsed: results.length,
  };
}
