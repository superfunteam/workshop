// YouTube-Live-style reaction overlay: every emote floats up from the bottom
// corner with the sender's name, on every screen in the room.

import { useEffect, useRef, useState } from 'react';
import type { EmoteEvent } from '../../shared/types.ts';

interface Floater extends EmoteEvent {
  drift: number;
  lane: number;
}

export default function EmoteLayer({ emotes }: { emotes: EmoteEvent[] }) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const spawned = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = emotes.filter((e) => !spawned.current.has(e.id));
    if (fresh.length === 0) return;
    for (const e of fresh) spawned.current.add(e.id);
    if (spawned.current.size > 400) spawned.current = new Set([...spawned.current].slice(-200));
    const now = Date.now();
    setFloaters((old) => [
      ...old.filter((f) => now - f.ts < 4000).slice(-30),
      ...fresh.map((e, i) => ({
        ...e,
        drift: (Math.random() - 0.5) * 120,
        lane: Math.random() * 90 + i * 34,
      })),
    ]);
  }, [emotes]);

  useEffect(() => {
    if (floaters.length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setFloaters((old) => old.filter((f) => now - f.ts < 4000));
    }, 4200);
    return () => clearTimeout(t);
  }, [floaters]);

  return (
    <div className="pointer-events-none fixed bottom-20 left-4 z-50 h-0 select-none" aria-hidden>
      {floaters.map((f) => (
        <div
          key={f.id}
          className="animate-float-up absolute bottom-0 flex flex-col items-center gap-0.5"
          style={{ left: f.lane, ['--drift' as string]: `${f.drift}px` }}
        >
          <span className="text-4xl drop-shadow-sm">{f.emoji}</span>
          <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-bold shadow-pop-sm whitespace-nowrap">
            {f.avatar} {f.name}
          </span>
        </div>
      ))}
    </div>
  );
}
