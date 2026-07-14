import { useState } from 'react';
import { motion } from 'motion/react';
import type { ChoiceQuestion, ChoiceValue } from '../../../shared/types.ts';
import { dataColor } from '../bits.tsx';
import { BOUNCE, POP, popChild, staggerParent } from '../../lib/springs.ts';
import { ErrorNote, SubmitButton, useSubmit } from './common.tsx';

export default function ChoiceInput({
  question,
  value,
  onSubmit,
}: {
  question: ChoiceQuestion;
  value: ChoiceValue | null;
  onSubmit: (v: ChoiceValue) => Promise<void>;
}) {
  const [picks, setPicks] = useState<number[]>(value?.picks ?? []);
  const { busy, error, submit } = useSubmit(onSubmit);

  const toggle = (i: number) => {
    setPicks((old) =>
      question.multi
        ? old.includes(i)
          ? old.filter((x) => x !== i)
          : [...old, i]
        : [i],
    );
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div variants={staggerParent(0.05)} initial="hidden" animate="show" className="grid w-full gap-3 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const picked = picks.includes(i);
          return (
            <motion.button
              key={i}
              variants={popChild}
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.96 }}
              transition={POP}
              type="button"
              onClick={() => toggle(i)}
              className={`card-pop cursor-pointer px-5 py-4 text-left font-display text-xl font-semibold ${
                picked ? 'text-white' : 'bg-white'
              }`}
              style={picked ? { background: dataColor(i) } : { borderLeft: `10px solid ${dataColor(i)}` }}
              aria-pressed={picked}
            >
              {picked && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={BOUNCE} className="inline-block" aria-hidden>
                  ✓{' '}
                </motion.span>
              )}
              {option}
            </motion.button>
          );
        })}
      </motion.div>
      {question.multi && <p className="text-sm font-semibold text-ink-soft">Pick as many as you like</p>}
      <SubmitButton busy={busy} disabled={picks.length === 0} onClick={() => void submit({ picks })} editing={!!value} />
      <ErrorNote error={error} />
    </div>
  );
}
