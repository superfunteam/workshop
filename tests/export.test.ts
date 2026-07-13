import { describe, expect, it } from 'vitest';
import { csvEscape, toCsv, toMarkdown, type SessionData } from '../shared/export.ts';
import { answer, makeConfig, makeParticipants } from './fixtures.ts';

const now = 1_752_400_000_000;

function sessionData(): SessionData {
  return {
    config: makeConfig(),
    participants: makeParticipants(now),
    answers: {
      'q-choice': [answer('p1', 'q-choice', { picks: [0] }), answer('p2', 'q-choice', { picks: [2] })],
      'q-slider': [answer('p1', 'q-slider', { value: 30 }), answer('p2', 'q-slider', { value: 70 })],
      'q-postits': [
        answer('p1', 'q-postits', {
          notes: [
            { id: 'n1', category: 0, text: 'Nice, "bold" type' },
            { id: 'n2', category: 1, text: 'Slow pages' },
          ],
        }),
      ],
      'q-open': [answer('p2', 'q-open', { text: 'Acme makes delightful robots,\nfor everyone.' })],
      'q-words': [answer('p1', 'q-words', { words: ['Bold', 'Warm'] })],
      'q-dots': [answer('p1', 'q-dots', { dots: [2, 0, 1, 0] })],
      'q-rank': [answer('p2', 'q-rank', { order: [1, 0, 2] })],
      'q-inspo': [answer('p1', 'q-inspo', { items: [{ id: 'i1', kind: 'link', url: 'https://stripe.com' }] })],
    },
    scratch: 'CEO hates the mascot. Revisit Thursday.',
    events: [
      { id: 'e1', pid: 'p1', name: 'Dana', avatar: '🦊', emoji: '❤️', ts: now },
      { id: 'e2', pid: 'p2', name: 'Sam', avatar: '🐙', emoji: '❤️', ts: now },
      { id: 'e3', pid: 'p1', name: 'Dana', avatar: '🦊', emoji: '😂', ts: now },
    ],
  };
}

describe('markdown export', () => {
  const md = toMarkdown(sessionData());

  it('has the session header and participant roster (minus removed)', () => {
    expect(md).toContain('# Acme Brand Workshop');
    expect(md).toContain('🦊 Dana');
    expect(md).not.toContain('Gone');
  });

  it('renders every section and question', () => {
    expect(md).toContain('## Warm up');
    expect(md).toContain('## Dig in');
    expect(md).toContain('### How do we feel about the current logo?');
    expect(md).toContain('**Love it**: 1 votes');
  });

  it('respects anonymous questions', () => {
    // q-open is anonymous: the quote appears but not attributed to Sam
    expect(md).toContain('Acme makes delightful robots,');
    const openSection = md.slice(md.indexOf('### One sentence'), md.indexOf('### Three words'));
    expect(openSection).not.toContain('Sam');
    expect(openSection).toContain('Anonymous');
  });

  it('includes slider stats, scratchpad, and reaction stats', () => {
    expect(md).toContain('**Average: 50/100**');
    expect(md).toContain('## Host scratchpad');
    expect(md).toContain('CEO hates the mascot');
    expect(md).toContain('❤️ ×2');
  });
});

describe('csv export', () => {
  const csv = toCsv(sessionData());
  const lines = csv.split('\r\n');

  it('escapes quotes, commas, and newlines', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('two\nlines')).toBe('"two\nlines"');
  });

  it('has a header and one row per atomic answer', () => {
    expect(lines[0]).toBe('section,question,type,participant,value,detail,answered_at');
    // 2 choice picks + 2 sliders + 2 notes + 1 open + 2 words + 2 dot rows + 3 rank rows + 1 inspo = 15
    expect(lines).toHaveLength(1 + 15);
  });

  it('keeps quoted multiline answers on one logical row', () => {
    expect(csv).toContain('"Acme makes delightful robots,\nfor everyone."');
  });

  it('masks anonymous participants', () => {
    const openRow = lines.find((l) => l.includes('Acme makes delightful robots'));
    expect(openRow).toContain('Anonymous');
    expect(openRow).not.toContain('Sam');
  });

  it('labels dot votes and ranks', () => {
    expect(csv).toContain('2 dots');
    expect(csv).toContain('rank 1');
  });
});
