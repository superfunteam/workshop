// The entire backend: one edge function.
//
// Real-time model: clients hold an SSE stream (or fall back to polling the
// same snapshot endpoint). The stream watches a tiny `version` blob every
// TICK_MS; on change it recomputes the room snapshot (memoized per isolate,
// so N viewers in a room share one recompute) and pushes the WHOLE state.
// Full snapshots are idempotent — a dropped or duplicated push can never
// desync a client, which is what makes this safe on conference-room WiFi.

import type { Config, Context } from '@netlify/edge-functions';
import type { Store } from '@netlify/blobs';
import {
  bumpVersion,
  getConfig,
  getState,
  k,
  listParticipants,
  loadFullRoom,
  shapeSnapshot,
  workshopStore,
  type FullRoom,
  type Role,
} from './lib/rooms.ts';
import { hostKey as newHostKey, normalizeCode, rid, roomCode } from '../../shared/codes.ts';
import { freshState, currentQuestion, flatQuestions, nextPosition, prevPosition } from '../../shared/flow.ts';
import { allAnswered, publicParticipants } from '../../shared/presence.ts';
import {
  cleanName,
  cleanRoomName,
  cleanScratch,
  sanitizeSections,
  sanitizeSettings,
  sanitizeValue,
} from '../../shared/sanitize.ts';
import { isAvatar, isEmote } from '../../shared/emoji.ts';
import { toCsv, toMarkdown } from '../../shared/export.ts';
import { generateSummary, readSummary } from './lib/summary.ts';
import {
  ONLINE_WINDOW_MS,
  type EmoteEvent,
  type HostAction,
  type Participant,
  type RoomState,
  type StoredRoomConfig,
} from '../../shared/types.ts';

const TICK_MS = 350; // version-check cadence per SSE connection
const PRESENCE_PUSH_MS = 5_000; // re-push (fresh presence) even with no version change
const MAX_STREAM_MS = 10 * 60_000; // rotate connections; EventSource reconnects seamlessly
const MEMO_TTL_MS = 2_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// ---------- tiny helpers ----------

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const bad = (message: string, status = 400) => json({ error: message }, status);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ---------- per-isolate caches ----------

const roomMemo = new Map<string, { v: string; at: number; room: FullRoom }>();

async function cachedRoom(store: Store, code: string, version: string): Promise<FullRoom | null> {
  const hit = roomMemo.get(code);
  const now = Date.now();
  if (hit && hit.v === version && now - hit.at < MEMO_TTL_MS) return hit.room;
  const room = await loadFullRoom(store, code);
  if (room) {
    roomMemo.set(code, { v: room.v, at: now, room });
    if (roomMemo.size > 40) {
      const oldest = [...roomMemo.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) roomMemo.delete(oldest[0]);
    }
  }
  return room;
}

const emoteLog = new Map<string, number[]>();

function emoteAllowed(code: string, pid: string): boolean {
  const key = `${code}:${pid}`;
  const now = Date.now();
  const recent = (emoteLog.get(key) ?? []).filter((t) => now - t < 1_000);
  if (recent.length >= 5) return false;
  recent.push(now);
  emoteLog.set(key, recent);
  if (emoteLog.size > 500) emoteLog.clear(); // crude but bounded
  return true;
}

// ---------- route handlers ----------

async function createRoom(store: Store, body: Record<string, unknown>): Promise<Response> {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const candidate = roomCode();
    if (!(await getConfig(store, candidate))) {
      code = candidate;
      break;
    }
  }
  if (!code) return bad('could not allocate a room code', 500);
  const config: StoredRoomConfig = {
    code,
    name: cleanRoomName(body.name),
    createdAt: Date.now(),
    sections: sanitizeSections(body.sections),
    settings: sanitizeSettings(body.settings),
    hostKey: newHostKey(),
  };
  await store.setJSON(k.config(code), config);
  await store.setJSON(k.state(code), freshState());
  await bumpVersion(store, code);
  return json({ code, hostKey: config.hostKey });
}

