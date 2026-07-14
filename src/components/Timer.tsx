import { useEffect, useState } from 'react';
import type { RoomTimer } from '../../shared/types.ts';
import Icon from './Icon.tsx';

function useRemaining(timer: RoomTimer | null, serverNow: () => number): number | null {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => forceTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [timer]);
  if (!timer) return null;
  return Math.max(0, Math.ceil((timer.endsAt - serverNow()) / 1000));
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function TimerChip({ timer, serverNow }: { timer: RoomTimer | null; serverNow: () => number }) {
  const remaining = useRemaining(timer, serverNow);
  if (remaining === null) return null;
  const urgent = remaining <= 10;
  return (
    <span
      className={`chip font-display text-base tabular-nums ${
        remaining === 0 ? 'bg-coral text-white' : urgent ? 'bg-coral/20 animate-pulse' : 'bg-sun/40'
      }`}
    >
      <Icon name="timer" size={16} /> {remaining === 0 ? 'Time!' : fmt(remaining)}
    </span>
  );
}

/** Projector-sized countdown. */
export function TimerBig({ timer, serverNow }: { timer: RoomTimer | null; serverNow: () => number }) {
  const remaining = useRemaining(timer, serverNow);
  if (remaining === null) return null;
  return (
    <div
      className={`card-pop animate-pop-in fixed top-6 right-6 z-40 px-6 py-3 text-center ${
        remaining === 0 ? 'bg-coral text-white' : remaining <= 10 ? 'bg-note-pink' : 'bg-sun'
      }`}
    >
      <div className="display-type text-5xl tabular-nums">{remaining === 0 ? 'Time!' : fmt(remaining)}</div>
    </div>
  );
}
