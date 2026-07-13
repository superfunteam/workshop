// Tap-to-rank: tap options in your priority order; tap again to un-rank.
// Deliberately not drag-and-drop — tapping is faster and works on every device.

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { RankQuestion, RankValue } from '../../../shared/types.ts';
import { BOUNCE, POP } from '../../lib/springs.ts';
import { ErrorNote, SubmitButton, useSubmit } from './common.tsx';

export default function RankInput({
  question,
  value,
  onSubmit,
}: {
  question: RankQuestion;
  value: RankValue | null;
  onSubmit: (v: RankValue) => Promise<void>;
}) {
  const [order, setOrder] = useState<number[]>(value?.order ?? []);
  const { busy, error, submit } = useSubmit(onSubmit);
  const total = question.options.length;

  const tap = (i: number) => {
    setOrder((old) => (old.includes(i) ? old.filter((x) => x !== i) : [...old, i]));
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="font-semibold text-lg text-ink-soft">Tap in order — most important first</p>
      <div className="flex w-full flex-col gap-3">
        {question.options.map((option, i) => {
          const pos = order.indexOf(i);
          const ranked = pos >= 0;
          return (
            <motion.button
              key={i}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              transition={POP}
              type="button"
              onClick={() => tap(i)}
              className={`card-pop flex cursor-pointer items-center gap-4 px-4 py-3 text-left ${
                ranked ? 'bg-note-mint' : 'bg-white'
              }`}
              aria-pressed={ranked}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line font-display text-xl font-extrabold ${
                  ranked ? 'bg-ink text-white' : 'bg-white text-ink-faint'
                }`}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={ranked ? pos + 1 : 'dot'}
                    initial={{ scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, transition: { duration: 0.08 } }}
                    transition={BOUNCE}
                    className="inline-block"
                  >
                    {ranked ? pos + 1 : '·'}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="font-display text-lg font-bold">{option}</span>
              {ranked && (
                <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="ml-auto text-sm font-semibold text-ink-soft">
                  tap to remove
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
      {order.length > 0 && order.length < total && (
        <p className="text-sm font-semibold text-ink-soft">
          {total - order.length} to go
        </p>
      )}
      <SubmitButton
        busy={busy}
        disabled={order.length < total}
        onClick={() => void submit({ order })}
        editing={!!value}
      />
      <ErrorNote error={error} />
    </div>
  );
}