async function joinRoom(store: Store, code: string, body: Record<string, unknown>): Promise<Response> {
  const name = cleanName(body.name);
  if (!name) return bad('name required');
  const avatar = typeof body.avatar === 'string' && isAvatar(body.avatar) ? body.avatar : '🐢';
  const now = Date.now();
  const existingPid = typeof body.pid === 'string' ? body.pid.slice(0, 16) : '';
  const existing = existingPid
    ? ((await store.get(k.participant(code, existingPid), { type: 'json' })) as Participant | null)
    : null;
  const participant: Participant = existing
    ? { ...existing, name, avatar, lastSeen: now, removed: false }
    : { pid: rid(12), name, avatar, joinedAt: now, lastSeen: now };
  await store.setJSON(k.participant(code, participant.pid), participant);
  await bumpVersion(store, code);
  return json({ pid: participant.pid });
}

async function heartbeat(store: Store, code: string, body: Record<string, unknown>): Promise<Response> {
  const pid = typeof body.pid === 'string' ? body.pid : '';
  if (!pid) return bad('pid required');
  const participant = (await store.get(k.participant(code, pid), { type: 'json' })) as Participant | null;
  if (!participant) return bad('unknown participant', 404);
  const now = Date.now();
  const leaving = body.leaving === true;
  const wasOffline = now - participant.lastSeen > ONLINE_WINDOW_MS;
  await store.setJSON(k.participant(code, pid), {
    ...participant,
    lastSeen: leaving ? 0 : now,
  });
  // Plain heartbeats don't bump (the slow re-push covers them); arrivals,
  // returns and departures do, so counts update instantly.
  if (leaving || wasOffline) await bumpVersion(store, code);
  return json({ ok: true });
}

async function submitAnswer(store: Store, code: string, body: Record<string, unknown>): Promise<Response> {
  const pid = typeof body.pid === 'string' ? body.pid : '';
  const qid = typeof body.qid === 'string' ? body.qid : '';
  if (!pid || !qid) return bad('pid and qid required');
  const [config, state, participant] = await Promise.all([
    getConfig(store, code),
    getState(store, code),
    store.get(k.participant(code, pid), { type: 'json' }) as Promise<Participant | null>,
  ]);
  if (!config || !state) return bad('room not found', 404);
  if (!participant || participant.removed) return bad('not in this room', 403);
  const question = flatQuestions(config).find((f) => f.question.id === qid)?.question;
  if (!question) return bad('unknown question', 404);

  const value = sanitizeValue(question, body.value);
  if (!value) return bad('answer not valid for this question');

  await store.setJSON(k.answer(code, qid, pid), { pid, qid, value, updatedAt: Date.now() });

  // Auto-reveal: the moment the last online participant answers the current
  // question. (Concurrent last-answers both flip the same flag — idempotent.)
  const cur = currentQuestion(config, state);
  if (config.settings.autoReveal && cur?.question.id === qid && !state.revealed[qid]) {
    const [participants, { blobs }] = await Promise.all([
      listParticipants(store, code),
      store.list({ prefix: `${k.answersPrefix(code)}${qid}/` }),
    ]);
    const answered = blobs.map((b) => b.key.split('/').pop()!).filter(Boolean);
    if (allAnswered(publicParticipants(participants, Date.now()), answered)) {
      await store.setJSON(k.state(code), {
        ...state,
        revealed: { ...state.revealed, [qid]: true },
      });
    }
  }
  await bumpVersion(store, code);
  return json({ ok: true });
}

async function emote(store: Store, code: string, body: Record<string, unknown>): Promise<Response> {
  const pid = typeof body.pid === 'string' ? body.pid : '';
  const emoji = typeof body.emoji === 'string' ? body.emoji : '';
  if (!pid || !isEmote(emoji)) return bad('bad emote');
  if (!emoteAllowed(code, pid)) return bad('slow down', 429);
  const participant = (await store.get(k.participant(code, pid), { type: 'json' })) as Participant | null;
  if (!participant || participant.removed) return bad('not in this room', 403);
  const now = Date.now();
  const event: EmoteEvent = {
    id: rid(8),
    pid,
    name: participant.name,
    avatar: participant.avatar,
    emoji,
    ts: now,
  };
  await store.setJSON(k.event(code, now), event);
  await bumpVersion(store, code);
  return json({ ok: true });
}

