import { useState } from 'react';
import type { DotvoteQuestion, DotvoteValue } from '../../../shared/types.ts';
import { dataColor } from '../bits.tsx';
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
      <div className="chip bg-sun/50 text-base">
        {left === 0 ? 'All dots placed!' : `${left} dot${left === 1 ? '' : 's'} left`}{' '}
        <span className="tracking-widest" aria-hidden>
          {'●'.repeat(left)}
          <span className="opacity-25">{'●'.repeat(spent)}</span>
        </span>
      </div>
      <div className="flex w-full flex-col gap-3">
        {question.options.map((option, i) => (
          <div key={i} className="card-pop flex items-center gap-3 px-4 py-3">
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-ink" style={{ background: dataColor(i) }} />
            <span className="flex-1 font-display text-lg font-bold">{option}</span>
            <span className="min-w-20 text-right text-xl tracking-wider" aria-label={`${dots[i]} dots`}>
              {dots[i] === 0 ? <span className="text-sm text-ink-faint">no dots</span> : '●'.repeat(dots[i])}
            </span>
            <div className="flex gap-1.5">
              <button type="button" className="btn-pop h-10 w-10 p-0 text-xl" disabled={dots[i] === 0} onClick={() => bump(i, -1)} aria-label={`remove dot from ${option}`}>
                −
              </button>
              <button type="button" className="btn-pop bg-sun h-10 w-10 p-0 text-xl" disabled={left === 0} onClick={() => bump(i, 1)} aria-label={`add dot to ${option}`}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <SubmitButton busy={busy} disabled={spent === 0} onClick={() => void submit({ dots })} editing={!!value} />
      <ErrorNote error={error} />
    </div>
  );
}
