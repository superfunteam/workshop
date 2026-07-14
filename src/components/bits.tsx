import type { PublicParticipant, QuestionType } from '../../shared/types.ts';
import type { SyncStatus } from '../lib/useRoom.ts';
import Icon from './Icon.tsx';

/**
 * One identity per question type: Material Symbol, label, blurb, and a hue.
 * The hue follows the type everywhere — badges, the editor picker, the
 * editing banner — so you always know what kind of question you're looking at.
 */
export const TYPE_META: Record<
  QuestionType,
  { label: string; icon: string; blurb: string; hue: string; tint: string }
> = {
  slide: { label: 'Slide', icon: 'slideshow', blurb: 'Intro, outro, divider', hue: '#8b5cf6', tint: '#8b5cf61a' },
  choice: { label: 'Multiple choice', icon: 'radio_button_checked', blurb: 'Pick from canned answers', hue: '#3e7fd6', tint: '#3e7fd61a' },
  open: { label: 'Open answer', icon: 'edit_note', blurb: 'Everyone types a response', hue: '#1f9e82', tint: '#1f9e821a' },
  postits: { label: 'Post-its', icon: 'sticky_note_2', blurb: 'Notes across categories', hue: '#b3820e', tint: '#b3820e1a' },
  slider: { label: 'Slider', icon: 'tune', blurb: 'Between two poles', hue: '#c94f9c', tint: '#c94f9c1a' },
  discuss: { label: 'Discussion', icon: 'forum', blurb: 'Talk it out, no typing', hue: '#e4573d', tint: '#e4573d1a' },
  inspo: { label: 'Inspo board', icon: 'photo_library', blurb: 'Paste links & images', hue: '#3e7fd6', tint: '#3e7fd61a' },
  wordcloud: { label: 'Word cloud', icon: 'cloud', blurb: 'A few words each', hue: '#1f9e82', tint: '#1f9e821a' },
  dotvote: { label: 'Dot vote', icon: 'scatter_plot', blurb: 'Spend sticker dots', hue: '#e4573d', tint: '#e4573d1a' },
  rank: { label: 'Ranking', icon: 'format_list_numbered', blurb: 'Order by priority', hue: '#b3820e', tint: '#b3820e1a' },
};

/** Squared icon swatch in the type's hue — the visual anchor for a type. */
export function TypeSwatch({ type, size = 34 }: { type: QuestionType; size?: number }) {
  const meta = TYPE_META[type];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: meta.tint, color: meta.hue }}
    >
      <Icon name={meta.icon} size={Math.round(size * 0.58)} />
    </span>
  );
}

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
    <span className="chip text-xs" style={{ background: meta.tint, borderColor: `${meta.hue}55`, color: meta.hue }}>
      <Icon name={meta.icon} size={14} /> {meta.label}
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
      {state === 'done' && <Icon name="check" size={14} style={{ color: '#1f9e82' }} />}
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
      <span className={`inline-block h-2.5 w-2.5 rounded-full border border-ink/20 ${s.dot}`} />
      {s.text}
    </span>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-faint px-6 py-8 text-center font-semibold text-lg text-ink-soft">
      {children}
    </div>
  );
}
