import { useState } from 'react';
import type { SliderQuestion, SliderValue } from '../../../shared/types.ts';
import { ErrorNote, SubmitButton, useSubmit } from './common.tsx';

export default function SliderInput({
  question,
  value,
  onSubmit,
}: {
  question: SliderQuestion;
  value: SliderValue | null;
  onSubmit: (v: SliderValue) => Promise<void>;
}) {
  const [n, setN] = useState(value?.value ?? 50);
  const [touched, setTouched] = useState(!!value);
  const { busy, error, submit } = useSubmit(onSubmit);

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="w-full">
        <div className="mb-3 flex justify-between font-display text-xl font-bold sm:text-2xl">
          <span className="max-w-[45%] text-left">← {question.left}</span>
          <span className="max-w-[45%] text-right">{question.right} →</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={n}
          onChange={(e) => {
            setN(Number(e.target.value));
            setTouched(true);
          }}
          className="slider-fat w-full"
          aria-label={`${question.left} to ${question.right}`}
        />
        <div
          className="mt-2 text-center font-hand text-2xl text-ink-soft transition-opacity"
          style={{ opacity: touched ? 1 : 0.4 }}
        >
          {n < 15 ? `very ${question.left}` : n < 40 ? `leaning ${question.left}` : n <= 60 ? 'right in the middle' : n <= 85 ? `leaning ${question.right}` : `very ${question.right}`}
        </div>
      </div>
      <SubmitButton busy={busy} disabled={!touched} onClick={() => void submit({ value: n })} editing={!!value} />
      <ErrorNote error={error} />
    </div>
  );
}
