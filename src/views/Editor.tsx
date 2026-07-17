// Author the workshop. Designed to be readable at a glance:
//   sticky header  →  name, save state, share links, open host view
//   the deck       →  numbered questions in section groups, controls on hover
//   expanded card  →  type banner, the essential fields, then "extras"
// Autosaves ~800ms after the last keystroke.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Question, QuestionType, Section, Snapshot } from '../../shared/types.ts';
import { rid } from '../../shared/codes.ts';
import { api } from '../lib/api.ts';
import { session } from '../lib/session.ts';
import { TYPE_META, TypeSwatch } from '../components/bits.tsx';
import Icon from '../components/Icon.tsx';

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

  const update = (fn: (d: Draft) => Draft) => setDraft((prev) => (prev ? fn(prev) : prev));

  const moveIn = <T,>(list: T[], i: number, delta: number): T[] => {
    const j = i + delta;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const totalQuestions = draft.sections.reduce((n, s) => n + s.questions.length, 0);
  // Running question number across the whole deck, matching the live "3 of 8".
  const numberBefore = (sIdx: number, qIdx: number) =>
    draft.sections.slice(0, sIdx).reduce((n, s) => n + s.questions.length, 0) + qIdx + 1;

  const addSection = (at?: number) =>
    update((d) => {
      const next = [...d.sections];
      next.splice(at ?? next.length, 0, { id: rid(8), title: `Section ${next.length + 1}`, questions: [] });
      return { ...d, sections: next };
    });

  return (
    <div className="min-h-dvh">
      {/* ---------- sticky header: everything you need, one glance ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-2.5">
          <Link to="/" className="btn-pop h-9 w-9 shrink-0 p-0" aria-label="home">
            <Icon name="arrow_back" size={17} />
          </Link>
          <input
            className="display-type min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-xl outline-none hover:bg-ink/[0.04] focus:bg-ink/[0.04]"
            value={draft.name}
            maxLength={120}
            aria-label="workshop name"
            onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          />
          <SaveBadge state={saveState} />
          <ShareMenu code={code} hostKey={hostKey} />
          <Link to={`/host/${code}`} className="btn-pop bg-ink text-white hover:bg-ink/90 shrink-0 px-3.5 py-1.5 text-sm">
            Open host view →
          </Link>
        </div>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 pb-2 text-xs font-semibold text-ink-soft">
          <span className="chip bg-ink/5 px-2 py-0.5 font-mono text-[11px] tracking-widest">{code}</span>
          <span>{draft.sections.length} sections · {totalQuestions} questions</span>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={draft.autoReveal}
              onChange={(e) => update((d) => ({ ...d, autoReveal: e.target.checked }))}
            />
            auto-reveal when everyone’s answered
          </label>
        </div>
      </header>

      {/* ---------- the deck ---------- */}
      <main className="mx-auto max-w-3xl px-5 pt-6 pb-16">
        {draft.sections.map((section, sIdx) => (
          <section key={section.id} className="group/section mb-2">
            {/* section header */}
            <div className="mb-2.5 flex items-end gap-2 pt-5">
              <div className="min-w-0 flex-1">
                <div className="px-2 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">
                  Section {sIdx + 1}
                </div>
                <input
                  className="display-type w-full min-w-0 rounded-lg bg-transparent px-2 py-0.5 text-2xl outline-none hover:bg-ink/[0.04] focus:bg-ink/[0.04]"
                  value={section.title}
                  maxLength={120}
                  aria-label={`section ${sIdx + 1} title`}
                  onChange={(e) =>
                    update((d) => ({
                      ...d,
                      sections: d.sections.map((s, i) => (i === sIdx ? { ...s, title: e.target.value } : s)),
                    }))
                  }
                />
              </div>
              <HoverControls
                onUp={sIdx > 0 ? () => update((d) => ({ ...d, sections: moveIn(d.sections, sIdx, -1) })) : undefined}
                onDown={sIdx < draft.sections.length - 1 ? () => update((d) => ({ ...d, sections: moveIn(d.sections, sIdx, 1) })) : undefined}
                onDelete={() => {
                  if (section.questions.length === 0 || confirm(`Delete “${section.title}” and its ${section.questions.length} questions?`)) {
                    update((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== sIdx) }));
                  }
                }}
                parentGroup="section"
              />
            </div>

            {/* questions */}
            <div className="flex flex-col gap-2">
              {section.questions.map((q, qIdx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  number={numberBefore(sIdx, qIdx)}
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

              <AddQuestion
                sectionTitle={section.title}
                onAdd={(type) =>
                  update((d) => ({
                    ...d,
                    sections: d.sections.map((s, i) =>
                      i === sIdx ? { ...s, questions: [...s.questions, blankQuestion(type)] } : s,
                    ),
                  }))
                }
              />
            </div>
          </section>
        ))}

        <button
          type="button"
          className="mt-6 w-full cursor-pointer rounded-xl border border-dashed border-ink-faint py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
          onClick={() => addSection()}
        >
          <Icon name="add" size={15} /> Add a section
        </button>

        <footer className="mt-14 flex items-center justify-between border-t border-line pt-5 text-sm">
          <button
            type="button"
            className="cursor-pointer font-semibold text-ink-soft underline-offset-2 hover:underline"
            onClick={() => {
              void api.duplicate(code, hostKey, `${draft.name} (copy)`).then((room) => {
                session.saveHostKey(room.code, room.hostKey);
                session.touchRecent({ code: room.code, name: `${draft.name} (copy)`, role: 'host' });
                nav(`/edit/${room.code}`);
              });
            }}
          >
            <Icon name="library_add" size={15} /> Duplicate as template
          </button>
          <button
            type="button"
            className="cursor-pointer font-semibold text-coral underline-offset-2 hover:underline"
            onClick={() => {
              if (confirm('Delete this room and ALL its data? This can’t be undone.')) {
                void api.deleteRoom(code, hostKey).then(() => {
                  session.forgetRecent(code);
                  nav('/');
                });
              }
            }}
          >
            <Icon name="delete" size={15} /> Delete room
          </button>
        </footer>
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">{children}</div>;
}

function SaveBadge({ state }: { state: 'saved' | 'saving' | 'dirty' | 'error' }) {
  const meta = {
    saved: { icon: 'cloud_done', text: 'Saved', cls: 'text-ink-soft' },
    saving: { icon: 'sync', text: 'Saving…', cls: 'text-ink-soft' },
    dirty: { icon: 'more_horiz', text: '', cls: 'text-ink-faint' },
    error: { icon: 'cloud_off', text: 'Not saved!', cls: 'text-coral' },
  }[state];
  return (
    <span className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${meta.cls}`} title="changes save automatically">
      <Icon name={meta.icon} size={15} /> <span className="max-sm:hidden">{meta.text}</span>
    </span>
  );
}

/** Join + host links behind one button — the header stays quiet. */
function ShareMenu({ code, hostKey }: { code: string; hostKey: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <div className="relative shrink-0" ref={ref}>
      <button type="button" className="btn-pop px-3.5 py-1.5 text-sm" onClick={() => setOpen(!open)}>
        <Icon name="ios_share" size={15} /> Share
      </button>
      {open && (
        <div className="card-pop absolute top-full right-0 z-40 mt-1.5 w-72 p-2">
          <ShareRow icon="link" title="Join link" hint="anyone in the room" value={`${location.origin}/${code}`} />
          <ShareRow icon="key" title="Host link" hint="keep this one private" value={`${location.origin}/host/${code}?key=${hostKey}`} />
        </div>
      )}
    </div>
  );
}

function ShareRow({ icon, title, hint, value }: { icon: string; title: string; hint: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-ink/[0.04]"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
    >
      <Icon name={copied ? 'check' : icon} size={17} className={copied ? 'text-mint' : 'text-ink-soft'} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{copied ? 'Copied!' : title}</span>
        <span className="block truncate text-xs font-medium text-ink-soft">{hint}</span>
      </span>
      <Icon name="content_copy" size={15} className="text-ink-faint" />
    </button>
  );
}

/** Row controls that stay out of the way until you hover the row. */
function HoverControls({
  onUp,
  onDown,
  onDelete,
  onDuplicate,
  parentGroup = 'row',
}: {
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  parentGroup?: 'row' | 'section';
}) {
  const reveal =
    parentGroup === 'section'
      ? 'opacity-0 group-hover/section:opacity-100 group-focus-within/section:opacity-100'
      : 'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100';
  const btn = 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-ink/[0.06] hover:text-ink disabled:opacity-30 disabled:cursor-default';
  return (
    <div className={`flex shrink-0 gap-0.5 transition-opacity max-md:opacity-100 ${reveal}`}>
      <button type="button" className={btn} disabled={!onUp} onClick={onUp} aria-label="move up"><Icon name="arrow_upward" size={16} /></button>
      <button type="button" className={btn} disabled={!onDown} onClick={onDown} aria-label="move down"><Icon name="arrow_downward" size={16} /></button>
      {onDuplicate && (
        <button type="button" className={btn} onClick={onDuplicate} aria-label="duplicate"><Icon name="content_copy" size={15} /></button>
      )}
      <button type="button" className={`${btn} hover:bg-coral/10 hover:text-coral`} onClick={onDelete} aria-label="delete"><Icon name="delete" size={16} /></button>
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

function AddQuestion({ sectionTitle, onAdd }: { sectionTitle: string; onAdd: (t: QuestionType) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        className="w-full cursor-pointer rounded-xl border border-dashed border-ink-faint py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
        onClick={() => setOpen(true)}
      >
        <Icon name="add" size={15} /> Add a question to “{sectionTitle}”
      </button>
    );
  }
  return (
    <div className="card-pop p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-ink-soft uppercase">Pick a question type</span>
        <button type="button" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-ink/[0.06]" onClick={() => setOpen(false)} aria-label="close">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(Object.keys(TYPE_META) as QuestionType[]).map((type) => (
          <button
            key={type}
            type="button"
            className="cursor-pointer rounded-xl border border-line bg-white p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-pop-sm"
            onClick={() => {
              onAdd(type);
              setOpen(false);
            }}
          >
            <TypeSwatch type={type} size={28} />
            <div className="mt-1.5 text-[13px] leading-tight font-semibold">{TYPE_META[type].label}</div>
            <div className="mt-0.5 text-[11px] leading-tight font-medium text-ink-soft">{TYPE_META[type].blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- per-question editing ----------

function QuestionCard({
  question,
  number,
  onChange,
  onUp,
  onDown,
  onDelete,
  onDuplicate,
}: {
  question: Question;
  number: number;
  onChange: (q: Question) => void;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(question.prompt === '');
  const meta = TYPE_META[question.type];
  const promptLabel = question.type === 'slide' ? 'Slide title' : question.type === 'discuss' ? 'What should the room talk about?' : 'Question';

  return (
    <div
      className="group/row overflow-hidden rounded-2xl border bg-white transition-shadow"
      style={{
        borderColor: open ? `${meta.hue}66` : 'var(--color-line)',
        boxShadow: open ? `0 8px 24px -10px ${meta.hue}55` : undefined,
      }}
    >
      {/* collapsed row — the whole thing is a click target */}
      <div
        className="flex cursor-pointer items-center gap-2.5 p-2.5 select-none"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-ink-faint">{number}</span>
        <TypeSwatch type={question.type} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {question.prompt || <span className="text-ink-faint italic">untitled — click to write it</span>}
          </span>
          <span className="block text-[11px] font-semibold tracking-wide uppercase" style={{ color: meta.hue }}>
            {meta.label}
          </span>
        </span>
        {question.anonymous && <Icon name="visibility_off" size={15} className="shrink-0 text-ink-faint" />}
        {question.notes && <Icon name="description" size={15} className="shrink-0 text-ink-faint" />}
        <span onClick={(e) => e.stopPropagation()}>
          <HoverControls onUp={onUp} onDown={onDown} onDelete={onDelete} onDuplicate={onDuplicate} />
        </span>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={20} className="shrink-0 text-ink-soft" />
      </div>

      {open && (
        <div className="flex flex-col gap-3 px-3 pt-0 pb-4">
          <div className="flex items-center gap-3 rounded-xl px-3.5 py-2" style={{ background: meta.tint }}>
            <Icon name={meta.icon} size={20} style={{ color: meta.hue }} />
            <span className="text-sm font-semibold" style={{ color: meta.hue }}>
              {meta.label}
            </span>
            <span className="text-xs font-medium text-ink-soft">{meta.blurb}</span>
          </div>

          <Field label={promptLabel}>
            <input className="input-pop w-full text-lg" value={question.prompt} maxLength={300} placeholder="Ask the room something…" autoFocus={!question.prompt}
              onChange={(e) => onChange({ ...question, prompt: e.target.value })} />
          </Field>

          <TypeFields question={question} onChange={onChange} />

          {/* the optional stuff, visually secondary so the essentials pop */}
          <div className="rounded-xl bg-paper p-3">
            <div className="mb-2 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">Extras</div>
            <div className="flex flex-col gap-3">
              <Field label="Hint — small line under the question (optional)">
                <input className="input-pop w-full bg-white" value={question.hint ?? ''} maxLength={200}
                  onChange={(e) => onChange({ ...question, hint: e.target.value || undefined })} />
              </Field>
              <Field label="Presenter notes — only you see these, in the host dock">
                <textarea className="input-pop min-h-16 w-full bg-white text-base" value={question.notes ?? ''} maxLength={2000}
                  onChange={(e) => onChange({ ...question, notes: e.target.value || undefined })} />
              </Field>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft">
                <input type="checkbox" checked={!!question.anonymous}
                  onChange={(e) => onChange({ ...question, anonymous: e.target.checked || undefined })} />
                <Icon name="visibility_off" size={15} /> Anonymous — hide names on the reveal
              </label>
            </div>
          </div>

          <button type="button" className="btn-pop self-end px-4 py-1 text-sm" onClick={() => setOpen(false)}>
            <Icon name="check" size={15} /> Done
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</span>
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
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft">
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
