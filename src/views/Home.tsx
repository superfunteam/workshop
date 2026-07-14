import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { session } from '../lib/session.ts';
import { starterSections } from '../lib/template.ts';
import { normalizeCode } from '../../shared/codes.ts';
import AnimatedEmoji from '../components/AnimatedEmoji.tsx';

export default function Home() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recents = session.recents();

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const room = await api.createRoom(name.trim() || 'Brand workshop', starterSections(), {
        autoReveal: false,
      });
      session.saveHostKey(room.code, room.hostKey);
      session.touchRecent({ code: room.code, name: name.trim() || 'Brand workshop', role: 'host' });
      nav(`/edit/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something hiccuped — try again');
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-6 py-10">
      <header className="mb-12 text-center">
        <div className="inline-block" aria-hidden>
          <AnimatedEmoji emoji="🏕️" size={88} />
        </div>
        <h1 className="display-type mt-2 text-6xl sm:text-7xl">Workshop</h1>
        <p className="mt-3 font-semibold text-xl text-ink-soft">
          run brand workshops everyone actually enjoys
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-[3fr_2fr]">
        <section className="card-pop flex flex-col gap-4 p-6">
          <h2 className="display-type text-2xl">Start a new workshop</h2>
          <input
            className="input-pop text-lg"
            placeholder="Name it — “Acme brand day”"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create();
            }}
          />
          <button type="button" className="btn-pop bg-sun self-start px-6 py-2.5 text-lg" disabled={creating} onClick={() => void create()}>
            {creating ? 'Setting up…' : 'Create it →'}
          </button>
          <p className="text-sm font-semibold text-ink-soft">
            Comes pre-loaded with a branding-workshop template — sections, questions, the works. Make it yours.
          </p>
          {error && <p className="font-semibold text-base text-coral">{error}</p>}
        </section>

        <section className="card-pop flex flex-col gap-4 bg-note-sky/30 p-6">
          <h2 className="display-type text-2xl">Joining one?</h2>
          <input
            className="input-pop text-center font-display text-3xl font-semibold tracking-[0.35em] uppercase"
            placeholder="CODE"
            value={code}
            maxLength={8}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.length >= 4) nav(`/${code}`);
            }}
          />
          <button type="button" className="btn-pop self-start" disabled={code.length < 4} onClick={() => nav(`/${code}`)}>
            Jump in →
          </button>
        </section>
      </div>

      {recents.length > 0 && (
        <section className="mt-12">
          <h2 className="display-type mb-4 text-xl text-ink-soft">Recent rooms on this device</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recents.map((room) => (
              <div key={room.code} className="card-pop flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg font-semibold">{room.name}</div>
                  <div className="text-xs font-semibold text-ink-soft">
                    {room.code} · {room.role === 'host' ? 'you host this one' : 'participant'} ·{' '}
                    {new Date(room.at).toLocaleDateString()}
                  </div>
                </div>
                {room.role === 'host' ? (
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" className="btn-pop px-3 py-1 text-sm" onClick={() => nav(`/host/${room.code}`)}>
                      Host
                    </button>
                    <button type="button" className="btn-pop px-3 py-1 text-sm" onClick={() => nav(`/edit/${room.code}`)}>
                      Edit
                    </button>
                    <button type="button" className="btn-pop px-3 py-1 text-sm" onClick={() => nav(`/recap/${room.code}`)}>
                      Recap
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-pop shrink-0 px-3 py-1 text-sm" onClick={() => nav(`/${room.code}`)}>
                    Rejoin
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-16 text-center text-xs font-semibold text-ink-faint">
        every laptop in the room, in sync · answers saved forever · exports to Markdown & CSV
      </footer>
    </div>
  );
}
