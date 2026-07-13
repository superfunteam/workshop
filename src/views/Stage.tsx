// The projector view: giant type, live progress, QR for late arrivals,
// emoji rain. No controls — it's a billboard.

import { AnimatePresence, motion } from 'motion/react';
import { isTalkType, type Snapshot } from '../../shared/types.ts';
import { currentQuestion } from '../../shared/flow.ts';
import { allAnswered, onlineAnswered, waitingOn } from '../../shared/presence.ts';
import { SLIDE } from '../lib/springs.ts';
import { DiscussMoment, SlideMoment } from '../components/TalkMoment.tsx';
import { useRoom } from '../lib/useRoom.ts';
import { useCelebrations } from '../lib/celebrate.ts';
import ResultsView from '../components/results/index.tsx';
import EmoteLayer from '../components/EmoteLayer.tsx';
import { TimerBig } from '../components/Timer.tsx';
import QR from '../components/QR.tsx';
import { AvatarChip } from '../components/bits.tsx';

export default function StageView({ code }: { code: string }) {
  const { snapshot, status, emotes, serverNow } = useRoom(code, { stage: true });
  useCelebrations(snapshot);

  if (!snapshot) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="thinking-dots"><span /><span /><span /></div>
      </div>
    );
  }

  const { config, state } = snapshot;
  const online = snapshot.participants.filter((p) => p.online);
  const joinUrl = `${location.origin}/${code}`;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-10 py-8">
      <TimerBig timer={state.timer} serverNow={serverNow} />

      {state.phase === 'lobby' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <h1 className="display-type text-7xl xl:text-8xl">{config.name}</h1>
          <div className="flex items-center gap-10">
            <QR url={joinUrl} size={220} />
            <div className="text-left">
              <p className="font-semibold text-2xl text-ink-soft">join at</p>
              <p className="font-display text-4xl font-extrabold">{location.host}</p>
              <p className="mt-3 font-semibold text-2xl text-ink-soft">room code</p>
              <p className="font-display text-7xl font-extrabold tracking-[0.2em]">{code}</p>
            </div>
          </div>
          <div className="flex max-w-3xl flex-wrap justify-center gap-2">
            {online.map((p) => (
              <span key={p.pid} className="animate-pop-in chip text-lg">
                {p.avatar} {p.name}
              </span>
            ))}
          </div>
          <p className="font-semibold text-xl text-ink-soft">
            {online.length === 0 ? 'scan in — first one gets bragging rights' : `${online.length} in the room`}
          </p>
        </div>
      )}

      {state.phase === 'break' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="animate-wiggle text-9xl">☕</div>
          <h1 className="display-type text-8xl">Break time</h1>
          <p className="font-semibold text-2xl text-ink-soft">back soon — the room stays open</p>
        </div>
      )}

      {state.phase === 'ended' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="text-9xl">🎬</div>
          <h1 className="display-type text-8xl">That’s a wrap!</h1>
          <p className="font-semibold text-2xl text-ink-soft">thank you, {config.name} crew</p>
        </div>
      )}

      {state.phase === 'live' && <LiveStage snapshot={snapshot} />}

      {/* footer strip */}
      <footer className="mt-auto flex items-end justify-between pt-6">
        <div className="flex items-center gap-3">
          <span className="chip bg-white text-base">✋ {online.length} in the room</span>
          <span className={`chip text-base ${status === 'live' || status === 'polling' ? 'bg-note-mint/70' : 'bg-note-pink'}`}>
            {status === 'live' || status === 'polling' ? '● synced' : '○ reconnecting…'}
          </span>
        </div>
        {state.phase !== 'lobby' && (
          <div className="flex items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-white p-2.5 shadow-pop-sm">
            <QR url={joinUrl} size={84} />
            <div className="pr-2 text-left">
              <div className="text-[11px] font-extrabold tracking-wide text-ink-soft uppercase">late? join in</div>
              <div className="font-display text-2xl font-extrabold tracking-[0.15em]">{code}</div>
            </div>
          </div>
        )}
      </footer>

      <EmoteLayer emotes={emotes} />
    </div>
  );
}

function LiveStage({ snapshot }: { snapshot: Snapshot }) {
  const { config, state } = snapshot;
  const flat = currentQuestion(config, state);
  if (!flat) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="font-semibold text-3xl text-ink-soft">lining up the next question…</p>
      </div>
    );
  }
  const qid = flat.question.id;
  const qa = snapshot.answers[qid];
  const answeredPids = qa?.answeredPids ?? [];
  const revealed = !!state.revealed[qid];
  const online = snapshot.participants.filter((p) => p.online);
  const everyoneIn = allAnswered(snapshot.participants, answeredPids);
  const pending = waitingOn(snapshot.participants, answeredPids);

  if (isTalkType(flat.question.type)) {
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={qid}
          initial={{ opacity: 0, y: 44, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, transition: { duration: 0.15 } }}
          transition={SLIDE}
          className="flex flex-1 flex-col"
        >
          {flat.question.type === 'slide' && <SlideMoment question={flat.question} big />}
          {flat.question.type === 'discuss' && (
            <>
              <h1 className="display-type mb-3 text-center text-6xl xl:text-7xl">{flat.question.prompt}</h1>
              <DiscussMoment question={flat.question} role="stage" big />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
    <motion.div
      key={qid}
      initial={{ opacity: 0, y: 44, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, transition: { duration: 0.15 } }}
      transition={SLIDE}
      className="flex flex-1 flex-col"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="chip bg-note-lilac/60 text-base">{flat.section.title}</span>
        <span className="chip text-base">
          {flat.n + 1} / {flat.total}
        </span>
        {flat.question.anonymous && <span className="chip bg-note-pink/60 text-base">🕶 anonymous</span>}
      </div>
      <h1 className="display-type mb-3 text-6xl xl:text-7xl">{flat.question.prompt}</h1>
      {flat.question.hint && <p className="mb-6 font-semibold text-2xl text-ink-soft">{flat.question.hint}</p>}

      {revealed ? (
        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          <ResultsView question={flat.question} answers={qa?.answers ?? []} participants={snapshot.participants} big />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <div className="w-full max-w-3xl">
            <div className="mb-3 flex justify-between font-display text-3xl font-extrabold">
              <span>{onlineAnswered(snapshot.participants, answeredPids)} in</span>
              <span className="text-ink-soft">{online.length} in the room</span>
            </div>
            <div className="h-10 w-full overflow-hidden rounded-full border-[3px] border-ink bg-white">
              <div
                className="h-full rounded-full bg-mint transition-[width] duration-700 ease-out"
                style={{
                  width: `${online.length ? Math.min(100, (onlineAnswered(snapshot.participants, answeredPids) / online.length) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
          {everyoneIn && online.length > 0 ? (
            <p className="animate-pop-in display-type text-5xl">everyone’s in 🎉</p>
          ) : flat.question.anonymous ? (
            <p className="font-semibold text-2xl text-ink-soft">answers are anonymous on this one 🕶</p>
          ) : (
            pending.length > 0 &&
            pending.length <= 12 && (
              <div className="flex max-w-3xl flex-wrap items-center justify-center gap-2">
                <span className="mr-1 font-semibold text-xl text-ink-soft">still thinking:</span>
                {pending.map((p) => (
                  <AvatarChip key={p.pid} p={p} state="waiting" />
                ))}
              </div>
            )
          )}
        </div>
      )}
    </motion.div>
    </AnimatePresence>
  );
}
