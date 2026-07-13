// The always-there reaction bar on participant screens.

import { useRef, useState } from 'react';
import { EMOTES } from '../../shared/emoji.ts';
import { api } from '../lib/api.ts';

export default function EmoteBar({ code, pid }: { code: string; pid: string }) {
  const [bouncing, setBouncing] = useState<string | null>(null);
  const lastSent = useRef(0);

  const send = (emoji: string) => {
    const now = Date.now();
    if (now - lastSent.current < 280) return; // gentle client-side throttle
    lastSent.current = now;
    setBouncing(emoji);
    setTimeout(() => setBouncing(null), 300);
    void api.emote(code, pid, emoji).catch(() => undefined);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="card-pop flex items-center gap-1 rounded-full! px-3 py-1.5">
        {EMOTES.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => send(emoji)}
            className={`rounded-full px-1.5 py-1 text-2xl transition-transform hover:scale-125 active:scale-90 ${
              bouncing === emoji ? 'scale-135' : ''
            }`}
            aria-label={`react ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
