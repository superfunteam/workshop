import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { DotvoteQuestion, DotvoteValue } from '../../../shared/types.ts';
import { dataColor } from '../bits.tsx';
import { BOUNCE, POP } from '../../lib/springs.ts';
import { ErrorNote, SubmitButton, useSubmit } from './common.tsx';

export default function DotvoteInput({
  question,
  value,
  onSubmit,
}: {
  question: DotvoteQuestion;
  value: DotvoteValue | null;
  onSubmit: (v: DotvoteValue) => Promise<void>;
}) {
  const budget = question.dots ?? 3;
  const [dots, setDots] = useState<number[]>(
    value?.dots && value.dots.length === question.options.length
      ? value.dots
      : question.options.map(() => 0),
  );
  const { busy, error, submit } = useSubmit(onSubmit);
  const spent = dots.reduce((s, n) => s + n, 0);
  const left = budget - spent;

  const bump = (i: number, delta: number) => {
    setDots((old) =>
      old.map((n, j) => (j === i ? Math.max(0, n + delta) : n)),
    );
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <motion.div layout transition={POP} className="chip bg-sun/50 text-base">
        {left === 0 ? 'All dots placed!' : `${left} dot${left === 1 ? '' : 's'} left`}{' '}
        <span className="tracking-widest" aria-hidden>
          <AnimatePresence mode="popLayout">
            {Array.from({ length: left }, (_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={BOUNCE}
                className="inline-block"
              >
                ●
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
      </motion.div>
      <div className="flex w-full flex-col gap-3">
        {question.options.map((option, i) => (
          <div key={i} className="card-pop flex items-center gap-3 px-4 py-3">
            <span className="h-4 w-4 shrink-0 rounded-full border border-line" style={{ background: dataColor(i) }} />
            <span className="flex-1 font-display text-lg font-semibold">{option}</span>
            <span className="min-w-20 text-right text-xl tracking-wider" aria-label={`${dots[i]} dots`}>
              {dots[i] === 0 ? (
                <span className="text-sm text-ink-faint">no dots</span>
              ) : (
                <AnimatePresence mode="popLayout">
                  {Array.from({ length: dots[i] }, (_, d) => (
                    <motion.span
                      key={d}
                      initial={{ scale: 0, y: -14 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0, transition: { duration: 0.1 } }}
                      transition={BOUNCE}
                      className="inline-block"
                      style={{ color: dataColor(i) }}
                    >
                      ●
                    </motion.span>
                  ))}
                </AnimatePresence>
              )}
            </span>
            <div className="flex gap-1.5">
              <motion.button whileTap={{ scale: 0.82 }} transition={POP} type="button" className="btn-pop h-10 w-10 p-0 text-xl" disabled={dots[i] === 0} onClick={() => bump(i, -1)} aria-label={`remove dot from ${option}`}>
                −
              </motion.button>
              <motion.button whileTap={{ scale: 0.82 }} transition={POP} type="button" className="btn-pop bg-sun h-10 w-10 p-0 text-xl" disabled={left === 0} onClick={() => bump(i, 1)} aria-label={`add dot to ${option}`}>
                +
              </motion.button>
            </div>
          </div>
        ))}
      </div>
      <SubmitButton busy={busy} disabled={spent === 0} onClick={() => void submit({ dots })} editing={!!value} />
      <ErrorNote error={error} />
    </div>
  );
}
