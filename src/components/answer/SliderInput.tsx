import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SliderQuestion, SliderValue } from '../../../shared/types.ts';
import { POP } from '../../lib/springs.ts';
import { ErrorNote, SubmitButton, useSubmit } from './common.tsx';

function SliderCaption({ n, left, right, touched }: { n: number; left: string; right: string; touched: boolean }) {
  const caption =
    n < 15 ? `very ${left}` : n < 40 ? `leaning ${left}` : n <= 60 ? 'right in the middle' : n <= 85 ? `leaning ${right}` : `very ${right}`;
  return (
    <div className="mt-2 h-9 text-center font-hand text-2xl text-ink-soft" style={{ opacity: touched ? 1 : 0.4 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={caption}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.08 } }}
          transition={POP}
        >
          {caption}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

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
        <SliderCaption n={n} left={question.left} right={question.right} touched={touched} />
      </div>
      <SubmitButton busy={busy} disabled={!touched} onClick={() => void submit({ value: n })} editing={!!value} />
      <ErrorNote error={error} />
    </div>
  );
}
