// The sync engine every live view runs on.
//
// Primary transport: EventSource (SSE) → auto-reconnects on its own.
// If SSE can't hold a connection (hostile venue WiFi), we silently fall back
// to polling the same snapshot endpoint, and keep trying to upgrade back.
// Snapshots are complete state, so any transport hiccup heals on next push.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EmoteEvent, Snapshot } from '../../shared/types.ts';
import { HEARTBEAT_MS } from '../../shared/types.ts';
import { api } from './api.ts';

export type SyncStatus = 'connecting' | 'live' | 'polling' | 'offline' | 'gone';

export interface RoomSync {
  snapshot: Snapshot | null;
  status: SyncStatus;
  /** Rolling feed of recent emotes; render layers dedup by id. */
  emotes: EmoteEvent[];
  /** Server-clock "now" — use for timers so everyone counts down together. */
  serverNow: () => number;
}

interface Options {
  pid?: string;
  hostKey?: string;
  stage?: boolean;
  /** Heartbeat as this participant (presence). */
  heartbeat?: boolean;
}

const POLL_MS = 1_200;
const SSE_RETRY_PROBE_MS = 30_000;
const SSE_GIVE_UP_MS = 8_000;

export function useRoom(code: string, opts: Options): RoomSync {
  const { pid, hostKey, stage, heartbeat } = opts;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const [emotes, setEmotes] = useState<EmoteEvent[]>([]);
  const skewRef = useRef(0);
  const seenEmotes = useRef<Set<string>>(new Set());

  const syncUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (pid) params.set('pid', pid);
    if (hostKey) params.set('key', hostKey);
    if (stage) params.set('stage', '1');
    const qs = params.toString();
    return `/api/rooms/${code}/sync${qs ? `?${qs}` : ''}`;
  }, [code, pid, hostKey, stage]);

  const ingest = useCallback((snap: Snapshot) => {
    skewRef.current = snap.now - Date.now();
    setSnapshot(snap);
    if (snap.events.length > 0) {
      const seen = seenEmotes.current;
      const fresh = snap.events.filter((e) => !seen.has(e.id));
      if (fresh.length > 0) {
        for (const e of fresh) seen.add(e.id);
        if (seen.size > 600) {
          seenEmotes.current = new Set([...seen].slice(-300));
        }
        setEmotes((old) => [...old.slice(-24), ...fresh]);
      }
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    let pollTimer: number | undefined;
    let probeTimer: number | undefined;
    let gaveUpTimer: number | undefined;
    let everConnected = false;

    const stopPolling = () => {
      if (pollTimer !== undefined) clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const pollOnce = async () => {
      try {
        const res = await fetch(`${syncUrl}${syncUrl.includes('?') ? '&' : '?'}once=1`);
        if (res.status === 404) {
          setStatus('gone');
          stopPolling();
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        ingest((await res.json()) as Snapshot);
        setStatus((s) => (s === 'polling' || s === 'offline' ? 'polling' : s));
      } catch {
        if (!disposed) setStatus('offline');
      }
    };

    const startPolling = () => {
      if (disposed || pollTimer !== undefined) return;
      setStatus('polling');
      void pollOnce();
      pollTimer = window.setInterval(pollOnce, POLL_MS);
      // Periodically try to get SSE back.
      probeTimer = window.setInterval(() => {
        if (!disposed && document.visibilityState === 'visible') {
          connectSSE();
        }
      }, SSE_RETRY_PROBE_MS);
    };

    const connectSSE = () => {
      if (disposed) return;
      source?.close();
      const es = new EventSource(syncUrl);
      source = es;
      // If SSE can't deliver a first message in time, fall back.
      gaveUpTimer = window.setTimeout(() => {
        if (!everConnected && !disposed) {
          es.close();
          startPolling();
        }
      }, SSE_GIVE_UP_MS);

      es.onmessage = (msg) => {
        everConnected = true;
        if (gaveUpTimer !== undefined) clearTimeout(gaveUpTimer);
        stopPolling();
        if (probeTimer !== undefined) clearInterval(probeTimer);
        probeTimer = undefined;
        try {
          ingest(JSON.parse(msg.data) as Snapshot);
          setStatus('live');
        } catch {
          /* malformed frame — next push heals */
        }
      };
      es.addEventListener('gone', () => {
        setStatus('gone');
        es.close();
      });
      es.onerror = () => {
        // EventSource retries by itself; reflect the blip in the UI and make
        // sure data keeps flowing via polling if the outage lasts.
        if (disposed) return;
        setStatus((s) => (s === 'live' ? 'connecting' : s));
        if (pollTimer === undefined) {
          gaveUpTimer = window.setTimeout(() => {
            if (!disposed && source === es && es.readyState !== EventSource.OPEN) {
              startPolling();
            }
          }, SSE_GIVE_UP_MS);
        }
      };
    };

    connectSSE();

    return () => {
      disposed = true;
      source?.close();
      stopPolling();
      if (probeTimer !== undefined) clearInterval(probeTimer);
      if (gaveUpTimer !== undefined) clearTimeout(gaveUpTimer);
    };
  }, [syncUrl, ingest]);

  // Presence heartbeat + leave beacon + instant "I'm back" on tab focus.
  useEffect(() => {
    if (!heartbeat || !pid) return;
    let stopped = false;
    const beat = () => {
      if (!stopped) void api.heartbeat(code, pid).catch(() => undefined);
    };
    beat();
    const interval = window.setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    const onLeave = () => api.leave(code, pid);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onLeave);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [code, pid, heartbeat]);

  const serverNow = useCallback(() => Date.now() + skewRef.current, []);

  return { snapshot, status, emotes, serverNow };
}
