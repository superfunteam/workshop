// The participant experience: join once, then ride along with the room.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { isTalkType, type AnswerValue, type Snapshot } from '../../shared/types.ts';
import { currentQuestion } from '../../shared/flow.ts';
import { onlineAnswered, waitingOn } from '../../shared/presence.ts';
import { AVATARS } from '../../shared/emoji.ts';
import { BOUNCE, SLIDE, popChild, staggerParent } from '../lib/springs.ts';
import { DiscussMoment, SlideMoment } from '../components/TalkMoment.tsx';
import AnimatedEmoji from '../components/AnimatedEmoji.tsx';
import { api } from '../lib/api.ts';
import { session, type Identity } from '../lib/session.ts';
import { useRoom } from '../lib/useRoom.ts';
import { useCelebrations } from '../lib/celebrate.ts';
import AnswerInput, { MULTI_ITEM_TYPES } from '../components/answer/index.tsx';
import ResultsView from '../components/results/index.tsx';
import EmoteBar from '../components/EmoteBar.tsx';
import EmoteLayer from '../components/EmoteLayer.tsx';
import { TimerChip } from '../components/Timer.tsx';
import { AvatarChip, SyncDot, TypeBadge } from '../components/bits.tsx';
import Icon from '../components/Icon.tsx';

export default function RoomView({ code }: { code: string }) {
  const [identity, setIdentity] = useState<Identity | null>(() => session.identity(code));
  if (!identity) return <JoinScreen code={code} onJoined={setIdentity} />;
  return <LiveRoom code={code} identity={identity} />;
}

// ---------- join ----------

function JoinScreen({ code, onJoined }: { code: string; onJoined: (id: Identity) => void }) {
  const [meta, setMeta] = useState<{ exists: boolean; name?: string } | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .meta(code)
      .then((m) => setMeta(m))
      .catch(() => setMeta({ exists: false }));
  }, [code]);

  const join = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { pid } = await api.join(code, name.trim(), avatar);
      const id = { pid, name: name.trim(), avatar };
      session.saveIdentity(code, id);
      session.touchRecent({ code, name: meta?.name ?? code, role: 'participant' });
      onJoined(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t join — try again');
      setBusy(false);
    }
  };

  if (meta && !meta.exists) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-6xl">🫥</div>
        <h1 className="display-type text-4xl">No room at “{code}”</h1>
        <p className="text-ink-soft font-semibold">Double-check the code on the big screen.</p>
        <Link to="/" className="btn-pop mt-2">
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <p className="font-semibold text-xl text-ink-soft">you’re walking into</p>
        <h1 className="display-type text-5xl">{meta?.name ?? '…'}</h1>
      </div>
      <div className="card-pop flex w-full flex-col gap-5 p-6">
        <input
          className="input-pop text-center text-2xl"
          placeholder="Your name"
          value={name}
          maxLength={24}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void join();
          }}
        />
        <div>
          <p className="mb-2 text-center text-sm font-semibold text-ink-soft">Pick your creature</p>
          <motion.div variants={staggerParent(0.015)} initial="hidden" animate="show" className="grid grid-cols-8 gap-1.5">
            {AVATARS.map((a) => (
              <motion.button
                key={a}
                variants={popChild}
                whileHover={{ scale: 1.25, rotate: -8 }}
                whileTap={{ scale: 0.8 }}
                animate={avatar === a ? { scale: 1.15, rotate: 0 } : { scale: 1, rotate: 0 }}
                transition={BOUNCE}
                type="button"
                onClick={() => setAvatar(a)}
                className={`rounded-xl border-2 p-1.5 text-2xl ${
                  avatar === a ? 'border-sun bg-sun/60 shadow-pop-sm' : 'border-transparent'
                }`}
                aria-pressed={avatar === a}
                aria-label={`avatar ${a}`}
              >
                {a}
              </motion.button>
            ))}
          </motion.div>
        </div>
        <button type="button" className="btn-pop bg-sun py-3 text-xl" disabled={busy || !name.trim()} onClick={() => void join()}>
          {busy ? 'Joining…' : `Join as ${avatar} ${name.trim() || '…'}`}
        </button>
        {error && <p className="text-center font-semibold text-base text-coral">{error}</p>}
      </div>
    </div>
  );
}

