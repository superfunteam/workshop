// Author the workshop: sections, questions, presenter notes. Autosaves.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Question, QuestionType, Section, Snapshot } from '../../shared/types.ts';
import { rid } from '../../shared/codes.ts';
import { api } from '../lib/api.ts';
import { session } from '../lib/session.ts';
import { TYPE_META } from '../components/bits.tsx';

interface Draft {
  name: string;
  sections: Section[];
  autoReveal: boolean;
}

export default function Editor({ code }: { code: string }) {
  const nav = useNavigate();
  const hostKey = session.hostKey(code);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [missing, setMissing] = useState(false);
  const hydrating = useRef(true);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!hostKey) return;
    fetch(`/api/rooms/${code}/sync?once=1&key=${encodeURIComponent(hostKey)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const snap = (await r.json()) as Snapshot;
        if (!snap.isHost) {
          setMissing(true);
          return;
        }
        hydrating.current = true;
        setDraft({ name: snap.config.name, sections: snap.config.sections, autoReveal: snap.config.settings.autoReveal });
        session.touchRecent({ code, name: snap.config.name, role: 'host' });
      })
      .catch(() => setMissing(true));
  }, [code, hostKey]);

  // Debounced autosave: any draft change (except the initial load) saves ~800ms
  // after the last keystroke.
  useEffect(() => {
    if (!draft) return;
    if (hydrating.current) {
      hydrating.current = false;
      return;
    }
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const snapshot = draft;
    saveTimer.current = window.setTimeout(() => {
      setSaveState('saving');
      api
        .saveConfig(code, hostKey ?? '', {
          name: snapshot.name,
          sections: snapshot.sections,
          settings: { autoReveal: snapshot.autoReveal },
        })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, code, hostKey]);

  if (!hostKey) {
    return (
      <Centered>
        <div className="text-6xl">🗝️</div>
        <h1 className="display-type text-3xl">Only the host can edit {code}</h1>
        <Link to={`/host/${code}`} className="btn-pop">Enter host key →</Link>
      </Centered>
    );
  }
  if (missing) {
    return (
      <Centered>
        <div className="text-6xl">🫥</div>
        <h1 className="display-type text-3xl">Can’t open the editor for “{code}”</h1>
        <p className="font-semibold text-ink-soft">The room may not exist, or this device holds the wrong host key.</p>
        <Link to="/" className="btn-pop">← Home</Link>
      </Centered>
    );
  }
  if (!draft) {
    return (
      <Centered>
        <div className="thinking-dots"><span /><span /><span /></div>
      </Centered>
    );
  }

  const joinUrl = `${location.origin}/${code}`;
  const hostUrl = `${location.origin}/host/${code}?key=${hostKey}`;

  const update = (fn: (d: Draft) => Draft) => setDraft((prev) => (prev ? fn(prev) : prev));

  const moveIn = <T,>(list: T[], i: number, delta: number): T[] => {
    const j = i + delta;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/" className="btn-pop px-3 py-1 text-sm">← Home</Link>
          <span className="chip bg-sun/50 font-mono tracking-widest">{code}</span>
          <span className={`text-sm font-bold ${saveState === 'error' ? 'text-coral' : 'text-ink-soft'}`}>
            {saveState === 'saved' && 'saved ✓'}
            {saveState === 'saving' && 'saving…'}
            {saveState === 'dirty' && '…'}
            {saveState === 'error' && 'couldn’t save — check connection'}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <CopyButton label="🔗 Join link" value={joinUrl} />
            <CopyButton label="🗝️ Host link" value={hostUrl} />
            <Link to={`/host/${code}`} className="btn-pop bg-sun px-3 py-1 text-sm">Open host view →</Link>
          </div>
        </div>
        <input
          className="input-pop display-type w-full text-3xl"
          value={draft.name}
          maxLength={120}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
        />
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-ink-soft">
          <input
            type="checkbox"
            checked={draft.autoReveal}
            onChange={(e) => update((d) => ({ ...d, autoReveal: e.target.checked }))}
          />
          Auto-reveal results the moment everyone has answered
        </label>
      </header>

      <div className="flex flex-col gap-8">
        {draft.sections.map((section, sIdx) => (
          <section key={section.id} className="card-pop p-5">
            <div className="mb-4 flex items-center gap-2">
              <input
                className="input-pop display-type min-w-0 flex-1 text-xl"
                value={section.title}
                maxLength={120}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    sections: d.sections.map((s, i) => (i === sIdx ? { ...s, title: e.target.value } : s)),
                  }))
                }
              />
              <RowButtons
                onUp={sIdx > 0 ? () => update((d) => ({ ...d, sections: moveIn(d.sections, sIdx, -1) })) : undefined}
                onDown={sIdx < draft.sections.length - 1 ? () => update((d) => ({ ...d, sections: moveIn(d.sections, sIdx, 1) })) : undefined}
                onDelete={() => {
                  if (section.questions.length === 0 || confirm(`Delete “${section.title}” and its ${section.questions.length} questions?`)) {
                    update((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== sIdx) }));
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-3">
              {section.questions.map((q, qIdx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onChange={(next) =>
                    update((d) => ({
                      ...d,
                      sections: d.sections.map((s, i) =>
                        i === sIdx ? { ...s, questions: s.questions.map((x, j) => (j === qIdx ? next : x)) } : s,
                      ),
                    }))
                  }
                  onUp={qIdx > 0 ? () => update((d) => ({ ...d, sections: d.sections.map((s, i) => (i === sIdx ? { ...s, questions: moveIn(s.questions, qIdx, -1) } : s)) })) : undefined}
                  onDown={qIdx < section.questions.length - 1 ? () => update((d) => ({ ...d, sections: d.sections.map((s, i) => (i === sIdx ? { ...s, questions: moveIn(s.questions, qIdx, 1) } : s)) })) : undefined}
                  onDelete={() => update((d) => ({ ...d, sections: d.sections.map((s, i) => (i === sIdx ? { ...s, questions: s.questions.filter((_, j) => j !== qIdx) } : s)) }))}
                  onDuplicate={() =>
                    update((d) => ({
                      ...d,
                      sections: d.sections.map((s, i) =>
                        i === sIdx
                          ? { ...s, questions: [...s.questions.slice(0, qIdx + 1), { ...q, id: rid(8) }, ...s.questions.slice(qIdx + 1)] }
                          : s,
                      ),
                    }))
                  }
                />
              ))}
            </div>

            <AddQuestion
              onAdd={(type) =>
                update((d) => ({
                  ...d,
                  sections: d.sections.map((s, i) =>
                    i === sIdx ? { ...s, questions: [...s.questions, blankQuestion(type)] } : s,
                  ),
                }))
              }
            />
          </section>
        ))}
      </div>

      <button
        type="button"
        className="btn-pop mt-6 w-full border-dashed py-3"
        onClick={() => update((d) => ({ ...d, sections: [...d.sections, { id: rid(8), title: `Section ${d.sections.length + 1}`, questions: [] }] }))}
      >
        + Add a section
      </button>

      <footer className="mt-12 flex items-center justify-between border-t-2 border-dashed border-ink-faint pt-6">
        <button
          type="button"
          className="btn-pop text-sm"
          onClick={() => {
            void api.duplicate(code, hostKey, `${draft.name} (copy)`).then((room) => {
              session.saveHostKey(room.code, room.hostKey);
              session.touchRecent({ code: room.code, name: `${draft.name} (copy)`, role: 'host' });
              nav(`/edit/${room.code}`);
            });
          }}
        >
          🧬 Duplicate room
        </button>
        <button
          type="button"
          className="btn-pop bg-coral text-sm text-white"
          onClick={() => {
            if (confirm('Delete this room and ALL its data? This can’t be undone.')) {
              void api.deleteRoom(code, hostKey).then(() => {
                session.forgetRecent(code);
                nav('/');
              });
            }
          }}
        >
          🗑 Delete room
        </button>
      </footer>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">{children}</div>;
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-pop px-3 py-1 text-sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

function RowButtons({ onUp, onDown, onDelete, onDuplicate }: { onUp?: () => void; onDown?: () => void; onDelete: () => void; onDuplicate?: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" className="btn-pop h-8 w-8 p-0 text-xs" disabled={!onUp} onClick={onUp} aria-label="move up">↑</button>
      <button type="button" className="btn-pop h-8 w-8 p-0 text-xs" disabled={!onDown} onClick={onDown} aria-label="move down">↓</button>
      {onDuplicate && (
        <button type="button" className="btn-pop h-8 w-8 p-0 text-xs" onClick={onDuplicate} aria-label="duplicate">⧉</button>
      )}
      <button type="button" className="btn-pop h-8 w-8 p-0 text-xs hover:bg-coral hover:text-white" onClick={onDelete} aria-label="delete">✕</button>
    </div>
  );
}

function blankQuestion(type: QuestionType): Question {
  const base = { id: rid(8), prompt: '' };
  switch (type) {
    case 'choice':
      return { ...base, type, options: ['Option one', 'Option two'] };
    case 'open':
      return { ...base, type };
    case 'postits':
      return { ...base, type, categories: ['Good', 'Bad'] };
    case 'slider':
      return { ...base, type, left: 'One way', right: 'The other' };
    case 'inspo':
      return { ...base, type };
    case 'wordcloud':
      return { ...base, type, maxWords: 3 };
    case 'dotvote':
      return { ...base, type, options: ['Option one', 'Option two', 'Option three'], dots: 3 };
    case 'rank':
      return { ...base, type, options: ['Option one', 'Option two', 'Option three'] };
    case 'slide':
      return { ...base, type, emoji: '✨' };
    case 'discuss':
      return { ...base, type };
  }
}

function AddQuestion({ onAdd }: { onAdd: (t: QuestionType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      {!open ? (
        <button type="button" className="btn-pop border-dashed text-sm" onClick={() => setOpen(true)}>
          + Add a question
        </button>
      ) : (
        <div className="card-pop grid grid-cols-2 gap-2 bg-paper p-3 sm:grid-cols-4">
          {(Object.keys(TYPE_META) as QuestionType[]).map((type) => (
            <button
              key={type}
              type="button"
              className="cursor-pointer rounded-xl border-2 border-ink bg-white p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-pop-sm"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
            >
              <div className="text-xl">{TYPE_META[type].emoji}</div>
              <div className="font-display text-sm font-bold">{TYPE_META[type].label}</div>
              <div className="text-[11px] font-semibold text-ink-soft">{TYPE_META[type].blurb}</div>
            </button>
          ))}
          <button type="button" className="col-span-2 text-xs font-bold text-ink-soft underline sm:col-span-4" onClick={() => setOpen(false)}>
            never mind
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- per-question editing ----------

function QuestionCard({
  question,
  onChange,
  onUp,
  onDown,
  onDelete,
  onDuplicate,
}: {
  question: Question;
  onChange: (q: Question) => void;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(question.prompt === '');
  const meta = TYPE_META[question.type];

  return (
    <div className="rounded-2xl border-2 border-ink bg-white">
      <div className="flex items-center gap-2 p-3">
        <span title={meta.label}>{meta.emoji}</span>
        <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left font-semibold" onClick={() => setOpen(!open)}>
          {question.prompt || <span className="text-ink-faint italic">untitled — click to write the prompt</span>}
        </button>
        {question.anonymous && <span title="anonymous">🕶</span>}
        {question.notes && <span title="has presenter notes">📋</span>}
        <button type="button" className="btn-pop h-8 px-2.5 py-0 text-xs" onClick={() => setOpen(!open)}>
          {open ? 'done' : 'edit'}
        </button>
        <RowButtons onUp={onUp} onDown={onDown} onDelete={onDelete} onDuplicate={onDuplicate} />
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t-2 border-dashed border-line px-3 pt-3 pb-4">
          <Field label="Question">
            <input className="input-pop w-full text-lg" value={question.prompt} maxLength={300} placeholder="Ask the room something…" autoFocus={!question.prompt}
              onChange={(e) => onChange({ ...question, prompt: e.target.value })} />
          </Field>
          <Field label="Hint (optional, shows under the question)">
            <input className="input-pop w-full" value={question.hint ?? ''} maxLength={200}
              onChange={(e) => onChange({ ...question, hint: e.target.value || undefined })} />
          </Field>

          <TypeFields question={question} onChange={onChange} />

          <Field label="Presenter notes (only you see these, in the host dock)">
            <textarea className="input-pop min-h-16 w-full font-hand text-xl" value={question.notes ?? ''} maxLength={2000}
              onChange={(e) => onChange({ ...question, notes: e.target.value || undefined })} />
          </Field>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-ink-soft">
            <input type="checkbox" checked={!!question.anonymous}
              onChange={(e) => onChange({ ...question, anonymous: e.target.checked || undefined })} />
            🕶 Anonymous — hide names on the reveal
          </label>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">{label}</span>
      {children}
    </label>
  );
}

function LinesEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  // One option per line — the least fussy list editor there is.
  const [text, setText] = useState(values.join('\n'));
  useEffect(() => setText(values.join('\n')), [values]);
  return (
    <Field label={`${label} — one per line`}>
      <textarea
        className="input-pop min-h-24 w-full"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.split('\n').map((l) => l.trim()).filter(Boolean))}
      />
    </Field>
  );
}

function TypeFields({ question, onChange }: { question: Question; onChange: (q: Question) => void }) {
  switch (question.type) {
    case 'choice':
      return (
        <>
          <LinesEditor label="Options" values={question.options} onChange={(options) => onChange({ ...question, options })} />
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-ink-soft">
            <input type="checkbox" checked={!!question.multi} onChange={(e) => onChange({ ...question, multi: e.target.checked || undefined })} />
            Allow picking more than one
          </label>
        </>
      );
    case 'postits':
      return <LinesEditor label="Categories" values={question.categories} onChange={(categories) => onChange({ ...question, categories })} placeholder={'Good\nBad'} />;
    case 'slider':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Left pole"><input className="input-pop" value={question.left} maxLength={120} onChange={(e) => onChange({ ...question, left: e.target.value })} /></Field>
          <Field label="Right pole"><input className="input-pop" value={question.right} maxLength={120} onChange={(e) => onChange({ ...question, right: e.target.value })} /></Field>
        </div>
      );
    case 'wordcloud':
      return (
        <Field label="Words per person (1–5)">
          <input type="number" className="input-pop w-24" min={1} max={5} value={question.maxWords ?? 3}
            onChange={(e) => onChange({ ...question, maxWords: Math.min(5, Math.max(1, Number(e.target.value) || 3)) })} />
        </Field>
      );
    case 'dotvote':
      return (
        <>
          <LinesEditor label="Options" values={question.options} onChange={(options) => onChange({ ...question, options })} />
          <Field label="Dots per person (1–10)">
            <input type="number" className="input-pop w-24" min={1} max={10} value={question.dots ?? 3}
              onChange={(e) => onChange({ ...question, dots: Math.min(10, Math.max(1, Number(e.target.value) || 3)) })} />
          </Field>
        </>
      );
    case 'rank':
      return <LinesEditor label="Things to rank" values={question.options} onChange={(options) => onChange({ ...question, options })} />;
    case 'open':
      return (
        <Field label="Placeholder (optional)">
          <input className="input-pop w-full" value={question.placeholder ?? ''} maxLength={120}
            onChange={(e) => onChange({ ...question, placeholder: e.target.value || undefined })} />
        </Field>
      );
    case 'slide':
      return (
        <>
          <Field label="Big emoji (optional)">
            <input className="input-pop w-24 text-center text-2xl" value={question.emoji ?? ''} maxLength={4}
              onChange={(e) => onChange({ ...question, emoji: e.target.value || undefined })} />
          </Field>
          <Field label="Body copy (under the title)">
            <textarea className="input-pop min-h-20 w-full" value={question.body ?? ''} maxLength={2000}
              onChange={(e) => onChange({ ...question, body: e.target.value || undefined })} />
          </Field>
        </>
      );
    case 'discuss':
    case 'inspo':
      return null;
  }
}
