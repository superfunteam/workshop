import { describe, expect, it } from 'vitest';
import { hostKey, normalizeCode, rid, roomCode } from '../shared/codes.ts';
import { allAnswered, isOnline, publicParticipants, waitingOn } from '../shared/presence.ts';
import { currentQuestion, flatQuestions, freshState, nextPosition, prevPosition } from '../shared/flow.ts';
import { answer, makeConfig, makeParticipants } from './fixtures.ts';
import { ONLINE_WINDOW_MS } from '../shared/types.ts';

describe('codes', () => {
  it('makes 4-char codes from the safe alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = roomCode();
      expect(code).toMatch(/^[ACDEFGHJKMNPQRTUVWXYZ234679]{4}$/);
    }
  });
  it('normalizes user input', () => {
    expect(normalizeCode('  kr-wx ')).toBe('KRWX');
    expect(normalizeCode('krwx')).toBe('KRWX');
  });
  it('makes distinct ids and long host keys', () => {
    expect(rid()).not.toBe(rid());
    expect(hostKey()).toHaveLength(24);
  });
});

describe('presence', () => {
  const now = 1_752_400_000_000;
  const people = makeParticipants(now);

  it('flags online within the window, excludes removed', () => {
    const pub = publicParticipants(people, now);
    expect(pub.map((p) => p.pid)).not.toContain('p4');
    expect(pub.find((p) => p.pid === 'p1')?.online).toBe(true);
    expect(pub.find((p) => p.pid === 'p3')?.online).toBe(false);
  });

  it('online participants sort first', () => {
    const pub = publicParticipants(people, now);
    expect(pub[pub.length - 1].pid).toBe('p3');
  });

  it('exact window edge still counts as online', () => {
    const p = { pid: 'x', name: 'X', avatar: '🐢', joinedAt: 0, lastSeen: now - ONLINE_WINDOW_MS };
    expect(isOnline(p, now)).toBe(true);
    expect(isOnline({ ...p, lastSeen: now - ONLINE_WINDOW_MS - 1 }, now)).toBe(false);
  });

  it('allAnswered only counts online people', () => {
    const pub = publicParticipants(people, now);
    // p1 and p2 online; p3 offline
    expect(allAnswered(pub, ['p1'])).toBe(false);
    expect(allAnswered(pub, ['p1', 'p2'])).toBe(true);
    expect(allAnswered(pub, ['p1', 'p2', 'p3'])).toBe(true);
    expect(allAnswered([], [])).toBe(false);
  });

  it('waitingOn lists online non-answerers', () => {
    const pub = publicParticipants(people, now);
    expect(waitingOn(pub, ['p1']).map((p) => p.pid)).toEqual(['p2']);
  });
});

describe('flow', () => {
  const config = makeConfig();

  it('flattens sections in order', () => {
    const flat = flatQuestions(config);
    expect(flat).toHaveLength(8);
    expect(flat[0].question.id).toBe('q-choice');
    expect(flat[2].question.id).toBe('q-postits');
    expect(flat[0].total).toBe(8);
    expect(flat[7].n).toBe(7);
  });

  it('steps forward across the section boundary', () => {
    const state = { ...freshState(), current: { section: 0, question: 1 } };
    expect(nextPosition(config, state)).toEqual({ section: 1, question: 0 });
  });

  it('steps backward and stops at the ends', () => {
    const state = { ...freshState(), current: { section: 1, question: 0 } };
    expect(prevPosition(config, state)).toEqual({ section: 0, question: 1 });
    expect(prevPosition(config, freshState())).toBeNull();
    const last = { ...freshState(), current: { section: 1, question: 5 } };
    expect(nextPosition(config, last)).toBeNull();
  });

  it('clamps when current position no longer exists', () => {
    const state = { ...freshState(), current: { section: 9, question: 9 } };
    expect(nextPosition(config, state)).toEqual({ section: 0, question: 0 });
  });

  it('finds the current question', () => {
    const state = { ...freshState(), current: { section: 1, question: 1 } };
    expect(currentQuestion(config, state)?.question.id).toBe('q-open');
    expect(currentQuestion(config, { ...freshState(), current: { section: 5, question: 0 } })).toBeNull();
  });

  it('handles a config with no questions', () => {
    const empty = { ...config, sections: [] };
    expect(flatQuestions(empty)).toHaveLength(0);
    expect(nextPosition(empty, freshState())).toBeNull();
    expect(currentQuestion(empty, freshState())).toBeNull();
  });
});

describe('answer fixtures line up with config', () => {
  it('question ids referenced in tests exist', () => {
    const ids = flatQuestions(makeConfig()).map((f) => f.question.id);
    for (const qid of ['q-choice', 'q-slider', 'q-postits', 'q-open', 'q-words', 'q-dots', 'q-rank', 'q-inspo']) {
      expect(ids).toContain(qid);
    }
    expect(answer('p1', 'q-choice', { picks: [0] }).pid).toBe('p1');
  });
});

describe('onlineAnswered', () => {
  it('never exceeds the online count (ghost answers don’t inflate progress)', async () => {
    const { onlineAnswered } = await import('../shared/presence.ts');
    const now = 1_752_400_000_000;
    const pub = publicParticipants(makeParticipants(now), now);
    // p3 is offline but answered; p1 online answered; p2 online not answered
    expect(onlineAnswered(pub, ['p1', 'p3'])).toBe(1);
    expect(onlineAnswered(pub, ['p1', 'p2', 'p3'])).toBe(2);
  });
});
