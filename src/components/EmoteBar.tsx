// The always-there reaction bar on participant screens. Every emoji is the
// Noto art — still at rest, animating the moment you hover or press it.

import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { EMOTES } from '../../shared/emoji.ts';
import { api } from '../lib/api.ts';
import { BOUNCE } from '../lib/springs.ts';
import AnimatedEmoji from './AnimatedEmoji.tsx';

export default function EmoteBar({ code, pid }: { code: string; pid: string }) {
  const lastSent = useRef(0);
  const [hot, setHot] = useState<string | null>(null);

  const send = (emoji: string) => {
    const now = Date.now();
    if (now - lastSent.current < 280) return; // gentle client-side throttle
    lastSent.current = now;
    void api.emote(code, pid, emoji).catch(() => undefined);
  };

  return (
    <motion.div
      initial={{ y: 24 }}
      animate={{ y: 0 }}
      transition={{ ...BOUNCE, delay: 0.25 }}
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2"
    >
      <div className="card-pop flex items-center gap-1 rounded-full! px-3 py-1.5">
        {EMOTES.map((emoji) => (
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.3, y: -6, rotate: -8 }}
            whileTap={{ scale: 0.7 }}
            transition={BOUNCE}
            type="button"
            onClick={() => send(emoji)}
            onPointerEnter={() => setHot(emoji)}
            onPointerLeave={() => setHot((h) => (h === emoji ? null : h))}
            onPointerDown={() => setHot(emoji)}
            className="flex items-center rounded-full px-1.5 py-1"
            aria-label={`react ${emoji}`}
          >
            <AnimatedEmoji emoji={emoji} size={30} paused={hot !== emoji} />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