function clampGoto(config: StoredRoomConfig, section: unknown, question: unknown): { section: number; question: number } | null {
  if (!Number.isInteger(section) || !Number.isInteger(question)) return null;
  const s = Math.min(Math.max(0, section as number), Math.max(0, config.sections.length - 1));
  const qCount = config.sections[s]?.questions.length ?? 0;
  const q = Math.min(Math.max(0, question as number), Math.max(0, qCount - 1));
  return { section: s, question: q };
}

async function hostAction(store: Store, code: string, body: Record<string, unknown>): Promise<Response> {
  const key = typeof body.key === 'string' ? body.key : '';
  const config = await getConfig(store, code);
  if (!config) return bad('room not found', 404);
  if (!key || key !== config.hostKey) return bad('bad host key', 403);
  const state = (await getState(store, code)) ?? freshState();
  const action = body as unknown as HostAction;
  const now = Date.now();

  const next: RoomState = { ...state, revealed: { ...state.revealed } };
  switch (action.action) {
    case 'start':
      next.phase = 'live';
      next.startedAt = state.startedAt ?? now;
      next.current = clampGoto(config, 0, 0) ?? { section: 0, question: 0 };
      break;
    case 'next':
    case 'prev': {
      const pos = action.action === 'next' ? nextPosition(config, state) : prevPosition(config, state);
      if (!pos) return json({ ok: true, atEnd: true });
      next.current = pos;
      next.timer = null;
      break;
    }
    case 'goto': {
      const pos = clampGoto(config, action.section, action.question);
      if (!pos) return bad('bad position');
      next.current = pos;
      next.timer = null;
      break;
    }
    case 'reveal':
    case 'reopen': {
      const qid = typeof action.qid === 'string' ? action.qid : '';
      if (!qid) return bad('qid required');
      next.revealed[qid] = action.action === 'reveal';
      break;
    }
    case 'phase': {
      const phase = action.phase;
      if (!['lobby', 'live', 'break', 'ended'].includes(phase)) return bad('bad phase');
      next.phase = phase;
      next.timer = null; // a countdown never outlives the moment it was set for
      if (phase === 'ended') next.endedAt = now;
      if (phase === 'live') next.startedAt = state.startedAt ?? now;
      break;
    }
    case 'timer': {
      const seconds = Number.isInteger(action.seconds) ? (action.seconds as number) : 0;
      if (seconds < 5 || seconds > 3600) return bad('timer must be 5s–60min');
      next.timer = { endsAt: now + seconds * 1000, seconds };
      break;
    }
    case 'clearTimer':
      next.timer = null;
      break;
    case 'remove':
    case 'restore': {
      const pid = typeof action.pid === 'string' ? action.pid : '';
      const participant = (await store.get(k.participant(code, pid), { type: 'json' })) as Participant | null;
      if (!participant) return bad('unknown participant', 404);
      await store.setJSON(k.participant(code, pid), { ...participant, removed: action.action === 'remove' });
      await bumpVersion(store, code);
      return json({ ok: true });
    }
    case 'scratch':
      await store.setJSON(k.scratch(code), { text: cleanScratch(action.text), updatedAt: now });
      await bumpVersion(store, code);
      return json({ ok: true });
    case 'autoReveal':
      await store.setJSON(k.config(code), { ...config, settings: { ...config.settings, autoReveal: action.on === true } });
      await bumpVersion(store, code);
      return json({ ok: true });
    default:
      return bad('unknown action');
  }

  await store.setJSON(k.state(code), next);
  await bumpVersion(store, code);
  return json({ ok: true });
}

async function saveConfig(store: Store, code: string, body: Record<string, unknown>): Promise<Response> {
  const key = typeof body.key === 'string' ? body.key : '';
  const stored = await getConfig(store, code);
  if (!stored) return bad('room not found', 404);
  if (!key || key !== stored.hostKey) return bad('bad host key', 403);
  const raw = (body.config ?? {}) as Record<string, unknown>;
  const config: StoredRoomConfig = {
    code: stored.code,
    createdAt: stored.createdAt,
    hostKey: stored.hostKey,
    name: cleanRoomName(raw.name ?? stored.name),
    sections: sanitizeSections(raw.sections),
    settings: sanitizeSettings(raw.settings),
  };
  await store.setJSON(k.config(code), config);
  // If the edit moved the ground out from under the current pointer, re-clamp.
  const state = await getState(store, code);
  if (state && !currentQuestion(config, state)) {
    await store.setJSON(k.state(code), { ...state, current: { section: 0, question: 0 } });
  }
  await bumpVersion(store, code);
  return json({ ok: true });
}

