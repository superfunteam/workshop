// Server-side gatekeeping: whatever a client sends, what lands in Blobs is
// well-shaped, bounded, and can't break anyone else's screen.

import type {
  AnswerValue,
  InspoItem,
  PostitNote,
  Question,
  RoomSettings,
  Section,
} from './types.ts';
import { rid } from './codes.ts';

const LIMITS = {
  name: 24,
  prompt: 300,
  hint: 200,
  notes: 2000,
  option: 120,
  category: 60,
  openText: 2000,
  postitText: 280,
  postitCount: 50,
  word: 24,
  inspoNote: 140,
  inspoItems: 20,
  url: 2000,
  scratch: 20_000,
  sections: 20,
  questionsPerSection: 50,
  options: 20,
  title: 120,
};

export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  // Strip control chars (keep \n), collapse absurd whitespace runs, cap length.
  return raw
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .slice(0, max);
}

export const cleanName = (raw: unknown): string => cleanText(raw, LIMITS.name).replace(/\n/g, ' ').trim();
export const cleanScratch = (raw: unknown): string => cleanText(raw, LIMITS.scratch);

function intsInRange(raw: unknown, max: number): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < max);
}

function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const url = raw.trim().slice(0, LIMITS.url);
  if (url.startsWith('/api/rooms/')) return url; // our own uploads
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Coerce a raw client answer into a valid AnswerValue for this question,
 * or null when it's unusable.
 */
