// Multi-item board: every note you add saves instantly (the host watches the
// wall fill up live). No "waiting" screen for this type — keep adding.

import { useEffect, useRef, useState } from 'react';
import type { PostitNote, PostitsQuestion, PostitsValue } from '../../../shared/types.ts';
import { rid } from '../../../shared/codes.ts';
import { noteColor, tiltFor } from '../bits.tsx';

export default function PostitsInput({
  question,
  value,
  onSubmit,
}: {
  question: PostitsQuestion;
  value: PostitsValue | null;
  onSubmit: (v: PostitsValue) => Promise<void>;
}) {
  const [notes, setNotes] = useState<PostitNote[]>(value?.notes ?? []);
  const [drafts, setDrafts] = useState<string[]>(question.categories.map(() => ''));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(notes);
  latest.current = notes;

  // Refresh from the server copy if it has more than we do (another tab, refresh).
  useEffect(() => {
    if (value && value.notes.length > latest.current.length) setNotes(value.notes);
  }, [value]);

  const save = async (next: PostitNote[]) => {
    setNotes(next);
    setSaving(true);
    setFailed(false);
    try {
      await onSubmit({ notes: next });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const add = (category: number) => {
    const text = drafts[category].trim();
    if (!text) return;
    setDrafts(drafts.map((d, i) => (i === category ? '' : d)));
    void save([...notes, { id: rid(8), category, text }]);
  };

  const remove = (id: string) => void save(notes.filter((n) => n.id !== id));

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-end gap-2 text-sm font-semibold text-ink-soft">
        {failed ? (
          <button type="button" className="text-coral underline" onClick={() => void save(notes)}>
            couldn’t save — retry
          </button>
        ) : saving ? (
          'saving…'
        ) : notes.length > 0 ? (
          'saved ✓'
        ) : null}
      </div>
      <div className="grid w-full gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(question.categories.length, 3)}, minmax(0, 1fr))` }}>
        {question.categories.map((category, ci) => (
          <div key={ci} className="card-pop flex min-h-64 flex-col gap-3 p-4" style={{ background: `${noteColor(ci)}33` }}>
            <h3 className="display-type text-xl">{category}</h3>
            <div className="flex flex-1 flex-col gap-3">
              {notes
                .filter((n) => n.category === ci)
                .map((n) => (
                  <div
                    key={n.id}
                    className="sticky-note group"
                    style={{ background: noteColor(ci), ['--tilt' as string]: tiltFor(n.id) }}
                  >
                    {n.text}
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      className="absolute -top-2 -right-2 hidden h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-white font-sans text-xs group-hover:flex"
                      aria-label="remove note"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input-pop min-w-0 flex-1 bg-white/80 text-sm"
                placeholder="Add a note…"
                value={drafts[ci]}
                maxLength={280}
                onChange={(e) => setDrafts(drafts.map((d, i) => (i === ci ? e.target.value : d)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add(ci);
                }}
              />
              <button type="button" className="btn-pop px-3 py-1 text-sm" disabled={!drafts[ci].trim()} onClick={() => add(ci)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
