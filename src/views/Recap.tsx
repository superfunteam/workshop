// The permanent record: every question, every answer, forever — plus exports.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Snapshot } from '../../shared/types.ts';
import { flatQuestions } from '../../shared/flow.ts';
import { summarize } from '../../shared/aggregate.ts';
import { api } from '../lib/api.ts';
import { session } from '../lib/session.ts';
import ResultsView from '../components/results/index.tsx';
import SmartSummary from '../components/SmartSummary.tsx';
import { TypeBadge } from '../components/bits.tsx';
import Icon from '../components/Icon.tsx';

export default function RecapView({ code }: { code: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState<'recap' | 'summary'>('recap');
  const hostKey = session.hostKey(code);

  useEffect(() => {
    const params = new URLSearchParams({ full: '1' });
    if (hostKey) params.set('key', hostKey);
    fetch(`/api/rooms/${code}/sync?${params}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setSnap((await r.json()) as Snapshot);
      })
      .catch(() => setMissing(true));
  }, [code, hostKey]);

  if (missing) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <div className="text-6xl">🫥</div>
        <h1 className="display-type text-3xl">No room at “{code}”</h1>
        <Link to="/" className="btn-pop">← Home</Link>
      </div>
    );
  }
  if (!snap) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="thinking-dots"><span /><span /><span /></div>
      </div>
    );
  }

  const flat = flatQuestions(snap.config);
  const people = snap.participants;
  const totalAnswers = Object.values(snap.answers).reduce((s, a) => s + a.answeredPids.length, 0);
  const emoteCounts = new Map<string, number>();
  for (const e of snap.events) emoteCounts.set(e.emoji, (emoteCounts.get(e.emoji) ?? 0) + 1);

  const duplicate = async () => {
    if (!hostKey) return;
    const name = prompt('Name the new workshop:', `${snap.config.name} — next client`);
    if (name === null) return;
    const room = await api.duplicate(code, hostKey, name);
    session.saveHostKey(room.code, room.hostKey);
    session.touchRecent({ code: room.code, name: name || snap.config.name, role: 'host' });
    location.href = `/edit/${room.code}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-10 text-center">
        <p className="font-semibold text-xl text-ink-soft">the full recap of</p>
        <h1 className="display-type text-5xl sm:text-6xl">{snap.config.name}</h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          {new Date(snap.config.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })} · room {code}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <DownloadMenu code={code} />
          {hostKey && (
            <button type="button" className="btn-pop" onClick={() => void duplicate()}>
              <Icon name="library_add" size={16} /> Duplicate as template
            </button>
          )}
        </div>

        {/* view toggle — the full recap is the default */}
        <div className="mt-6 inline-flex rounded-full border border-line bg-white p-1 shadow-pop-sm">
          <button
            type="button"
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${view === 'recap' ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}
            onClick={() => setView('recap')}
          >
            <Icon name="description" size={15} /> Full recap
          </button>
          <button
            type="button"
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${view === 'summary' ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}
            onClick={() => setView('summary')}
          >
            <Icon name="auto_awesome" size={15} /> Smart Summary
          </button>
        </div>
      </header>

      {view === 'summary' && <SmartSummary code={code} hostKey={hostKey} />}

      {view === 'recap' && (
      <>

      <section className="card-pop mb-10 grid grid-cols-2 gap-4 p-6 text-center sm:grid-cols-4">
        <Stat n={people.length} label="people" />
        <Stat n={flat.length} label="questions" />
        <Stat n={totalAnswers} label="answers" />
        <Stat n={snap.events.length} label="reactions" />
        {emoteCounts.size > 0 && (
          <div className="col-span-2 sm:col-span-4">
            <div className="flex flex-wrap items-center justify-center gap-3 text-lg">
              {[...emoteCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([emoji, n]) => (
                  <span key={emoji} className="chip">
                    {emoji} ×{n}
                  </span>
                ))}
            </div>
          </div>
        )}
        <div className="col-span-2 flex flex-wrap justify-center gap-1.5 sm:col-span-4">
          {people.map((p) => (
            <span key={p.pid} className="chip text-xs">
              {p.avatar} {p.name}
            </span>
          ))}
        </div>
      </section>

      {/* jump straight to a section */}
      <nav className="mb-10 flex flex-wrap justify-center gap-1.5">
        {snap.config.sections.map((sec) => (
          <a key={sec.id} href={`#sec-${sec.id}`} className="chip text-xs hover:bg-ink/5">
            <Icon name="arrow_downward" size={12} /> {sec.title}
          </a>
        ))}
      </nav>

      {snap.config.sections.map((sec) => (
        <section key={sec.id} id={`sec-${sec.id}`} className="mb-12 scroll-mt-6">
          <h2 className="display-type mb-6 border-b-2 border-line pb-2 text-3xl">{sec.title}</h2>
          <div className="flex flex-col gap-10">
            {sec.questions.map((q) => (
              <article key={q.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <TypeBadge type={q.type} />
                  {q.anonymous && <span className="chip bg-note-pink/60 text-xs"><Icon name="visibility_off" size={14} /> anonymous</span>}
                  <span className="text-xs font-semibold text-ink-soft">
                    {snap.answers[q.id]?.answeredPids.length ?? 0} answered
                  </span>
                  <span className="text-xs font-medium text-ink-faint">
                    {summarize(q, snap.answers[q.id]?.answers ?? [])}
                  </span>
                </div>
                <h3 className="display-type mb-4 text-2xl">{q.prompt}</h3>
                <ResultsView question={q} answers={snap.answers[q.id]?.answers ?? []} participants={people} />
              </article>
            ))}
          </div>
        </section>
      ))}

      {snap.scratch && (
        <section className="card-pop mb-10 bg-paper p-6">
          <h2 className="display-type mb-3 text-2xl">Host scratchpad</h2>
          <p className="text-base leading-relaxed whitespace-pre-wrap">{snap.scratch}</p>
        </section>
      )}
      </>
      )}

      <footer className="pb-10 text-center">
        <Link to="/" className="text-sm font-semibold text-ink-soft underline">← Home</Link>
      </footer>
    </div>
  );
}

function DownloadMenu({ code }: { code: string }) {
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
    <div className="relative" ref={ref}>
      <button type="button" className="btn-pop bg-ink text-white hover:bg-ink/90" onClick={() => setOpen(!open)}>
        <Icon name="download" size={16} /> Download <Icon name={open ? 'expand_less' : 'expand_more'} size={16} />
      </button>
      {open && (
        <div className="card-pop absolute top-full left-1/2 z-40 mt-1.5 w-64 -translate-x-1/2 p-2 text-left">
          <a href={api.exportUrl(code, 'md')} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-ink/[0.04]" onClick={() => setOpen(false)}>
            <Icon name="article" size={17} className="text-ink-soft" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Markdown</span>
              <span className="block text-xs font-medium text-ink-soft">the whole session as a doc</span>
            </span>
          </a>
          <a href={api.exportUrl(code, 'csv')} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-ink/[0.04]" onClick={() => setOpen(false)}>
            <Icon name="table" size={17} className="text-ink-soft" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">CSV</span>
              <span className="block text-xs font-medium text-ink-soft">one row per answer, for spreadsheets</span>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="display-type text-4xl">{n}</div>
      <div className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</div>
    </div>
  );
}
