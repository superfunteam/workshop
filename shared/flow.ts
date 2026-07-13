import type { Question, RoomConfig, RoomState, Section } from './types.ts';

export interface FlatQuestion {
  question: Question;
  section: Section;
  sIdx: number;
  qIdx: number;
  /** 0-based position across the whole workshop. */
  n: number;
  total: number;
}

/** Every question in order, with its coordinates. */
export function flatQuestions(config: RoomConfig): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  config.sections.forEach((section, sIdx) => {
    section.questions.forEach((question, qIdx) => {
      out.push({ question, section, sIdx, qIdx, n: out.length, total: 0 });
    });
  });
  for (const f of out) f.total = out.length;
  return out;
}

export function currentQuestion(config: RoomConfig, state: RoomState): FlatQuestion | null {
  return (
    flatQuestions(config).find(
      (f) => f.sIdx === state.current.section && f.qIdx === state.current.question,
    ) ?? null
  );
}

function step(config: RoomConfig, state: RoomState, dir: 1 | -1): { section: number; question: number } | null {
  const flat = flatQuestions(config);
  const cur = flat.findIndex(
    (f) => f.sIdx === state.current.section && f.qIdx === state.current.question,
  );
  // Off the map (e.g. questions were edited): clamp to the nearest end.
  const idx = cur === -1 ? (dir === 1 ? -1 : flat.length) : cur;
  const next = flat[idx + dir];
  return next ? { section: next.sIdx, question: next.qIdx } : null;
}

export const nextPosition = (c: RoomConfig, s: RoomState) => step(c, s, 1);
export const prevPosition = (c: RoomConfig, s: RoomState) => step(c, s, -1);

/** Moving from `from` to `to` crossed a section boundary (used for section-complete confetti). */
export function crossedSection(from: { section: number }, to: { section: number }): boolean {
  return from.section !== to.section;
}

export function freshState(): RoomState {
  return {
    phase: 'lobby',
    current: { section: 0, question: 0 },
    revealed: {},
    timer: null,
  };
}