async function duplicateRoom(store: Store, code: string, body: Record<string, unknown>): Promise<Response> {
  const key = typeof body.key === 'string' ? body.key : '';
  const source = await getConfig(store, code);
  if (!source) return bad('room not found', 404);
  if (!key || key !== source.hostKey) return bad('bad host key', 403);
  return createRoom(store, {
    name: typeof body.name === 'string' && body.name.trim() ? body.name : `${source.name} (copy)`,
    sections: source.sections,
    settings: source.settings,
  });
}

async function deleteRoom(store: Store, code: string, keyParam: string): Promise<Response> {
  const config = await getConfig(store, code);
  if (!config) return json({ ok: true });
  if (!keyParam || keyParam !== config.hostKey) return bad('bad host key', 403);
  const { blobs } = await store.list({ prefix: k.roomPrefix(code) });
  await Promise.all(blobs.map((b) => store.delete(b.key)));
  roomMemo.delete(code);
  return json({ ok: true });
}

async function roomMeta(store: Store, code: string): Promise<Response> {
  const [config, state] = await Promise.all([getConfig(store, code), getState(store, code)]);
  if (!config || !state) return json({ exists: false }, 404);
  const participants = publicParticipants(await listParticipants(store, code), Date.now());
  return json({
    exists: true,
    code: config.code,
    name: config.name,
    phase: state.phase,
    online: participants.filter((p) => p.online).length,
    questions: flatQuestions(config).length,
    sections: config.sections.length,
    createdAt: config.createdAt,
  });
}

async function exportRoom(store: Store, code: string, format: string): Promise<Response> {
  const room = await loadFullRoom(store, code, { allAnswers: true, allEvents: true });
  if (!room) return bad('room not found', 404);
  const data = {
    config: room.config,
    participants: room.participants,
    answers: room.answersByQid,
    scratch: room.scratch,
    events: room.events,
  };
  const slug = room.config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workshop';
  if (format === 'csv') {
    return new Response(toCsv(data), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${slug}-${code}.csv"`,
        'cache-control': 'no-store',
      },
    });
  }
  return new Response(toMarkdown(data), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${slug}-${code}.md"`,
      'cache-control': 'no-store',
    },
  });
}

async function upload(store: Store, code: string, req: Request, pid: string): Promise<Response> {
  const participant = pid ? ((await store.get(k.participant(code, pid), { type: 'json' })) as Participant | null) : null;
  if (!participant || participant.removed) return bad('not in this room', 403);
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) return bad('images only', 415);
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) return bad('empty upload');
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return bad('max 5MB', 413);
  const id = rid(16);
  await store.set(k.upload(code, id), bytes, { metadata: { contentType } });
  return json({ url: `/api/rooms/${code}/uploads/${id}` });
}

async function serveUpload(store: Store, code: string, id: string): Promise<Response> {
  const result = await store.getWithMetadata(k.upload(code, id.slice(0, 24)), { type: 'arrayBuffer' });
  if (!result) return bad('not found', 404);
  const contentType = typeof result.metadata.contentType === 'string' ? result.metadata.contentType : 'image/png';
  return new Response(result.data, {
    headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' },
  });
}

// ---------- sync (SSE + polling fallback) ----------

async function resolveRole(store: Store, code: string, url: URL): Promise<{ role: Role; pid?: string }> {
  const key = url.searchParams.get('key') ?? '';
  const pid = url.searchParams.get('pid') ?? undefined;
  if (key) {
    const config = await getConfig(store, code);
    if (config && key === config.hostKey) return { role: 'host', pid };
  }
  if (url.searchParams.get('stage') === '1') return { role: 'stage' };
  return { role: 'participant', pid };
}

async function syncOnce(store: Store, code: string, url: URL): Promise<Response> {
  const { role, pid } = await resolveRole(store, code, url);
  const version = (await store.get(k.version(code), { type: 'text' })) ?? '';
  const room = await cachedRoom(store, code, version);
  if (!room) return bad('room not found', 404);
  const full = url.searchParams.get('full') === '1';
  const snapshotRoom = full ? await loadFullRoom(store, code, { allAnswers: true, allEvents: true }) : room;
  if (!snapshotRoom) return bad('room not found', 404);
  return json(shapeSnapshot(snapshotRoom, role, pid, { revealAll: full }));
}

