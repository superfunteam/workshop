// The single source of truth for every shape that crosses the wire.
// Imported by the React client AND the Netlify edge function (Deno), so:
// pure types + no runtime imports.

export type QuestionType =
  | 'choice'
  | 'open'
  | 'postits'
  | 'slider'
  | 'inspo'
  | 'wordcloud'
  | 'dotvote'
  | 'rank';

export interface QuestionBase {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Smaller helper line under the prompt. */
  hint?: string;
  /** Host-only presenter notes, written ahead of time. */
  notes?: string;
  /** Strip author attribution from revealed answers. */
  anonymous?: boolean;
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'choice';
  options: string[];
  /** Allow picking more than one. */
  multi?: boolean;
}

export interface OpenQuestion extends QuestionBase {
  type: 'open';
  placeholder?: string;
}

export interface PostitsQuestion extends QuestionBase {
  type: 'postits';
  /** e.g. ["What's working", "What's not"] or ["Now", "Next", "Later"] */
  categories: string[];
}

export interface SliderQuestion extends QuestionBase {
  type: 'slider';
  left: string;
  right: string;
}

export interface InspoQuestion extends QuestionBase {
  type: 'inspo';
}

export interface WordcloudQuestion extends QuestionBase {
  type: 'wordcloud';
  /** How many words each person may add. Default 3. */
  maxWords?: number;
}

export interface DotvoteQuestion extends QuestionBase {
  type: 'dotvote';
  options: string[];
  /** Dots each person gets to distribute. Default 3. */
  dots?: number;
}

export interface RankQuestion extends QuestionBase {
  type: 'rank';
  options: string[];
}

export type Question =
  | ChoiceQuestion
  | OpenQuestion
  | PostitsQuestion
  | SliderQuestion
  | InspoQuestion
  | WordcloudQuestion
  | DotvoteQuestion
  | RankQuestion;

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export interface RoomSettings {
  /** Reveal automatically the moment everyone has answered. */
  autoReveal: boolean;
}

export interface RoomConfig {
  code: string;
  name: string;
  createdAt: number;
  sections: Section[];
  settings: RoomSettings;
}

/** Server-side config; hostKey never appears in a snapshot. */
export interface StoredRoomConfig extends RoomConfig {
  hostKey: string;
}

// ---------- answers ----------

export interface ChoiceValue {
  /** Indices into question.options. */
  picks: number[];
}
export interface OpenValue {
  text: string;
}
export interface PostitNote {
  id: string;
  /** Index into question.categories. */
  category: number;
  text: string;
}
export interface PostitsValue {
  notes: PostitNote[];
}
export interface SliderValue {
  /** 0..100, left pole → right pole. */
  value: number;
}
export interface InspoItem {
  id: string;
  kind: 'image' | 'link' | 'upload';
  url: string;
  note?: string;
}
export interface InspoValue {
  items: InspoItem[];
}
export interface WordcloudValue {
  words: string[];
}
export interface DotvoteValue {
  /** Dots per option index; sums to ≤ question dots. */
  dots: number[];
}
export interface RankValue {
  /** Option indices, best first. */
  order: number[];
}

export type AnswerValue =
  | ChoiceValue
  | OpenValue
  | PostitsValue
  | SliderValue
  | InspoValue
  | WordcloudValue
  | DotvoteValue
  | RankValue;

export interface Answer {
  pid: string;
  qid: string;
  value: AnswerValue;
  updatedAt: number;
}

// ---------- room state ----------

export type RoomPhase = 'lobby' | 'live' | 'break' | 'ended';

export interface RoomTimer {
  endsAt: number;
  seconds: number;
}

export interface RoomState {
  phase: RoomPhase;
  current: { section: number; question: number };
  /** Question id → revealed. */
  revealed: Record<string, boolean>;
  timer: RoomTimer | null;
  startedAt?: number;
  endedAt?: number;
}

export interface Participant {
  pid: string;
  name: string;
  /** Emoji avatar, e.g. "🦊". */
  avatar: string;
  joinedAt: number;
  lastSeen: number;
  removed?: boolean;
}

export interface PublicParticipant extends Participant {
  online: boolean;
}

export interface EmoteEvent {
  id: string;
  pid: string;
  name: string;
  avatar: string;
  emoji: string;
  ts: number;
}

// ---------- the snapshot every client syncs on ----------

/**
 * Per-question answer info, shaped by role:
 * - `answeredPids` always present (drives waiting screens & the host HUD).
 * - `answers` present for the host, or for everyone once revealed.
 *   Anonymous questions reach non-hosts with pid/name blanked.
 */
export interface QuestionAnswers {
  answeredPids: string[];
  answers?: Answer[];
}

export interface Snapshot {
  v: string;
  now: number;
  config: RoomConfig;
  state: RoomState;
  participants: PublicParticipant[];
  answers: Record<string, QuestionAnswers>;
  events: EmoteEvent[];
  /** The requesting participant's own answers, for refresh-resilience. */
  mine?: Record<string, AnswerValue>;
  /** Host only. */
  scratch?: string;
  isHost: boolean;
}

// ---------- host actions ----------

export type HostAction =
  | { action: 'start' }
  | { action: 'next' }
  | { action: 'prev' }
  | { action: 'goto'; section: number; question: number }
  | { action: 'reveal'; qid: string }
  | { action: 'reopen'; qid: string }
  | { action: 'phase'; phase: RoomPhase }
  | { action: 'timer'; seconds: number }
  | { action: 'clearTimer' }
  | { action: 'remove'; pid: string }
  | { action: 'restore'; pid: string }
  | { action: 'scratch'; text: string }
  | { action: 'autoReveal'; on: boolean };

// A participant is "in the room" if we heard from them this recently.
export const ONLINE_WINDOW_MS = 25_000;
// Participant heartbeat cadence.
export const HEARTBEAT_MS = 8_000;
// Emotes newer than this ride along in snapshots (clients dedup by id).
export const EVENT_WINDOW_MS = 15_000;
