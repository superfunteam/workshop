// Tap-to-rank: tap options in your priority order; tap again to un-rank.
// Deliberately not drag-and-drop — tapping is faster and works on every device.

import { useState } from 'react';
import type { RankQuestion, RankValue } from '../../../shared/types.ts';
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
      <p className="font-hand text-2xl text-ink-soft">Tap in order — most important first</p>
      <div className="flex w-full flex-col gap-3">
        {question.options.map((option, i) => {
          const pos = order.indexOf(i);
          const ranked = pos >= 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              className={`card-pop flex cursor-pointer items-center gap-4 px-4 py-3 text-left transition-all hover:-translate-y-0.5 ${
                ranked ? 'bg-note-mint' : 'bg-white'
              }`}
              aria-pressed={ranked}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink font-display text-xl font-extrabold ${
                  ranked ? 'bg-ink text-white' : 'bg-white text-ink-faint'
                }`}
              >
                {ranked ? pos + 1 : '·'}
              </span>
              <span className="font-display text-lg font-bold">{option}</span>
              {ranked && <span className="ml-auto text-sm font-semibold text-ink-soft">tap to remove</span>}
            </button>
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
