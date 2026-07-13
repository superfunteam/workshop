// Mission control: run the room, see who's answered, peek values live,
// keep notes. Requires the host key (from the create flow or ?key= link).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { HostAction } from '../../shared/types.ts';
import { currentQuestion } from '../../shared/flow.ts';
import { allAnswered, onlineAnswered } from '../../shared/presence.ts';
import { summarize } from '../../shared/aggregate.ts';
import { api } from '../lib/api.ts';
import { session } from '../lib/session.ts';
import { useRoom } from '../lib/useRoom.ts';
import { useCelebrations } from '../lib/celebrate.ts';
import ResultsView from '../components/results/index.tsx';
import EmoteLayer from '../components/EmoteLayer.tsx';
import { TimerChip } from '../components/Timer.tsx';
import { AvatarChip, SyncDot, TypeBadge } from '../components/bits.tsx';

export default function HostView({ code }: { code: string }) {
  const [params, setParams] = useSearchParams();
  const [key, setKey] = useState<string | null>(() => session.hostKey(code));

  // Accept ?key= from a shared host link, stash it, clean the URL.
  useEffect(() => {
    const fromUrl = params.get('key');
    if (fromUrl) {
      session.saveHostKey(code, fromUrl);
      setKey(fromUrl);
      params.delete('key');
      setParams(params, { replace: true });
    }
  }, [code, params, setParams]);

  if (!key) return <NeedKey code={code} onKey={setKey} />;
  return <Console code={code} hostKey={key} />;
}

