// Slides and discussion moments — the no-typing screens, rendered big and
// springy on participant, host, and stage alike.

import { motion } from 'motion/react';
import AnimatedEmoji from './AnimatedEmoji.tsx';
import type { DiscussQuestion, SlideQuestion } from '../../shared/types.ts';
import { BOUNCE, SLIDE } from '../lib/springs.ts';

export function SlideMoment({ question, big }: { question: SlideQuestion; big?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      {question.emoji && (
        <motion.div
          initial={{ scale: 0, rotate: -14 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...BOUNCE, delay: 0.05 }}
          aria-hidden
        >
          <AnimatedEmoji emoji={question.emoji} size={big ? 144 : 96} />
        </motion.div>
      )}
      <motion.h1
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SLIDE}
        className={`display-type ${big ? 'text-8xl' : 'text-5xl sm:text-6xl'}`}
      >
        {question.prompt}
      </motion.h1>
      {question.body && (
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SLIDE, delay: 0.08 }}
          className={`max-w-3xl font-semibold whitespace-pre-line text-ink-soft ${big ? 'text-3xl' : 'text-lg sm:text-xl'}`}
        >
          {question.body}
        </motion.p>
      )}
    </div>
  );
}

export function DiscussMoment({
  question,
  big,
  role,
}: {
  question: DiscussQuestion;
  big?: boolean;
  role: 'participant' | 'host' | 'stage';
}) {
  const sub =
    role === 'participant'
      ? 'laptops half-mast — the host is catching notes'
      : role === 'host'
        ? 'your scratchpad below is the record of this one'
        : 'the room has the mic';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: [0, -6, 5, 0] }}
        transition={BOUNCE}
        aria-hidden
      >
        <AnimatedEmoji emoji="🗣️" size={big ? 128 : 88} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SLIDE, delay: 0.06 }}
        className={`font-semibold text-ink-soft ${big ? 'text-4xl' : 'text-2xl'}`}
      >
        talk it out — {sub}
      </motion.p>
      {question.hint && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className={`font-semibold text-ink-faint ${big ? 'text-2xl' : 'text-base'}`}
        >
          {question.hint}
        </motion.p>
      )}
    </div>
  );
}