function syncStream(store: Store, code: string, role: Role, pid: string | undefined, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const finish = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      signal.addEventListener('abort', finish);
      (async () => {
        controller.enqueue(encoder.encode('retry: 1200\n\n'));
        let lastVersion = ' none';
        let lastPush = 0;
        const startedAt = Date.now();
        while (!closed) {
          const now = Date.now();
          if (now - startedAt > MAX_STREAM_MS) break;
          const version = (await store.get(k.version(code), { type: 'text' })) ?? '';
          if (version !== lastVersion || now - lastPush >= PRESENCE_PUSH_MS) {
            const room = await cachedRoom(store, code, version);
            if (!room) {
              controller.enqueue(encoder.encode('event: gone\ndata: {}\n\n'));
              break;
            }
            const snapshot = shapeSnapshot(room, role, pid);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
            lastVersion = version;
            lastPush = now;
          }
          await sleep(TICK_MS);
        }
        finish();
      })().catch(finish);
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}

// ---------- router ----------

export default async (req: Request, context: Context): Promise<Response> => {
  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '').split('/');
  const store = workshopStore();

  try {
    if (segments[0] !== 'rooms') return bad('not found', 404);

    if (segments.length === 1) {
      if (req.method === 'POST') return await createRoom(store, await readJson(req));
      return bad('not found', 404);
    }

    const code = normalizeCode(segments[1] ?? '');
    if (code.length < 4 || code.length > 8) return bad('bad room code');
    const action = segments[2] ?? '';

    if (req.method === 'DELETE' && !action) {
      return await deleteRoom(store, code, url.searchParams.get('key') ?? '');
    }

    if (req.method === 'GET') {
      switch (action) {
        case 'meta':
          return await roomMeta(store, code);
        case 'sync': {
          if (url.searchParams.get('once') === '1' || url.searchParams.get('full') === '1') {
            return await syncOnce(store, code, url);
          }
          const { role, pid } = await resolveRole(store, code, url);
          if (!(await getConfig(store, code))) return bad('room not found', 404);
          return syncStream(store, code, role, pid, req.signal);
        }
        case 'export':
          return await exportRoom(store, code, url.searchParams.get('format') ?? 'md');
        case 'summary':
          return json(await readSummary(store, code));
        case 'uploads':
          return await serveUpload(store, code, segments[3] ?? '');
        default:
          return bad('not found', 404);
      }
    }

    if (req.method === 'POST') {
      switch (action) {
        case 'join':
          return await joinRoom(store, code, await readJson(req));
        case 'heartbeat':
          return await heartbeat(store, code, await readJson(req));
        case 'answer':
          return await submitAnswer(store, code, await readJson(req));
        case 'emote':
          return await emote(store, code, await readJson(req));
        case 'host':
          return await hostAction(store, code, await readJson(req));
        case 'duplicate':
          return await duplicateRoom(store, code, await readJson(req));
        case 'upload':
          return await upload(store, code, req, url.searchParams.get('pid') ?? '');
        case 'summary': {
          const body = await readJson(req);
          const config = await getConfig(store, code);
          if (!config) return bad('room not found', 404);
          if (typeof body.key !== 'string' || body.key !== config.hostKey) return bad('bad host key', 403);
          const current = await readSummary(store, code);
          if (current.status === 'running') return json(current);
          const startedAt = Date.now();
          await store.setJSON(k.summary(code), { status: 'running', startedAt });
          // The model call outlives this response; pollers watch the blob.
          context.waitUntil(generateSummary(store, code));
          return json({ status: 'running', startedAt });
        }
        default:
          return bad('not found', 404);
      }
    }

    if (req.method === 'PUT' && action === 'config') {
      return await saveConfig(store, code, await readJson(req));
    }

    return bad('method not allowed', 405);
  } catch (error) {
    console.error('[api]', req.method, url.pathname, error);
    return bad('server error', 500);
  }
};

export const config: Config = { path: '/api/*' };