function NeedKey({ code, onKey }: { code: string; onKey: (k: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-6xl">🗝️</div>
      <h1 className="display-type text-3xl">Host access for {code}</h1>
      <p className="max-w-md font-semibold text-ink-soft">
        Open the host link from the device that created the room, or paste the host key from your editor URL.
      </p>
      <div className="flex gap-2">
        <input className="input-pop" placeholder="host key" value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          type="button"
          className="btn-pop bg-sun"
          disabled={!value.trim()}
          onClick={() => {
            session.saveHostKey(code, value.trim());
            onKey(value.trim());
          }}
        >
          Unlock
        </button>
      </div>
      <Link to="/" className="text-sm font-bold text-ink-soft underline">← Home</Link>
    </div>
  );
}

// ---------- console ----------

function Console({ code, hostKey }: { code: string; hostKey: string }) {
  const { snapshot, status, emotes, serverNow } = useRoom(code, { hostKey });
  useCelebrations(snapshot);
  const [busy, setBusy] = useState(false);

  const act = useMemo(
    () => async (action: HostAction) => {
      setBusy(true);
      try {
        await api.host(code, hostKey, action);
      } catch (e) {
        alert(e instanceof Error ? `That didn’t stick: ${e.message}` : 'That didn’t stick — try again');
      } finally {
        setBusy(false);
      }
    },
    [code, hostKey],
  );

  useEffect(() => {
    if (snapshot) session.touchRecent({ code, name: snapshot.config.name, role: 'host' });
  }, [code, snapshot?.config.name]);

  if (snapshot && !snapshot.isHost) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-5xl">🚫</div>
        <h1 className="display-type text-2xl">That host key doesn’t open this room</h1>
        <button
          type="button"
          className="btn-pop"
          onClick={() => {
            session.saveHostKey(code, '');
            location.reload();
          }}
        >
          Enter a different key
        </button>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="thinking-dots"><span /><span /><span /></div>
      </div>
    );
  }

  const { config, state } = snapshot;
  const flat = currentQuestion(config, state);
  const online = snapshot.participants.filter((p) => p.online);
  const qid = flat?.question.id ?? '';
  const answeredPids = qid ? (snapshot.answers[qid]?.answeredPids ?? []) : [];
  const revealed = !!(qid && state.revealed[qid]);
  const everyoneIn = allAnswered(snapshot.participants, answeredPids);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b-[2.5px] border-ink bg-card px-4 py-2.5">
        <span className="font-display text-lg font-extrabold">{config.name}</span>
        <span className="chip bg-sun/50 font-mono tracking-widest">{code}</span>
        <SyncDot status={status} />
        <span className="chip">✋ {online.length} in the room</span>
        <TimerChip timer={state.timer} serverNow={serverNow} />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {state.phase === 'lobby' && (
            <button type="button" className="btn-pop animate-pulse-ring bg-sun" disabled={busy} onClick={() => void act({ action: 'start' })}>
              ▶ Start the show
            </button>
          )}
          {state.phase === 'live' && (
            <>
              <TimerMenu onStart={(s) => void act({ action: 'timer', seconds: s })} onClear={() => void act({ action: 'clearTimer' })} hasTimer={!!state.timer} />
              <button type="button" className="btn-pop text-sm" disabled={busy} onClick={() => void act({ action: 'phase', phase: 'break' })}>
                ☕ Break
              </button>
              <button
                type="button"
                className="btn-pop text-sm"
                disabled={busy}
                onClick={() => {
                  if (confirm('End the workshop for everyone?')) void act({ action: 'phase', phase: 'ended' });
                }}
              >
                🏁 End
              </button>
            </>
          )}
          {(state.phase === 'break' || state.phase === 'ended') && (
            <button type="button" className="btn-pop bg-sun text-sm" disabled={busy} onClick={() => void act({ action: 'phase', phase: 'live' })}>
              ▶ Back to it
            </button>
          )}
          <label className="chip cursor-pointer select-none" title="Reveal automatically when everyone has answered">
            <input
              type="checkbox"
              checked={config.settings.autoReveal}
              onChange={(e) => void act({ action: 'autoReveal', on: e.target.checked })}
            />
            auto-reveal
          </label>
          <a className="btn-pop text-sm" href={`/stage/${code}`} target="_blank" rel="noreferrer">
            📽 Stage
          </a>
          <Link className="btn-pop text-sm" to={`/edit/${code}`}>
            ✏️ Edit
          </Link>
          <a className="btn-pop text-sm" href={api.exportUrl(code, 'md')}>
            ⬇ MD
          </a>
          <a className="btn-pop text-sm" href={api.exportUrl(code, 'csv')}>
            ⬇ CSV
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* question rail */}
        <nav className="w-64 shrink-0 overflow-y-auto border-r-[2.5px] border-ink bg-paper/60 p-3">
          {config.sections.map((sec, sIdx) => (
            <div key={sec.id} className="mb-4">
              <div className="mb-1.5 px-1 font-display text-xs font-extrabold tracking-wide text-ink-soft uppercase">
                {sec.title}
              </div>
              <div className="flex flex-col gap-1.5">
                {sec.questions.map((q, qIdx) => {
                  const isCurrent = sIdx === state.current.section && qIdx === state.current.question;
                  const count = snapshot.answers[q.id]?.answeredPids.length ?? 0;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => void act({ action: 'goto', section: sIdx, question: qIdx })}
                      className={`cursor-pointer rounded-xl border-2 px-2.5 py-1.5 text-left text-sm font-semibold transition-all ${
                        isCurrent ? 'border-ink bg-sun shadow-pop-sm' : 'border-transparent hover:border-ink-faint'
                      }`}
                    >
                      <span className="line-clamp-2">{q.prompt}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
                        {state.revealed[q.id] ? '👁 revealed' : count > 0 ? `${count} answered` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* main stage */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-5">
          {state.phase === 'lobby' && <LobbyPanel code={code} online={online.length} />}
          {state.phase !== 'lobby' && flat && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="chip bg-note-lilac/60">{flat.section.title}</span>
                <span className="chip">{flat.n + 1} of {flat.total}</span>
                <TypeBadge type={flat.question.type} />
                {flat.question.anonymous && <span className="chip bg-note-pink/60">🕶 anonymous</span>}
              </div>
              <h1 className="display-type mb-4 text-3xl">{flat.question.prompt}</h1>

              {/* HUD: who's in */}
              <div className="card-pop mb-4 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-ink-soft">
                    {onlineAnswered(snapshot.participants, answeredPids)} of {online.length} answered
                    {everyoneIn && online.length > 0 && <span className="ml-2">🎉 everyone’s in!</span>}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" className="btn-pop px-3 py-1 text-sm" disabled={busy} onClick={() => void act({ action: 'prev' })}>
                      ← Back
                    </button>
                    {!revealed ? (
                      <button
                        type="button"
                        className={`btn-pop bg-coral px-4 py-1 text-sm text-white ${everyoneIn ? 'animate-pulse-ring' : ''}`}
                        disabled={busy}
                        onClick={() => void act({ action: 'reveal', qid })}
                      >
                        👁 Reveal answers
                      </button>
                    ) : (
                      <button type="button" className="btn-pop px-3 py-1 text-sm" disabled={busy} onClick={() => void act({ action: 'reopen', qid })}>
                        🙈 Hide again
                      </button>
                    )}
                    <button type="button" className="btn-pop bg-sun px-3 py-1 text-sm" disabled={busy} onClick={() => void act({ action: 'next' })}>
                      Next →
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.participants.map((p) => (
                    <span key={p.pid} className="group relative">
                      <AvatarChip p={p} state={!p.online ? 'offline' : answeredPids.includes(p.pid) ? 'done' : 'waiting'} />
                      <button
                        type="button"
                        title={`remove ${p.name}`}
                        onClick={() => {
                          if (confirm(`Remove ${p.name} from the room count?`)) void act({ action: 'remove', pid: p.pid });
                        }}
                        className="absolute -top-1.5 -right-1.5 hidden h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-ink bg-white text-[9px] group-hover:flex"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {snapshot.participants.length === 0 && (
                    <span className="font-hand text-xl text-ink-soft">nobody yet — send folks to the join code</span>
                  )}
                </div>
              </div>

              {/* live values (host always sees them) */}
              <div className={`card-pop mb-4 p-4 ${revealed ? 'bg-note-mint/20' : 'bg-white'}`}>
                <div className="mb-2 flex items-center justify-between text-xs font-extrabold tracking-wide text-ink-soft uppercase">
                  <span>{revealed ? 'Revealed to the room' : 'Live peek (only you see this)'}</span>
                  <span className="font-sans normal-case">{summarize(flat.question, snapshot.answers[qid]?.answers ?? [])}</span>
                </div>
                <ResultsView question={flat.question} answers={snapshot.answers[qid]?.answers ?? []} participants={snapshot.participants} />
              </div>
            </>
          )}
          {state.phase === 'break' && (
            <div className="card-pop bg-note-sky/40 p-6 text-center font-hand text-3xl">
              Room’s on break ☕ — hit “Back to it” when you’re ready
            </div>
          )}
          {state.phase === 'ended' && (
            <div className="card-pop bg-note-mint/40 p-6 text-center">
              <p className="display-type text-2xl">Workshop ended 🎬</p>
              <p className="mt-2 font-semibold text-ink-soft">
                Everything’s saved. Grab the exports above or open the <Link className="underline" to={`/recap/${code}`}>full recap</Link>.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* notes dock */}
      <NotesDock
        notes={state.phase === 'live' ? (flat?.question.notes ?? '') : ''}
        scratch={snapshot.scratch ?? ''}
        onScratch={(text) => void act({ action: 'scratch', text })}
      />
      <EmoteLayer emotes={emotes} />
    </div>
  );
}

function LobbyPanel({ code, online }: { code: string; online: number }) {
  const joinUrl = `${location.origin}/${code}`;
  return (
    <div className="card-pop flex flex-col items-center gap-4 bg-note-yellow/30 p-8 text-center">
      <h1 className="display-type text-3xl">Doors are open 🚪</h1>
      <p className="font-semibold text-ink-soft">
        Send people to <span className="font-mono font-bold text-ink">{joinUrl}</span> — or throw the stage view on the projector; it has a QR code.
      </p>
      <p className="font-hand text-3xl">{online === 0 ? 'waiting for the first arrival…' : `${online} in the room so far`}</p>
      <p className="text-sm font-semibold text-ink-soft">Hit “Start the show” up top when the room’s ready.</p>
    </div>
  );
}

function TimerMenu({ onStart, onClear, hasTimer }: { onStart: (s: number) => void; onClear: () => void; hasTimer: boolean }) {
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
      <button type="button" className="btn-pop text-sm" onClick={() => setOpen(!open)}>
        ⏱ Timer
      </button>
      {open && (
        <div className="card-pop absolute top-full right-0 z-30 mt-1 flex gap-1 p-1.5">
          {[60, 120, 300].map((s) => (
            <button
              key={s}
              type="button"
              className="btn-pop px-2.5 py-1 text-xs"
              onClick={() => {
                onStart(s);
                setOpen(false);
              }}
            >
              {s / 60}m
            </button>
          ))}
          {hasTimer && (
            <button
              type="button"
              className="btn-pop bg-coral px-2.5 py-1 text-xs text-white"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NotesDock({ notes, scratch, onScratch }: { notes: string; scratch: string; onScratch: (t: string) => void }) {
  const [draft, setDraft] = useState(scratch);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  // Adopt server scratch unless we're mid-edit (co-host might type too).
  useEffect(() => {
    if (!dirty.current) setDraft(scratch);
  }, [scratch]);

  const onChange = (text: string) => {
    setDraft(text);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      dirty.current = false;
      onScratch(text);
    }, 900);
  };

  return (
    <footer className="grid h-44 shrink-0 grid-cols-2 border-t-[2.5px] border-ink bg-card">
      <div className="flex flex-col overflow-hidden border-r-[2.5px] border-ink p-3">
        <div className="mb-1 text-xs font-extrabold tracking-wide text-ink-soft uppercase">📋 Your notes for this question</div>
        <div className="flex-1 overflow-y-auto font-hand text-2xl leading-snug whitespace-pre-wrap">
          {notes || <span className="text-ink-faint">no presenter notes on this one — add them in the editor</span>}
        </div>
      </div>
      <div className="flex flex-col overflow-hidden p-3">
        <div className="mb-1 text-xs font-extrabold tracking-wide text-ink-soft uppercase">✍️ Scratchpad (saves as you type, lands in the export)</div>
        <textarea
          className="w-full flex-1 resize-none bg-transparent font-hand text-2xl leading-snug outline-none placeholder:text-ink-faint"
          placeholder="“CEO hates the mascot” — that kind of thing"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </footer>
  );
}