export function sanitizeValue(question: Question, raw: unknown): AnswerValue | null {
  if (raw === null || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  switch (question.type) {
    case 'choice': {
      let picks = [...new Set(intsInRange(v.picks, question.options.length))];
      if (!question.multi) picks = picks.slice(0, 1);
      if (picks.length === 0) return null;
      return { picks };
    }
    case 'open': {
      const text = cleanText(v.text, LIMITS.openText).trim();
      return text ? { text } : null;
    }
    case 'postits': {
      if (!Array.isArray(v.notes)) return null;
      const notes: PostitNote[] = [];
      for (const n of v.notes.slice(0, LIMITS.postitCount)) {
        if (n === null || typeof n !== 'object') continue;
        const note = n as Record<string, unknown>;
        const category = Number.isInteger(note.category) ? (note.category as number) : -1;
        const text = cleanText(note.text, LIMITS.postitText).trim();
        if (category < 0 || category >= question.categories.length || !text) continue;
        notes.push({ id: typeof note.id === 'string' ? note.id.slice(0, 16) : rid(), category, text });
      }
      return notes.length ? { notes } : null;
    }
    case 'slider': {
      const n = typeof v.value === 'number' && Number.isFinite(v.value) ? v.value : NaN;
      if (Number.isNaN(n)) return null;
      return { value: Math.round(Math.min(100, Math.max(0, n))) };
    }
    case 'inspo': {
      if (!Array.isArray(v.items)) return null;
      const items: InspoItem[] = [];
      for (const i of v.items.slice(0, LIMITS.inspoItems)) {
        if (i === null || typeof i !== 'object') continue;
        const item = i as Record<string, unknown>;
        const url = safeUrl(item.url);
        if (!url) continue;
        const kind = item.kind === 'image' || item.kind === 'upload' ? item.kind : 'link';
        const note = cleanText(item.note, LIMITS.inspoNote).trim() || undefined;
        items.push({ id: typeof item.id === 'string' ? item.id.slice(0, 16) : rid(), kind, url, note });
      }
      return items.length ? { items } : null;
    }
    case 'wordcloud': {
      if (!Array.isArray(v.words)) return null;
      const max = question.maxWords ?? 3;
      const words = v.words
        .map((w) => cleanText(w, LIMITS.word).replace(/\n/g, ' ').trim())
        .filter(Boolean)
        .slice(0, max);
      return words.length ? { words } : null;
    }
    case 'dotvote': {
      const budget = question.dots ?? 3;
      if (!Array.isArray(v.dots)) return null;
      const dots = question.options.map((_, i) => {
        const n = v.dots instanceof Array ? v.dots[i] : 0;
        return Number.isInteger(n) && (n as number) > 0 ? (n as number) : 0;
      });
      let total = dots.reduce((s, n) => s + n, 0);
      // Trim overspend from the end so the sum honors the budget.
      for (let i = dots.length - 1; total > budget && i >= 0; i--) {
        const cut = Math.min(dots[i], total - budget);
        dots[i] -= cut;
        total -= cut;
      }
      return total > 0 ? { dots } : null;
    }
    case 'rank': {
      const order = [...new Set(intsInRange(v.order, question.options.length))];
      return order.length ? { order } : null;
    }
    case 'slide':
    case 'discuss':
      // Nothing to answer on a talk moment — reject any stray submission.
      return null;
  }
}

/** Normalize an editor-submitted config body into safe sections + settings. */
export function sanitizeSections(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return [];
  const sections: Section[] = [];
  for (const s of raw.slice(0, LIMITS.sections)) {
    if (s === null || typeof s !== 'object') continue;
    const sec = s as Record<string, unknown>;
    const questions: Question[] = [];
    for (const q of (Array.isArray(sec.questions) ? sec.questions : []).slice(0, LIMITS.questionsPerSection)) {
      const clean = sanitizeQuestion(q);
      if (clean) questions.push(clean);
    }
    sections.push({
      id: typeof sec.id === 'string' ? sec.id.slice(0, 16) : rid(),
      title: cleanText(sec.title, LIMITS.title).trim() || 'Untitled section',
      questions,
    });
  }
  return sections;
}

function strings(raw: unknown, max: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => cleanText(o, maxLen).replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .slice(0, max);
}

export function sanitizeQuestion(raw: unknown): Question | null {
  if (raw === null || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;
  const base = {
    id: typeof q.id === 'string' && q.id ? q.id.slice(0, 16) : rid(),
    prompt: cleanText(q.prompt, LIMITS.prompt).trim(),
    hint: cleanText(q.hint, LIMITS.hint).trim() || undefined,
    notes: cleanText(q.notes, LIMITS.notes).trim() || undefined,
    anonymous: q.anonymous === true || undefined,
  };
  if (!base.prompt) return null;
  switch (q.type) {
    case 'choice': {
      const options = strings(q.options, LIMITS.options, LIMITS.option);
      if (options.length < 2) return null;
      return { ...base, type: 'choice', options, multi: q.multi === true || undefined };
    }
    case 'open':
      return { ...base, type: 'open', placeholder: cleanText(q.placeholder, LIMITS.option).trim() || undefined };
    case 'postits': {
      const categories = strings(q.categories, 6, LIMITS.category);
      if (categories.length < 1) return null;
      return { ...base, type: 'postits', categories };
    }
    case 'slider': {
      const left = cleanText(q.left, LIMITS.option).trim();
      const right = cleanText(q.right, LIMITS.option).trim();
      if (!left || !right) return null;
      return { ...base, type: 'slider', left, right };
    }
    case 'inspo':
      return { ...base, type: 'inspo' };
    case 'wordcloud': {
      const raw = typeof q.maxWords === 'number' ? Math.round(q.maxWords) : 3;
      return { ...base, type: 'wordcloud', maxWords: Math.min(5, Math.max(1, raw)) };
    }
    case 'dotvote': {
      const options = strings(q.options, LIMITS.options, LIMITS.option);
      if (options.length < 2) return null;
      const rawDots = typeof q.dots === 'number' ? Math.round(q.dots) : 3;
      return { ...base, type: 'dotvote', options, dots: Math.min(10, Math.max(1, rawDots)) };
    }
    case 'rank': {
      const options = strings(q.options, LIMITS.options, LIMITS.option);
      if (options.length < 2) return null;
      return { ...base, type: 'rank', options };
    }
    case 'slide': {
      const emoji = typeof q.emoji === 'string' ? [...q.emoji.trim()].slice(0, 4).join('') : '';
      const body = cleanText(q.body, LIMITS.notes).trim();
      return { ...base, type: 'slide', emoji: emoji || undefined, body: body || undefined };
    }
    case 'discuss':
      return { ...base, type: 'discuss' };
    default:
      return null;
  }
}

export function sanitizeSettings(raw: unknown): RoomSettings {
  const s = (raw ?? {}) as Record<string, unknown>;
  return { autoReveal: s.autoReveal === true };
}

export const cleanRoomName = (raw: unknown): string =>
  cleanText(raw, LIMITS.title).replace(/\n/g, ' ').trim() || 'Untitled workshop';
