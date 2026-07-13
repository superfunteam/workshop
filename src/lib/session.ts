// Per-browser identity + room memory, all in localStorage.

export interface Identity {
  pid: string;
  name: string;
  avatar: string;
}

export interface RecentRoom {
  code: string;
  name: string;
  role: 'host' | 'participant';
  at: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/blocked — the app still works, identity just won't persist */
  }
}

export const session = {
  identity: (code: string): Identity | null => read<Identity>(`ws:${code}:id`),
  saveIdentity: (code: string, id: Identity): void => write(`ws:${code}:id`, id),

  hostKey: (code: string): string | null => read<string>(`ws:${code}:key`),
  saveHostKey: (code: string, key: string): void => write(`ws:${code}:key`, key),

  recents: (): RecentRoom[] => read<RecentRoom[]>('ws:recent') ?? [],
  touchRecent(room: Omit<RecentRoom, 'at'>): void {
    const rest = session.recents().filter((r) => r.code !== room.code);
    write('ws:recent', [{ ...room, at: Date.now() }, ...rest].slice(0, 20));
  },
  forgetRecent(code: string): void {
    write('ws:recent', session.recents().filter((r) => r.code !== code));
  },
};
