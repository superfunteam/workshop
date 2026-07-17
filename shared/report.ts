// Defense between the model and the UI. Tool-use *should* return the report
// schema, but models occasionally degrade — the observed failure mode wraps
// each array field in '\n<parameter name="...">[…json…]</parameter>' strings.
// normalizeReport coerces any of that into a clean SummaryReport (rescuing
// embedded JSON where possible) or returns null when nothing usable survives.
// Used by the edge function before storing AND by the client before rendering,
// so even a bad report already in storage renders instead of crashing.

import type { SummaryReport } from './types.ts';

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/<\/?parameter[^>]*>/g, '').trim().slice(0, max) : '';
}

/** Best-effort array coercion: real arrays, parameter-wrapped JSON strings,
 * bare JSON strings, or numeric-keyed objects. */
function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const start = v.search(/[[{]/);
    if (start === -1) return [];
    let text = v.slice(start).replace(/<\/parameter>\s*$/g, '').trim();
    for (const candidate of [text, `${text}]`, `${text}}]`]) {
      try {
        const parsed = JSON.parse(candidate);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        /* try the next repair */
      }
    }
    return [];
  }
  if (v !== null && typeof v === 'object') return Object.values(v);
  return [];
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** Strings, or objects that carry their text in a common field. */
function lineOf(v: unknown): string {
  if (typeof v === 'string') return str(v, 400);
  const o = obj(v);
  return str(o.text ?? o.point ?? o.title ?? o.note ?? '', 400);
}

export function normalizeReport(raw: unknown): SummaryReport | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const report: SummaryReport = {
    headline: str(r.headline, 300),
    room_read: str(r.room_read, 1200),
    key_findings: asArray(r.key_findings)
      .map((f) => {
        const o = obj(f);
        const evidence = str(o.evidence, 500);
        return { title: str(o.title, 200), detail: str(o.detail, 700), evidence: evidence || undefined };
      })
      .filter((f) => f.title || f.detail)
      .slice(0, 8),
    agreements: asArray(r.agreements).map(lineOf).filter(Boolean).slice(0, 10),
    tensions: asArray(r.tensions).map(lineOf).filter(Boolean).slice(0, 10),
    weak_points: asArray(r.weak_points)
      .map((w) => {
        const o = obj(w);
        return { title: str(o.title, 200), detail: str(o.detail, 600) };
      })
      .filter((w) => w.title || w.detail)
      .slice(0, 8),
    action_items: asArray(r.action_items)
      .map((a) => {
        const o = obj(a);
        const effort = o.effort === 'quick_win' || o.effort === 'big_bet' ? o.effort : 'project';
        return { title: str(o.title, 200), detail: str(o.detail, 600), effort: effort as 'quick_win' | 'project' | 'big_bet' };
      })
      .filter((a) => a.title || a.detail)
      .slice(0, 10),
    quotes: asArray(r.quotes)
      .map((q) => {
        const o = obj(q);
        const why = str(o.why, 300);
        return { text: typeof q === 'string' ? str(q, 400) : str(o.text, 400), why: why || undefined };
      })
      .filter((q) => q.text)
      .slice(0, 6),
    section_notes: asArray(r.section_notes)
      .map((s) => {
        const o = obj(s);
        return { section: str(o.section, 120), note: str(o.note, 400) };
      })
      .filter((s) => s.section || s.note)
      .slice(0, 12),
  };

  const substance =
    report.key_findings.length + report.action_items.length + report.agreements.length + report.tensions.length;
  if (!report.headline && !report.room_read && substance === 0) return null;
  return report;
}
