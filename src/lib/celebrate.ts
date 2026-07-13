// Room-wide celebration triggers, derived from snapshot transitions so every
// screen (participant, host, stage) pops at the same moments.

import { useEffect, useRef } from 'react';
import type { Snapshot } from '../../shared/types.ts';
import { allAnswered } from '../../shared/presence.ts';
import { currentQuestion } from '../../shared/flow.ts';
import { confetti } from './confetti.ts';

export function useCelebrations(snapshot: Snapshot | null): void {
  const prev = useRef<{ allIn: boolean; section: number; phase: string; qid: string } | null>(null);

  useEffect(() => {
    if (!snapshot) return;
    const cur = currentQuestion(snapshot.config, snapshot.state);
    const qid = cur?.question.id ?? '';
    const answered = qid ? (snapshot.answers[qid]?.answeredPids ?? []) : [];
    const now = {
      allIn: !!qid && allAnswered(snapshot.participants, answered),
      section: snapshot.state.current.section,
      phase: snapshot.state.phase,
      qid,
    };
    const before = prev.current;
    prev.current = now;
    if (!before) return;
    if (now.phase === 'ended' && before.phase !== 'ended') {
      confetti(5);
    } else if (now.section !== before.section && before.phase === 'live' && now.phase === 'live') {
      confetti(3);
    } else if (now.allIn && !before.allIn && now.qid === before.qid) {
      confetti(2);
    }
  }, [snapshot]);
}
