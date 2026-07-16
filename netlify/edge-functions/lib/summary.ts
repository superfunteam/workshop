// Smart Summary: send the whole session (results, question list, scratchpad,
// reactions) to Claude Opus through the Netlify AI Gateway and store a
// structured report in Blobs. Generation runs after the HTTP response via
// context.waitUntil; clients poll the summary blob.

import type { Store } from '@netlify/blobs';
import { k, loadFullRoom } from './rooms.ts';
import { toMarkdown } from '../../../shared/export.ts';
import type { SummaryReport, SummaryState } from '../../../shared/types.ts';

export const SUMMARY_MODEL = 'claude-opus-4-8';
/** A 'running' state older than this is treated as interrupted. */
export const SUMMARY_STALE_MS = 4 * 60_000;

function env(name: string): string | undefined {
  const g = globalThis as {
    Netlify?: { env: { get(key: string): string | undefined } };
    process?: { env: Record<string, string | undefined> };
  };
  return g.Netlify?.env.get(name) ?? g.process?.env[name];
}

const REPORT_TOOL = {
  name: 'deliver_report',
  description: 'Deliver the final workshop synthesis report.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'headline',
      'room_read',
      'key_findings',
      'agreements',
      'tensions',
      'weak_points',
      'action_items',
      'quotes',
      'section_notes',
    ],
    properties: {
      headline: { type: 'string', description: 'One punchy sentence naming the big story of this workshop.' },
      room_read: { type: 'string', description: '2–3 sentences reading the room: energy, dynamics, how aligned they are.' },
      key_findings: {
        type: 'array',
        minItems: 3,
        maxItems: 6,
        items: {
          type: 'object',
          required: ['title', 'detail'],
          properties: {
            title: { type: 'string', description: 'Short finding, max ~8 words' },
            detail: { type: 'string', description: '1–2 sentences of substance' },
            evidence: { type: 'string', description: 'The specific answers/votes that support it' },
          },
        },
      },
      agreements: { type: 'array', items: { type: 'string' }, description: 'Where the room clearly aligned — one line each.' },
      tensions: { type: 'array', items: { type: 'string' }, description: 'Where the room split or contradicted itself — one line each.' },
      weak_points: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'detail'],
          properties: { title: { type: 'string' }, detail: { type: 'string' } },
        },
        description: 'Brand/site weaknesses the session surfaced.',
      },
      action_items: {
        type: 'array',
        minItems: 4,
        maxItems: 8,
        items: {
          type: 'object',
          required: ['title', 'detail', 'effort'],
          properties: {
            title: { type: 'string', description: 'Imperative, concrete, max ~8 words' },
            detail: { type: 'string', description: 'What to actually do and why, 1–2 sentences' },
            effort: { type: 'string', enum: ['quick_win', 'project', 'big_bet'] },
          },
        },
      },
      quotes: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', description: 'A verbatim standout answer from the session' },
            why: { type: 'string', description: 'Why this quote matters' },
          },
        },
      },
      section_notes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['section', 'note'],
          properties: { section: { type: 'string' }, note: { type: 'string' } },
        },
        description: 'One-line takeaway per workshop section.',
      },
    },
  },
} as const;

const SYSTEM = `You are a senior brand strategist synthesizing a live, in-person client branding workshop for the agency team that ran it. They will turn your report into the client follow-up. Be concrete and specific: cite actual answers, vote counts, slider positions, and post-it phrasings rather than generalities. Prefer the room's own words. Call out contradictions honestly — that's where the value is. No fluff, no consultant-speak.`;

export async function readSummary(store: Store, code: string): Promise<SummaryState> {
  const state = (await store.get(k.summary(code), { type: 'json' })) as SummaryState | null;
  if (!state) return { status: 'none' };
  if (state.status === 'running' && state.startedAt && Date.now() - state.startedAt > SUMMARY_STALE_MS) {
    return { status: 'error', error: 'The last run was interrupted — generate again.', startedAt: state.startedAt };
  }
  return state;
}

/** The long part. Runs inside context.waitUntil, writes its outcome to Blobs. */
export async function generateSummary(store: Store, code: string): Promise<void> {
  try {
    const room = await loadFullRoom(store, code, { allAnswers: true, allEvents: true });
    if (!room) throw new Error('room not found');

    const md = toMarkdown({
      config: room.config,
      participants: room.participants,
      answers: room.answersByQid,
      scratch: room.scratch,
      events: room.events,
    });

    const base = env('ANTHROPIC_BASE_URL');
    const key = env('ANTHROPIC_API_KEY');
    if (!base || !key) {
      throw new Error('AI Gateway is not available here. It activates on production deploys of sites on credit-based Netlify plans.');
    }

    const payload = JSON.stringify({
      model: SUMMARY_MODEL,
      max_tokens: 6000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Here is the complete record of today's workshop — every question, every answer with attribution, vote tallies, slider stats, the host's live scratchpad notes, and the room's emoji reactions.\n\n<workshop_record>\n${md}\n</workshop_record>\n\nSynthesize it into the report. Ground every claim in the record.`,
        },
      ],
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: 'deliver_report' },
    });

    // Overloaded/rate-limited responses are transient — retry with backoff.
    // waitUntil keeps us alive; the client is polling, not waiting on us.
    let res: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, [5_000, 15_000, 30_000][attempt - 1]));
      res = await fetch(`${base.replace(/\/+$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: payload,
      });
      if (res.ok || ![429, 500, 502, 503, 529].includes(res.status)) break;
    }
    if (!res) throw new Error('no response from AI Gateway');
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`AI Gateway returned ${res.status}. ${detail}`);
    }
    const data = (await res.json()) as { content?: Array<{ type: string; input?: unknown }> };
    const toolUse = data.content?.find((b) => b.type === 'tool_use');
    if (!toolUse?.input) throw new Error('The model returned no report — try again.');

    const done: SummaryState = {
      status: 'ready',
      report: toolUse.input as SummaryReport,
      generatedAt: Date.now(),
      model: SUMMARY_MODEL,
    };
    await store.setJSON(k.summary(code), done);
  } catch (error) {
    await store.setJSON(k.summary(code), {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      generatedAt: Date.now(),
    } satisfies SummaryState);
  }
}
