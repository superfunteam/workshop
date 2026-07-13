// Pure summarizers: (question, answers) → the numbers/groupings the reveal
// screens and exports render. No I/O, fully unit-tested.

import type {
  Answer,
  ChoiceQuestion,
  ChoiceValue,
  DotvoteQuestion,
  DotvoteValue,
  InspoItem,
  InspoValue,
  OpenValue,
  PostitNote,
  PostitsQuestion,
  PostitsValue,
  Question,
  RankQuestion,
  RankValue,
  SliderValue,
  WordcloudValue,
} from './types.ts';

export interface Attributed {
  pid: string;
}

export interface OptionTally {
  option: string;
  index: number;
  count: number;
  pids: string[];
}

/** choice + dotvote share this shape; dotvote counts dots, choice counts picks. */
export function tallyOptions(question: ChoiceQuestion | DotvoteQuestion, answers: Answer[]): OptionTally[] {
  const tallies: OptionTally[] = question.options.map((option, index) => ({
    option,
    index,
    count: 0,
    pids: [],
  }));
  for (const a of answers) {
    if (question.type === 'choice') {
      const v = a.value as ChoiceValue;
      for (const pick of v.picks ?? []) {
        const t = tallies[pick];
        if (!t) continue;
        t.count += 1;
        t.pids.push(a.pid);
      }
    } else {
      const v = a.value as DotvoteValue;
      (v.dots ?? []).forEach((dots, i) => {
        const t = tallies[i];
        if (!t || dots <= 0) return;
        t.count += dots;
        t.pids.push(a.pid);
      });
    }
  }
  return tallies;
}

/** Tallies sorted by votes, ties kept in option order. */
export function rankedTallies(question: ChoiceQuestion | DotvoteQuestion, answers: Answer[]): OptionTally[] {
  return [...tallyOptions(question, answers)].sort((a, b) => b.count - a.count || a.index - b.index);
}

export interface SliderStats {
  values: Array<{ pid: string; value: number }>;
  average: number | null;
  min: number | null;
  max: number | null;
  /** Standard deviation — low = the room agrees, high = the room is split. */
  spread: number | null;
}

export function sliderStats(answers: Answer[]): SliderStats {
  const values = answers.map((a) => ({ pid: a.pid, value: (a.value as SliderValue).value }));
  if (values.length === 0) return { values, average: null, min: null, max: null, spread: null };
  const nums = values.map((v) => v.value);
  const average = nums.reduce((s, n) => s + n, 0) / nums.length;
  const spread = Math.sqrt(nums.reduce((s, n) => s + (n - average) ** 2, 0) / nums.length);
  return {
    values,
    average: Math.round(average),
    min: Math.min(...nums),
    max: Math.max(...nums),
    spread: Math.round(spread),
  };
}

export interface CategoryNotes {
  category: string;
  index: number;
  notes: Array<PostitNote & Attributed>;
}

export function postitsByCategory(question: PostitsQuestion, answers: Answer[]): CategoryNotes[] {
  const groups: CategoryNotes[] = question.categories.map((category, index) => ({
    category,
    index,
    notes: [],
  }));
  for (const a of answers) {
    for (const note of (a.value as PostitsValue).notes ?? []) {
      const g = groups[note.category];
      if (!g || !note.text.trim()) continue;
      g.notes.push({ ...note, pid: a.pid });
    }
  }
  return groups;
}

export interface WordCount {
  /** Display casing = first occurrence. */
  word: string;
  count: number;
  pids: string[];
}

export function wordCounts(answers: Answer[]): WordCount[] {
  const byKey = new Map<string, WordCount>();
  for (const a of answers) {
    for (const raw of (a.value as WordcloudValue).words ?? []) {
      const word = raw.trim();
      if (!word) continue;
      const key = word.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
        existing.pids.push(a.pid);
      } else {
        byKey.set(key, { word, count: 1, pids: [a.pid] });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export interface RankResult {
  option: string;
  index: number;
  /** Average position, 1-based; lower = ranked higher. Null if nobody ranked it. */
  avgPosition: number | null;
  votes: number;
}

/**
 * Average-position ranking. Unranked items count as (last place + 1) for the
 * people who ranked others but skipped this one, so partial rankings still
 * punish omission.
 */
export function rankResults(question: RankQuestion, answers: Answer[]): RankResult[] {
  const n = question.options.length;
  const results: RankResult[] = question.options.map((option, index) => ({
    option,
    index,
    avgPosition: null,
    votes: 0,
  }));
  const positions: number[][] = question.options.map(() => []);
  for (const a of answers) {
    const order = (a.value as RankValue).order ?? [];
    if (order.length === 0) continue;
    order.forEach((optIdx, pos) => {
      if (positions[optIdx]) positions[optIdx].push(pos + 1);
    });
    // Skipped options get a worst-place penalty from this voter.
    for (let i = 0; i < n; i++) {
      if (!order.includes(i)) positions[i]?.push(order.length + 1);
    }
  }
  results.forEach((r, i) => {
    const p = positions[i];
    r.votes = p.length;
    if (p.length > 0) r.avgPosition = Math.round((p.reduce((s, x) => s + x, 0) / p.length) * 10) / 10;
  });
  return [...results].sort((a, b) => {
    if (a.avgPosition === null && b.avgPosition === null) return a.index - b.index;
    if (a.avgPosition === null) return 1;
    if (b.avgPosition === null) return -1;
    return a.avgPosition - b.avgPosition || a.index - b.index;
  });
}

export function openAnswers(answers: Answer[]): Array<Attributed & { text: string }> {
  return answers
    .map((a) => ({ pid: a.pid, text: ((a.value as OpenValue).text ?? '').trim() }))
    .filter((a) => a.text.length > 0);
}

export function inspoItems(answers: Answer[]): Array<InspoItem & Attributed> {
  return answers.flatMap((a) =>
    ((a.value as InspoValue).items ?? []).map((item) => ({ ...item, pid: a.pid })),
  );
}

/** A human one-liner per question — used on host cards and in exports. */
export function summarize(question: Question, answers: Answer[]): string {
  if (question.type === 'slide') return 'Slide';
  if (question.type === 'discuss') return 'Talked it out live';
  const n = answers.length;
  if (n === 0) return 'No answers';
  switch (question.type) {
    case 'choice':
    case 'dotvote': {
      const top = rankedTallies(question, answers)[0];
      return top && top.count > 0 ? `Top: “${top.option}” (${top.count})` : `${n} answered`;
    }
    case 'slider': {
      const s = sliderStats(answers);
      return s.average === null ? `${n} answered` : `Average ${s.average} / 100`;
    }
    case 'postits': {
      const total = postitsByCategory(question, answers).reduce((s, g) => s + g.notes.length, 0);
      return `${total} notes from ${n} people`;
    }
    case 'wordcloud': {
      const top = wordCounts(answers)[0];
      return top ? `Most said: “${top.word}” (×${top.count})` : `${n} answered`;
    }
    case 'rank': {
      const top = rankResults(question, answers)[0];
      return top?.avgPosition !== null && top !== undefined ? `#1: “${top.option}”` : `${n} answered`;
    }
    case 'inspo': {
      const total = inspoItems(answers).length;
      return `${total} pins from ${n} people`;
    }
    case 'open':
      return `${openAnswers(answers).length} answers`;
  }
}
