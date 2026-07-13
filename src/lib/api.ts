import type { AnswerValue, HostAction, RoomConfig, RoomSettings, Section } from '../../shared/types.ts';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep status */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

const post = <T,>(path: string, body: unknown): Promise<T> =>
  call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  createRoom: (name: string, sections?: Section[], settings?: RoomSettings) =>
    post<{ code: string; hostKey: string }>('/api/rooms', { name, sections, settings }),

  meta: (code: string) =>
    call<{ exists: boolean; name: string; phase: string; online: number; questions: number; createdAt: number }>(
      `/api/rooms/${code}/meta`,
    ),

  join: (code: string, name: string, avatar: string, pid?: string) =>
    post<{ pid: string }>(`/api/rooms/${code}/join`, { name, avatar, pid }),

  heartbeat: (code: string, pid: string) => post<{ ok: true }>(`/api/rooms/${code}/heartbeat`, { pid }),

  leave: (code: string, pid: string) => {
    // Beacon survives tab close; fall back to fetch if unavailable.
    const payload = JSON.stringify({ pid, leaving: true });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`/api/rooms/${code}/heartbeat`, new Blob([payload], { type: 'application/json' }));
    } else {
      void post(`/api/rooms/${code}/heartbeat`, { pid, leaving: true }).catch(() => undefined);
    }
  },

  answer: (code: string, pid: string, qid: string, value: AnswerValue) =>
    post<{ ok: true }>(`/api/rooms/${code}/answer`, { pid, qid, value }),

  emote: (code: string, pid: string, emoji: string) =>
    post<{ ok: true }>(`/api/rooms/${code}/emote`, { pid, emoji }),

  host: (code: string, key: string, action: HostAction) =>
    post<{ ok: true; atEnd?: boolean }>(`/api/rooms/${code}/host`, { key, ...action }),

  saveConfig: (code: string, key: string, config: Pick<RoomConfig, 'name' | 'sections' | 'settings'>) =>
    call<{ ok: true }>(`/api/rooms/${code}/config`, {
      method: 'PUT',
      body: JSON.stringify({ key, config }),
    }),

  duplicate: (code: string, key: string, name?: string) =>
    post<{ code: string; hostKey: string }>(`/api/rooms/${code}/duplicate`, { key, name }),

  deleteRoom: (code: string, key: string) =>
    call<{ ok: true }>(`/api/rooms/${code}?key=${encodeURIComponent(key)}`, { method: 'DELETE' }),

  upload: async (code: string, pid: string, file: Blob): Promise<{ url: string }> => {
    const res = await fetch(`/api/rooms/${code}/upload?pid=${encodeURIComponent(pid)}`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'image/png' },
      body: file,
    });
    if (!res.ok) throw new Error('upload failed');
    return (await res.json()) as { url: string };
  },

  exportUrl: (code: string, format: 'md' | 'csv') => `/api/rooms/${code}/export?format=${format}`,
};