// ---------- live room ----------

function LiveRoom({ code, identity }: { code: string; identity: Identity }) {
  const { snapshot, status, emotes, serverNow } = useRoom(code, {
    pid: identity.pid,
    heartbeat: true,
  });
  useCelebrations(snapshot);

  if (status === 'gone' || (!snapshot && status === 'offline')) {
    return (
      <Centered>
        <div className="text-6xl">📡</div>
        <h1 className="display-type text-3xl">{status === 'gone' ? 'This room has closed' : 'Trying to reach the room…'}</h1>
        <Link to="/" className="btn-pop">← Home</Link>
      </Centered>
    );
  }
  if (!snapshot) {
    return (
      <Centered>
        <div className="thinking-dots"><span /><span /><span /></div>
        <p className="font-semibold text-lg text-ink-soft">syncing up…</p>
      </Centered>
    );
  }

  const { state, config } = snapshot;
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pt-5 pb-28">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-semibold">{config.name}</div>
          <SyncDot status={status} />
        </div>
        <div className="flex items-center gap-2">
          <TimerChip timer={state.timer} serverNow={serverNow} />
          <span className="chip" title="in the room">
            <Icon name="groups" size={16} /> {snapshot.participants.filter((p) => p.online).length}
          </span>
          <span className="chip bg-sun/40">{identity.avatar} {identity.name}</span>
        </div>
      </header>

      <PhaseBody code={code} snapshot={snapshot} identity={identity} />

      <EmoteBar code={code} pid={identity.pid} />
      <EmoteLayer emotes={emotes} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">{children}</div>;
}

function PhaseBody({ code, snapshot, identity }: { code: string; snapshot: Snapshot; identity: Identity }) {
  const { state } = snapshot;

  if (state.phase === 'lobby') {
    return (
      <Centered>
        <AnimatedEmoji emoji="🏕️" size={96} />
        <h1 className="display-type text-4xl">You’re in!</h1>
        <p className="font-semibold text-xl text-ink-soft">hang tight — the host will kick things off</p>
        <div className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
          {snapshot.participants.filter((p) => p.online).map((p) => (
            <AvatarChip key={p.pid} p={p} />
          ))}
        </div>
        <p className="mt-6 text-sm font-semibold text-ink-faint">psst — try the emoji bar below</p>
      </Centered>
    );
  }

  if (state.phase === 'break') {
    return (
      <Centered>
        <AnimatedEmoji emoji="☕" size={96} />
        <h1 className="display-type text-5xl">Break time</h1>
        <p className="font-semibold text-xl text-ink-soft">stretch those legs — we’ll be right here</p>
      </Centered>
    );
  }

  if (state.phase === 'ended') {
    return (
      <Centered>
        <AnimatedEmoji emoji="🎬" size={96} />
        <h1 className="display-type text-5xl">That’s a wrap!</h1>
        <p className="font-semibold text-xl text-ink-soft">thanks for making it a good one, {identity.name}</p>
        <Link to={`/recap/${code}`} className="btn-pop bg-sun mt-4 text-lg">
          See everything we made →
        </Link>
      </Centered>
    );
  }

  return <QuestionStage code={code} snapshot={snapshot} identity={identity} />;
}

