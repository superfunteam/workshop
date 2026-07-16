// The landing page has ONE job: get a participant into their room.
// Hosting and history live small at the bottom — most visitors are joining.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { session } from '../lib/session.ts';
import { starterSections } from '../lib/template.ts';
import { normalizeCode } from '../../shared/codes.ts';
import AnimatedEmoji from '../components/AnimatedEmoji.tsx';
import Icon from '../components/Icon.tsx';

export default function Home() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recents = session.recents();

  const join = () => {
    if (code.length >= 4) nav(`/${code}`);
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const room = await api.createRoom('Brand workshop', starterSections(), { autoReveal: false });
      session.saveHostKey(room.code, room.hostKey);
      session.touchRecent({ code: room.code, name: 'Brand workshop', role: 'host' });
      nav(`/edit/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something hiccuped — try again');
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-10">
      {/* ---------- the one job: join ---------- */}
      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="inline-block" aria-hidden>
          <AnimatedEmoji emoji="🏕️" size={80} />
        </div>
        <h1 className="display-type mt-2 text-5xl sm:text-6xl">Workshop</h1>
        <p className="mt-2 mb-10 font-semibold text-lg text-ink-soft">
          got a room code? it’s on the big screen
        </p>

        <div className="card-pop w-full max-w-md p-6 sm:p-8">
          <label className="mb-2 block text-xs font-semibold tracking-widest text-ink-soft uppercase" htmlFor="join-code">
            Enter your room code
          </label>
          <input
            id="join-code"
            className="input-pop w-full text-center font-display text-5xl font-semibold tracking-[0.3em] uppercase"
            placeholder="CODE"
            value={code}
            maxLength={8}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') join();
            }}
          />
          <button
            type="button"
            className="btn-pop bg-ink text-white hover:bg-ink/90 mt-4 w-full py-3.5 text-xl"
            disabled={code.length < 4}
            onClick={join}
          >
            Join the workshop →
          </button>
        </div>
      </main>

      {/* ---------- demoted: hosting + history ---------- */}
      <footer className="mt-12 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <span>Hosting one?</span>
          <button
            type="button"
            className="cursor-pointer underline underline-offset-2 hover:text-ink"
            disabled={creating}
            onClick={() => void create()}
          >
            {creating ? 'Setting up…' : 'Start a new workshop'}
          </button>
          <span className="text-ink-faint">— comes pre-loaded with our question set</span>
        </div>
        {error && <p className="text-sm font-semibold text-coral">{error}</p>}

        {recents.length > 0 && (
          <div className="w-full max-w-md">
            <div className="mb-1.5 text-center text-[11px] font-semibold tracking-widest text-ink-faint uppercase">
              Recent rooms on this device
            </div>
            <ul className="divide-y divide-line rounded-xl border border-line bg-white">
              {recents.slice(0, 5).map((room) => (
                <li key={room.code} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{room.name}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-faint">{room.code}</span>
                  {room.role === 'host' ? (
                    <span className="flex shrink-0 gap-2 text-xs font-semibold">
                      <button type="button" className="cursor-pointer text-ink-soft underline-offset-2 hover:underline" onClick={() => nav(`/host/${room.code}`)}>host</button>
                      <button type="button" className="cursor-pointer text-ink-soft underline-offset-2 hover:underline" onClick={() => nav(`/edit/${room.code}`)}>edit</button>
                      <button type="button" className="cursor-pointer text-ink-soft underline-offset-2 hover:underline" onClick={() => nav(`/recap/${room.code}`)}>recap</button>
                    </span>
                  ) : (
                    <button type="button" className="shrink-0 cursor-pointer text-xs font-semibold text-ink-soft underline-offset-2 hover:underline" onClick={() => nav(`/${room.code}`)}>
                      rejoin
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs font-semibold text-ink-faint">
          <Icon name="sync" size={13} /> every laptop in the room, in sync · answers saved forever · exports to Markdown & CSV
        </p>
      </footer>
    </div>
  );
}
