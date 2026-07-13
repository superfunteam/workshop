import { useState } from 'react';
import type { ChoiceQuestion, ChoiceValue } from '../../../shared/types.ts';
import { dataColor } from '../bits.tsx';
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
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const picked = picks.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={`card-pop cursor-pointer px-5 py-4 text-left font-display text-xl font-bold transition-all hover:-translate-y-0.5 ${
                picked ? 'text-white' : 'bg-white'
              }`}
              style={picked ? { background: dataColor(i) } : { borderLeft: `10px solid ${dataColor(i)}` }}
              aria-pressed={picked}
            >
              {picked && <span aria-hidden>✓ </span>}
              {option}
            </button>
          );
        })}
      </div>
      {question.multi && <p className="text-sm font-semibold text-ink-soft">Pick as many as you like</p>}
      <SubmitButton busy={busy} disabled={picks.length === 0} onClick={() => void submit({ picks })} editing={!!value} />
      <ErrorNote error={error} />
    </div>
  );
}
