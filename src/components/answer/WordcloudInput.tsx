import { useState } from 'react';
import type { WordcloudQuestion, WordcloudValue } from '../../../shared/types.ts';
import { ErrorNote, SubmitButton, useSubmit } from './common.tsx';

export default function WordcloudInput({
  question,
  value,
  onSubmit,
}: {
  question: WordcloudQuestion;
  value: WordcloudValue | null;
  onSubmit: (v: WordcloudValue) => Promise<void>;
}) {
  const max = question.maxWords ?? 3;
  const [words, setWords] = useState<string[]>(() => {
    const w = [...(value?.words ?? [])];
    while (w.length < max) w.push('');
    return w;
  });
  const { busy, error, submit } = useSubmit(onSubmit);
  const filled = words.filter((w) => w.trim());

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full flex-col gap-3 sm:max-w-md">
        {words.map((word, i) => (
          <input
            key={i}
            className="input-pop text-center font-display text-2xl font-bold"
            placeholder={['One word…', 'Another…', 'One more…', 'Keep going…', 'Last one…'][i] ?? 'Word…'}
            value={word}
            maxLength={24}
            autoFocus={i === 0}
            onChange={(e) =>
              setWords((old) => old.map((w, j) => (j === i ? e.target.value.replace(/\s+/g, ' ') : w)))
            }
          />
        ))}
      </div>
      <SubmitButton
        busy={busy}
        disabled={filled.length === 0}
        onClick={() => void submit({ words: filled })}
        editing={!!value}
      />
      <ErrorNote error={error} />
    </div>
  );
}
