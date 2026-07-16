// Storage layer + snapshot assembly for the edge API.
// Write pattern: every writer owns its own key (no read-modify-write races
// between participants); `version` is a tiny tombstone bumped after any
// meaningful mutation, which is what the sync loops watch.

import { getStore, type Store } from '@netlify/blobs';
import { rid } from '../../../shared/codes.ts';
import { publicParticipants } from '../../../shared/presence.ts';
import { currentQuestion, flatQuestions } from '../../../shared/flow.ts';
import {
  EVENT_WINDOW_MS,
  type Answer,
  type AnswerValue,
  type EmoteEvent,
  type Participant,
  type PublicParticipant,
  type Question,
  type QuestionAnswers,
  type RoomConfig,
  type RoomState,
  type Snapshot,
  type StoredRoomConfig,
} from '../../../shared/types.ts';

export function workshopStore(): Store {
  // Strong consistency everywhere: reads always see the latest write. Our
  // payloads are tiny, so the latency cost is irrelevant next to correctness.
  return getStore({ name: 'workshop', consistency: 'strong' });
}

export const k = {
  config: (code: string) => `rooms/${code}/config`,
  state: (code: string) => `rooms/${code}/state`,
  version: (code: string) => `rooms/${code}/version`,
  scratch: (code: string) => `rooms/${code}/scratch`,
  participant: (code: string, pid: string) => `rooms/${code}/participants/${pid}`,
  participantsPrefix: (code: string) => `rooms/${code}/participants/`,
  answer: (code: string, qid: string, pid: string) => `rooms/${code}/answers/${qid}/${pid}`,
  answersPrefix: (code: string) => `rooms/${code}/answers/`,
  event: (code: string, ts: number) => `rooms/${code}/events/${ts}-${rid(6)}`,
  eventsPrefix: (code: string) => `rooms/${code}/events/`,
  upload: (code: string, id: string) => `rooms/${code}/uploads/${id}`,
  summary: (code: string) => `rooms/${code}/summary`,
  roomPrefix: (code: string) => `rooms/${code}/`,
};

export async function bumpVersion(store: Store, code: string): Promise<void> {
  await store.set(k.version(code), `${Date.now()}-${rid(4)}`);
}

export async function getConfig(store: Store, code: string): Promise<StoredRoomConfig | null> {
  return (await store.get(k.config(code), { type: 'json' })) as StoredRoomConfig | null;
}

export async function getState(store: Store, code: string): Promise<RoomState | null> {
  return (await store.get(k.state(code), { type: 'json' })) as RoomState | null;
}

async function getMany<T>(store: Store, keys: string[]): Promise<T[]> {
  const bodies = await Promise.all(keys.map((key) => store.get(key, { type: 'json' })));
  return bodies.filter((b): b is Awaited<T> => b !== null && b !== undefined) as T[];
}

export async function listParticipants(store: Store, code: string): Promise<Participant[]> {
  const { blobs } = await store.list({ prefix: k.participantsPrefix(code) });
  return getMany<Participant>(store, blobs.map((b) => b.key));
}

export async function answeredPidsFor(store: Store, code: string, qid: string): Promise<string[]> {
  const { blobs } = await store.list({ prefix: `${k.answersPrefix(code)}${qid}/` });
  return blobs.map((b) => b.key.split('/').pop()!).filter(Boolean);
}

// ---------- full room load ----------

export interface FullRoom {
  v: string;
  now: number;
  config: StoredRoomConfig;
  state: RoomState;
  participants: PublicParticipant[];
  /** qid → pids, for every question with any answers. */
  answeredByQid: Record<string, string[]>;
  /** qid → answer bodies, only for questions whose values are in play. */
  answersByQid: Record<string, Answer[]>;
  events: EmoteEvent[];
  scratch: string;
}