function QuestionStage({ code, snapshot, identity }: { code: string; snapshot: Snapshot; identity: Identity }) {
  const { config, state } = snapshot;
  const flat = currentQuestion(config, state);
  const [editing, setEditing] = useState(false);

  const qid = flat?.question.id ?? '';
  // Fresh question → out of editing mode.
  useEffect(() => setEditing(false), [qid]);

  const myValue = (qid ? snapshot.mine?.[qid] : undefined) ?? null;
  const questionAnswers = qid ? snapshot.answers[qid] : undefined;
  const revealed = !!(qid && state.revealed[qid]);

  const submit = useMemo(
    () => async (value: AnswerValue) => {
      if (!qid) return;
      await api.answer(code, identity.pid, qid, value);
      setEditing(false);
    },
    [code, identity.pid, qid],
  );

  if (!flat) {
    return (
      <Centered>
        <p className="font-semibold text-xl text-ink-soft">the host is lining up the next bit…</p>
      </Centered>
    );
  }

  const { question, section, n, total } = flat;
  const answeredPids = questionAnswers?.answeredPids ?? [];
  const iAnswered = answeredPids.includes(identity.pid);
  const stillThinking = waitingOn(snapshot.participants, answeredPids);
  const isBoard = MULTI_ITEM_TYPES.has(question.type);
  const talk = isTalkType(question.type);
  const showInput = !talk && !revealed && (!iAnswered || editing || isBoard);
  const showWaiting = !talk && !revealed && iAnswered && !editing && !isBoard;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 34, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -26, scale: 0.99, transition: { duration: 0.14 } }}
        transition={SLIDE}
        className="flex flex-1 flex-col"
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="chip bg-note-lilac/60">{section.title}</span>
          <span className="chip">{n + 1} of {total}</span>
          <TypeBadge type={question.type} />
          {question.anonymous && <span className="chip bg-note-pink/60"><Icon name="visibility_off" size={14} /> anonymous</span>}
        </div>

        {question.type === 'slide' ? (
          <SlideMoment question={question} />
        ) : (
          <>
            <h1 className="display-type mb-2 text-4xl sm:text-5xl">{question.prompt}</h1>
            {question.hint && question.type !== 'discuss' && (
              <p className="mb-6 font-semibold text-lg text-ink-soft">{question.hint}</p>
            )}
            {(!question.hint || question.type === 'discuss') && <div className="mb-6" />}
          </>
        )}

        {question.type === 'discuss' && <DiscussMoment question={question} role="participant" />}

        {revealed && !talk && (
          <div className="flex flex-col gap-6">
            <ResultsView question={question} answers={questionAnswers?.answers ?? []} participants={snapshot.participants} />
            <button type="button" className="self-center text-sm font-semibold text-ink-soft underline" onClick={() => setEditing(true)}>
              change my answer
            </button>
            {editing && (
              <div className="card-pop bg-note-yellow/30 p-5">
                <AnswerInput question={question} value={myValue} onSubmit={submit} code={code} pid={identity.pid} />
              </div>
            )}
          </div>
        )}

        {showInput && (
          <AnswerInput question={question} value={myValue} onSubmit={submit} code={code} pid={identity.pid} />
        )}

        {isBoard && !revealed && (
          <p className="mt-6 text-center text-sm font-semibold text-ink-soft">
            {onlineAnswered(snapshot.participants, answeredPids)} of{' '}
            {snapshot.participants.filter((p) => p.online).length} contributing — boards reveal together 🤫
          </p>
        )}

        {showWaiting && (
          <motion.div
            variants={staggerParent(0.05)}
            initial="hidden"
            animate="show"
            className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={BOUNCE}
            >
              <AnimatedEmoji emoji="🙌" size={96} />
            </motion.div>
            <motion.h2 variants={popChild} className="display-type text-4xl">
              You’re in!
            </motion.h2>
            <motion.p variants={popChild} className="font-semibold text-xl text-ink-soft">
              waiting on the group — {onlineAnswered(snapshot.participants, answeredPids)} of{' '}
              {snapshot.participants.filter((p) => p.online).length} answered
            </motion.p>
            {!question.anonymous && stillThinking.length > 0 && (
              <motion.div variants={staggerParent(0.04)} initial="hidden" animate="show" className="flex max-w-md flex-wrap justify-center gap-2">
                {stillThinking.map((p) => (
                  <motion.span key={p.pid} variants={popChild}>
                    <AvatarChip p={p} state="waiting" />
                  </motion.span>
                ))}
              </motion.div>
            )}
            <div className="thinking-dots mt-2"><span /><span /><span /></div>
            <motion.button
              variants={popChild}
              whileTap={{ scale: 0.94 }}
              type="button"
              className="btn-pop mt-2 text-sm"
              onClick={() => setEditing(true)}
            >
              <Icon name="edit" size={16} /> Change my answer
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
