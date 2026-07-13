// Session exports: a client-ready Markdown document and a flat CSV.
// Pure functions over stored data; used by the edge function's /export route.

import type { Answer, EmoteEvent, Participant, Question, StoredRoomConfig } from './types.ts';
import {
  inspoItems,
  openAnswers,
  postitsByCategory,
  rankResults,
  rankedTallies,
  sliderStats,
  wordCounts,
} from './aggregate.ts';
import { flatQuestions } from './flow.ts';

export interface SessionData {
  config: StoredRoomConfig;
  participants: Participant[];
  /** qid → answers */
  answers: Record<string, Answer[]>;
  scratch?: string;
  events?: EmoteEvent[];
}

function nameOf(participants: Participant[], pid: string, anonymous?: boolean): string {
  if (anonymous) return 'Anonymous';
  const p = participants.find((x) => x.pid === pid);
  return p ? `${p.avatar} ${p.name}` : 'Unknown';
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

// ---------- Markdown ----------

function mdQuestion(q: Question, answers: Answer[], participants: Participant[]): string[] {
  const lines: string[] = [];
  const by = (pid: string) => nameOf(participants, pid, q.anonymous);
  if (answers.length === 0) {
    lines.push('_No answers._');
    return lines;
  }
  switch (q.type) {
    case 'choice':
    case 'dotvote': {
      const unit = q.type === 'dotvote' ? 'dots' : 'votes';
      for (const t of rankedTallies(q, answers)) {
        const voters = q.anonymous ? '' : t.pids.length ? ` — ${[...new Set(t.pids)].map(by).join(', ')}` : '';
        lines.push(`- **${t.option}**: ${t.count} ${unit}${voters}`);
      }
      break;
    }
    case 'slider': {
      const s = sliderStats(answers);
      lines.push(`**Average: ${s.average}/100** (${q.left} 0 ↔ 100 ${q.right}) · range ${s.min}–${s.max} · spread ±${s.spread}`);
      lines.push('');
      for (const v of s.values) lines.push(`- ${by(v.pid)}: ${v.value}`);
      break;
    }
    case 'postits': {
      for (const group of postitsByCategory(q, answers)) {
        lines.push(`**${group.category}**`);
        if (group.notes.length === 0) lines.push('- _none_');
        for (const note of group.notes) lines.push(`- ${note.text} _(${by(note.pid)})_`);
        lines.push('');
      }
      break;
    }
    case 'wordcloud': {
      lines.push(wordCounts(answers).map((w) => `**${w.word}** (×${w.count})`).join(' · '));
      break;
    }
    case 'rank': {
      rankResults(q, answers).forEach((r, i) => {
        lines.push(`${i + 1}. **${r.option}**${r.avgPosition === null ? ' _(unranked)_' : ` — avg position ${r.avgPosition}`}`);
      });
      break;
    }
    case 'open': {
      for (const a of openAnswers(answers)) {
        lines.push(`> ${a.text.replace(/\n/g, '\n> ')}`);
        lines.push(`> — ${by(a.pid)}`);
        lines.push('');
      }
      break;
    }
    case 'inspo': {
      for (const item of inspoItems(answers)) {
        const label = item.note ? `${item.note} — ` : '';
        lines.push(`- ${label}${item.url} _(${by(item.pid)})_`);
      }
      break;
    }
  }
  return lines;
}

export function toMarkdown(data: SessionData): string {
  const { config, participants, answers } = data;
  const lines: string[] = [];
  lines.push(`# ${config.name}`);
  lines.push('');
  lines.push(`Workshop session · ${fmtDate(config.createdAt)} · room \`${config.code}\``);
  lines.push('');
  const people = participants.filter((p) => !p.removed);
  lines.push(`**In the room (${people.length}):** ${people.map((p) => `${p.avatar} ${p.name}`).join(', ') || '—'}`);
  lines.push('');
  for (const section of config.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const q of section.questions) {
      const qa = answers[q.id] ?? [];
      lines.push(`### ${q.prompt}`);
      if (q.hint) lines.push(`_${q.hint}_`);
      lines.push('');
      lines.push(...mdQuestion(q, qa, participants));
      lines.push('');
    }
  }
  if (data.scratch?.trim()) {
    lines.push('## Host scratchpad');
    lines.push('');
    lines.push(data.scratch.trim());
    lines.push('');
  }
  const events = data.events ?? [];
  if (events.length > 0) {
    const byEmoji = new Map<string, number>();
    for (const e of events) byEmoji.set(e.emoji, (byEmoji.get(e.emoji) ?? 0) + 1);
    const summary = [...byEmoji.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([emoji, count]) => `${emoji} ×${count}`)
      .join(' · ');
    lines.push('## Room energy');
    lines.push('');
    lines.push(`${events.length} reactions: ${summary}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- CSV ----------

export function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

/** One row per atomic answer unit (a pick, a note, a word, a pin…). */
export function toCsv(data: SessionData): string {
  const { config, participants, answers } = data;
  const rows: string[][] = [
    ['section', 'question', 'type', 'participant', 'value', 'detail', 'answered_at'],
  ];
  const push = (
    section: string,
    q: Question,
    pid: string,
    value: string,
    detail: string,
    at: number,
  ) => {
    rows.push([
      section,
      q.prompt,
      q.type,
      nameOf(participants, pid, q.anonymous),
      value,
      detail,
      new Date(at).toISOString(),
    ]);
  };
  for (const f of flatQuestions(config)) {
    const q = f.question;
    const sTitle = f.section.title;
    for (const a of answers[q.id] ?? []) {
      switch (q.type) {
        case 'choice':
          for (const pick of (a.value as { picks: number[] }).picks ?? []) {
            push(sTitle, q, a.pid, q.options[pick] ?? `option ${pick}`, '', a.updatedAt);
          }
          break;
        case 'dotvote':
          ((a.value as { dots: number[] }).dots ?? []).forEach((dots, i) => {
            if (dots > 0) push(sTitle, q, a.pid, q.options[i] ?? `option ${i}`, `${dots} dots`, a.updatedAt);
          });
          break;
        case 'slider':
          push(sTitle, q, a.pid, String((a.value as { value: number }).value), `${q.left} ↔ ${q.right}`, a.updatedAt);
          break;
        case 'postits':
          for (const note of (a.value as { notes: Array<{ category: number; text: string }> }).notes ?? []) {
            push(sTitle, q, a.pid, note.text, q.categories[note.category] ?? '', a.updatedAt);
          }
          break;
        case 'wordcloud':
          for (const word of (a.value as { words: string[] }).words ?? []) {
            if (word.trim()) push(sTitle, q, a.pid, word.trim(), '', a.updatedAt);
          }
          break;
        case 'rank':
          ((a.value as { order: number[] }).order ?? []).forEach((optIdx, pos) => {
            push(sTitle, q, a.pid, q.options[optIdx] ?? `option ${optIdx}`, `rank ${pos + 1}`, a.updatedAt);
          });
          break;
        case 'inspo':
          for (const item of (a.value as { items: Array<{ url: string; note?: string; kind: string }> }).items ?? []) {
            push(sTitle, q, a.pid, item.url, item.note ?? item.kind, a.updatedAt);
          }
          break;
        case 'open': {
          const text = ((a.value as { text: string }).text ?? '').trim();
          if (text) push(sTitle, q, a.pid, text, '', a.updatedAt);
          break;
        }
      }
    }
  }
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}
