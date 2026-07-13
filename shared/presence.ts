import { ONLINE_WINDOW_MS, type Participant, type PublicParticipant } from './types.ts';

export function isOnline(p: Participant, now: number): boolean {
  return !p.removed && now - p.lastSeen <= ONLINE_WINDOW_MS;
}

/** All non-removed participants, flagged with liveness, online first, then by join order. */
export function publicParticipants(all: Participant[], now: number): PublicParticipant[] {
  return all
    .filter((p) => !p.removed)
    .map((p) => ({ ...p, online: isOnline(p, now) }))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.joinedAt - b.joinedAt);
}

/** Everyone currently in the room has answered (and there's at least one person). */
export function allAnswered(participants: PublicParticipant[], answeredPids: string[]): boolean {
  const online = participants.filter((p) => p.online);
  if (online.length === 0) return false;
  const answered = new Set(answeredPids);
  return online.every((p) => answered.has(p.pid));
}

/** Online participants who haven't answered yet — the "still thinking" list. */
export function waitingOn(participants: PublicParticipant[], answeredPids: string[]): PublicParticipant[] {
  const answered = new Set(answeredPids);
  return participants.filter((p) => p.online && !answered.has(p.pid));
}