export async function loadFullRoom(
  store: Store,
  code: string,
  opts: { allAnswers?: boolean; allEvents?: boolean } = {},
): Promise<FullRoom | null> {
  const now = Date.now();
  const [config, state, version, scratchRaw, pList, aList, eList] = await Promise.all([
    getConfig(store, code),
    getState(store, code),
    store.get(k.version(code), { type: 'text' }),
    store.get(k.scratch(code), { type: 'json' }) as Promise<{ text?: string } | null>,
    store.list({ prefix: k.participantsPrefix(code) }),
    store.list({ prefix: k.answersPrefix(code) }),
    store.list({ prefix: k.eventsPrefix(code) }),
  ]);
  if (!config || !state) return null;

  // Who answered what — from key names alone, no bodies needed.
  const answersPrefix = k.answersPrefix(code);
  const answeredByQid: Record<string, string[]> = {};
  for (const b of aList.blobs) {
    const [qid, pid] = b.key.slice(answersPrefix.length).split('/');
    if (!qid || !pid) continue;
    (answeredByQid[qid] ??= []).push(pid);
  }

  // Bodies only where values can actually be shown: the current question,
  // anything revealed — or everything for recap/export.
  const loadQids = new Set<string>();
  if (opts.allAnswers) {
    for (const f of flatQuestions(config)) loadQids.add(f.question.id);
  } else {
    const cur = currentQuestion(config, state);
    if (cur) loadQids.add(cur.question.id);
    for (const [qid, revealed] of Object.entries(state.revealed)) if (revealed) loadQids.add(qid);
  }
  const answerKeys = aList.blobs
    .map((b) => b.key)
    .filter((key) => loadQids.has(key.slice(answersPrefix.length).split('/')[0]));
  const answersByQid: Record<string, Answer[]> = {};
  for (const a of await getMany<Answer>(store, answerKeys)) {
    (answersByQid[a.qid] ??= []).push(a);
  }
  for (const list of Object.values(answersByQid)) list.sort((x, y) => x.updatedAt - y.updatedAt);

  // Recent emote bodies only (all of them for exports/stats); key names
  // carry the timestamp.
  const eventsPrefix = k.eventsPrefix(code);
  const cutoff = opts.allEvents ? 0 : now - EVENT_WINDOW_MS;
  const recentEventKeys = eList.blobs
    .map((b) => b.key)
    .filter((key) => {
      const ts = Number.parseInt(key.slice(eventsPrefix.length), 10);
      return Number.isFinite(ts) && ts >= cutoff;
    });
  const events = (await getMany<EmoteEvent>(store, recentEventKeys)).sort((a, b) => a.ts - b.ts);

  const participants = await getMany<Participant>(store, pList.blobs.map((b) => b.key));

  return {
    v: (version as string | null) ?? '',
    now,
    config,
    state,
    participants: publicParticipants(participants, now),
    answeredByQid,
    answersByQid,
    events,
    scratch: scratchRaw?.text ?? '',
  };
}

// ---------- shaping by role ----------

export type Role = 'host' | 'participant' | 'stage';

function tinyHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shapeSnapshot(
  room: FullRoom,
  role: Role,
  pid?: string,
  opts: { revealAll?: boolean } = {},
): Snapshot {
  const isHost = role === 'host';
  const { hostKey: _hostKey, ...bareConfig } = room.config;
  const config: RoomConfig = isHost
    ? bareConfig
    : {
        ...bareConfig,
        // Presenter notes are for the host's eyes only.
        sections: bareConfig.sections.map((s) => ({
          ...s,
          questions: s.questions.map(({ notes: _notes, ...q }) => q as Question),
        })),
      };

  const questionById = new Map(flatQuestions(room.config).map((f) => [f.question.id, f.question]));
  const answers: Record<string, QuestionAnswers> = {};
  for (const [qid] of questionById) {
    const entry: QuestionAnswers = { answeredPids: room.answeredByQid[qid] ?? [] };
    const bodies = room.answersByQid[qid];
    const question = questionById.get(qid);
    const visible = isHost || opts.revealAll || room.state.revealed[qid];
    if (bodies && visible) {
      let list = bodies;
      if (question?.anonymous && !isHost) {
        // Strip attribution and shuffle deterministically so screen order
        // can't be matched to the answering order.
        list = bodies
          .map((a) => ({ ...a, pid: '', updatedAt: 0 }))
          .sort((a, b) => tinyHash(JSON.stringify(a.value)) - tinyHash(JSON.stringify(b.value)));
      }
      entry.answers = list;
    }
    answers[qid] = entry;
  }

  let mine: Record<string, AnswerValue> | undefined;
  if (pid) {
    mine = {};
    for (const [qid, bodies] of Object.entries(room.answersByQid)) {
      const own = bodies.find((a) => a.pid === pid);
      if (own) mine[qid] = own.value;
    }
  }

  return {
    v: room.v,
    now: room.now,
    config,
    state: room.state,
    participants: room.participants,
    answers,
    events: room.events,
    mine,
    scratch: isHost ? room.scratch : undefined,
    isHost,
  };
}
