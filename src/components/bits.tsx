import type { PublicParticipant, QuestionType } from '../../shared/types.ts';
import type { SyncStatus } from '../lib/useRoom.ts';

export const TYPE_META: Record<QuestionType, { label: string; emoji: string; blurb: string }> = {
  choice: { label: 'Multiple choice', emoji: '🔘', blurb: 'Pick from canned answers' },
  open: { label: 'Open answer', emoji: '💬', blurb: 'Everyone types a response' },
  postits: { label: 'Post-its', emoji: '🗒️', blurb: 'Notes across categories' },
  slider: { label: 'Slider', emoji: '🎚️', blurb: 'Between two poles' },
  inspo: { label: 'Inspo board', emoji: '🖼️', blurb: 'Paste links & images' },
  wordcloud: { label: 'Word cloud', emoji: '☁️', blurb: 'A few words each' },
  dotvote: { label: 'Dot vote', emoji: '🔴', blurb: 'Spend sticker dots' },
  rank: { label: 'Ranking', emoji: '🏆', blurb: 'Order by priority' },
};

/** Fixed-order data palette (validated); options wear these in order. */
export const DATA_COLORS = ['#e4573d', '#b3820e', '#1f9e82', '#3e7fd6', '#8b5cf6', '#c94f9c'];
export const dataColor = (i: number): string => DATA_COLORS[i % DATA_COLORS.length];

export const NOTE_COLORS = ['#ffe86b', '#ffc4d8', '#baefd4', '#c3e3ff', '#ddd0ff', '#ffdcb4'];
export const noteColor = (i: number): string => NOTE_COLORS[i % NOTE_COLORS.length];

/** Deterministic sticky-note tilt from an id, so notes don't dance on re-render. */
export function tiltFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return `${((h % 100) / 100) * 4.5 - 2.25}deg`;
}

export function TypeBadge({ type }: { type: QuestionType }) {
  const meta = TYPE_META[type];
  return (
    <span className="chip bg-white text-xs">
      <span aria-hidden>{meta.emoji}</span> {meta.label}
    </span>
  );
}

export function AvatarChip({ p, state }: { p: PublicParticipant; state?: 'done' | 'waiting' | 'offline' }) {
  return (
    <span
      className={`chip transition-all ${
        state === 'done'
          ? 'bg-mint/40'
          : state === 'offline'
            ? 'opacity-40 grayscale'
            : 'bg-white'
      }`}
      title={p.online ? p.name : `${p.name} (stepped away)`}
    >
      <span className="text-base" aria-hidden>
        {p.avatar}
      </span>
      <span className="max-w-28 truncate">{p.name}</span>
      {state === 'done' && <span aria-label="answered">✓</span>}
      {state === 'waiting' && <span className="animate-pulse" aria-label="still thinking">…</span>}
    </span>
  );
}

const STATUS_LABEL: Record<SyncStatus, { text: string; dot: string }> = {
  connecting: { text: 'connecting', dot: 'bg-amber-400 animate-pulse' },
  live: { text: 'live', dot: 'bg-emerald-500' },
  polling: { text: 'synced', dot: 'bg-emerald-500' },
  offline: { text: 'reconnecting…', dot: 'bg-red-500 animate-pulse' },
  gone: { text: 'room closed', dot: 'bg-zinc-400' },
};

export function SyncDot({ status }: { status: SyncStatus }) {
  const s = STATUS_LABEL[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
      <span className={`inline-block h-2.5 w-2.5 rounded-full border border-ink/40 ${s.dot}`} />
      {s.text}
    </span>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink-faint px-6 py-8 text-center font-hand text-2xl text-ink-soft">
      {children}
    </div>
  );
}
