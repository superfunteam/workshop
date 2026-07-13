// Multi-item board: every note you add saves instantly (the host watches the
// wall fill up live). Notes are DRAGGABLE — drop one on another column and it
// re-categorizes with a spring. No waiting screen for this type; keep adding.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import type { PostitNote, PostitsQuestion, PostitsValue } from '../../../shared/types.ts';
import { rid } from '../../../shared/codes.ts';
import { noteColor, tiltFor } from '../bits.tsx';
import { BOUNCE, SHIFT } from '../../lib/springs.ts';

const tiltDeg = (id: string): number => Number.parseFloat(tiltFor(id));

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
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);

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
    setDrafts((old) => old.map((d, i) => (i === category ? '' : d)));
    void save([...latest.current, { id: rid(8), category, text }]);
  };

  const remove = (id: string) => void save(latest.current.filter((n) => n.id !== id));

  const recategorize = (id: string, category: number) =>
    void save(latest.current.map((n) => (n.id === id ? { ...n, category } : n)));

  /** Which column contains a point (note midpoint while dragging). */
  const columnAt = (x: number, y: number): number | null => {
    for (let i = 0; i < question.categories.length; i++) {
      const rect = columnRefs.current[i]?.getBoundingClientRect();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return i;
    }
    return null;
  };

  // Where each note currently hovers, tracked live during the drag — dropping
  // goes by where the NOTE is, not where the finger lifted.
  const hoverColumn = useRef<Map<string, number | null>>(new Map());

  const trackNote = (id: string, el: HTMLElement | null) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    hoverColumn.current.set(id, columnAt(rect.x + rect.width / 2, rect.y + rect.height / 2));
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold text-ink-soft">
        <span className="font-semibold text-base">psst — you can drag notes between columns</span>
        <span>
          {failed ? (
            <button type="button" className="text-coral underline" onClick={() => void save(latest.current)}>
              couldn’t save — retry
            </button>
          ) : saving ? (
            'saving…'
          ) : notes.length > 0 ? (
            'saved ✓'
          ) : null}
        </span>
      </div>
      <LayoutGroup>
        <div
          className="grid w-full gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(question.categories.length, 3)}, minmax(0, 1fr))` }}
        >
          {question.categories.map((category, ci) => (
            <div
              key={ci}
              ref={(el) => {
                columnRefs.current[ci] = el;
              }}
              className="card-pop flex min-h-64 flex-col gap-3 p-4"
              style={{ background: `${noteColor(ci)}33` }}
            >
              <h3 className="display-type text-xl">{category}</h3>
              <div className="flex flex-1 flex-col gap-3">
                <AnimatePresence mode="popLayout">
                  {notes
                    .filter((n) => n.category === ci)
                    .map((n) => (
                      <motion.div
                        key={n.id}
                        layout
                        layoutId={n.id}
                        drag
                        dragSnapToOrigin
                        dragElastic={0.5}
                        whileDrag={{ scale: 1.08, rotate: 0, zIndex: 60, cursor: 'grabbing' }}
                        whileHover={{ scale: 1.04, rotate: 0 }}
                        onDrag={(event) => trackNote(n.id, event.target as HTMLElement)}
                        onDragEnd={(event) => {
                          trackNote(n.id, event.target as HTMLElement);
                          const target = hoverColumn.current.get(n.id);
                          hoverColumn.current.delete(n.id);
                          if (target !== null && target !== undefined && target !== n.category) {
                            recategorize(n.id, target);
                          }
                        }}
                        initial={{ scale: 0.4, rotate: -10, opacity: 0 }}
                        animate={{ scale: 1, rotate: tiltDeg(n.id), opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12 } }}
                        transition={BOUNCE}
                        className="sticky-note group cursor-grab"
                        style={{ background: noteColor(ci) }}
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
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <input
                  className="input-pop min-w-0 flex-1 bg-white/80 text-sm"
                  placeholder="Add a note…"
                  value={drafts[ci]}
                  maxLength={280}
                  onChange={(e) => setDrafts((old) => old.map((d, i) => (i === ci ? e.target.value : d)))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') add(ci);
                  }}
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  transition={SHIFT}
                  type="button"
                  className="btn-pop px-3 py-1 text-sm"
                  disabled={!drafts[ci].trim()}
                  onClick={() => add(ci)}
                >
                  +
                </motion.button>
              </div>
            </div>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
