import { useState } from 'react';
import type { OpenQuestion, OpenValue } from '../../../shared/types.ts';
import { ErrorNote, SubmitButton, useSubmit } from './common.tsx';

export default function OpenInput({
  question,
  value,
  onSubmit,
}: {
  question: OpenQuestion;
  value: OpenValue | null;
  onSubmit: (v: OpenValue) => Promise<void>;
}) {
  const [text, setText] = useState(value?.text ?? '');
  const { busy, error, submit } = useSubmit(onSubmit);
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <textarea
        className="input-pop min-h-40 w-full text-xl leading-relaxed"
        placeholder={question.placeholder || 'Say it how you’d say it out loud…'}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <SubmitButton busy={busy} disabled={!text.trim()} onClick={() => void submit({ text })} editing={!!value} />
      <ErrorNote error={error} />
    </div>
  );
}
