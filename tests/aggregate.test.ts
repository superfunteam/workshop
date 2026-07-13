import { describe, expect, it } from 'vitest';
import {
  inspoItems,
  openAnswers,
  postitsByCategory,
  rankResults,
  rankedTallies,
  sliderStats,
  summarize,
  tallyOptions,
  wordCounts,
} from '../shared/aggregate.ts';
import { answer, makeConfig } from './fixtures.ts';
import type { ChoiceQuestion, DotvoteQuestion, PostitsQuestion, RankQuestion } from '../shared/types.ts';
import { flatQuestions } from '../shared/flow.ts';

const config = makeConfig();
const q = (id: string) => flatQuestions(config).find((f) => f.question.id === id)!.question;

describe('choice tallies', () => {
  const choice = q('q-choice') as ChoiceQuestion;
  it('counts picks per option and tracks voters', () => {
    const tallies = tallyOptions(choice, [
      answer('p1', 'q-choice', { picks: [0] }),
      answer('p2', 'q-choice', { picks: [2] }),
      answer('p3', 'q-choice', { picks: [2] }),
    ]);
    expect(tallies.map((t) => t.count)).toEqual([1, 0, 2]);
    expect(tallies[2].pids).toEqual(['p2', 'p3']);
  });
  it('ignores out-of-range picks and sorts ranked view', () => {
    const ranked = rankedTallies(choice, [
      answer('p1', 'q-choice', { picks: [2, 99] }),
      answer('p2', 'q-choice', { picks: [2] }),
      answer('p3', 'q-choice', { picks: [0] }),
    ]);
    expect(ranked[0].option).toBe('Burn it');
    expect(ranked[0].count).toBe(2);
  });
});

describe('dot voting', () => {
  const dots = q('q-dots') as DotvoteQuestion;
  it('sums dots across people', () => {
    const ranked = rankedTallies(dots, [
      answer('p1', 'q-dots', { dots: [2, 1, 0, 0] }),
      answer('p2', 'q-dots', { dots: [1, 0, 0, 2] }),
    ]);
    expect(ranked[0].option).toBe('Website');
    expect(ranked[0].count).toBe(3);
    expect(ranked.find((t) => t.option === 'Voice')?.count).toBe(0);
  });
});

describe('slider stats', () => {
  it('averages and measures spread', () => {
    const s = sliderStats([
      answer('p1', 'q-slider', { value: 20 }),
      answer('p2', 'q-slider', { value: 40 }),
      answer('p3', 'q-slider', { value: 90 }),
    ]);
    expect(s.average).toBe(50);
    expect(s.min).toBe(20);
    expect(s.max).toBe(90);
    expect(s.spread).toBeGreaterThan(20);
  });
  it('handles empty', () => {
    expect(sliderStats([]).average).toBeNull();
  });
});

describe('post-its', () => {
  const postits = q('q-postits') as PostitsQuestion;
  it('groups notes by category with attribution, drops blanks and bad categories', () => {
    const groups = postitsByCategory(postits, [
      answer('p1', 'q-postits', {
        notes: [
          { id: 'n1', category: 0, text: 'Great photography' },
          { id: 'n2', category: 1, text: 'Slow homepage' },
          { id: 'n3', category: 1, text: '   ' },
          { id: 'n4', category: 7, text: 'lost' },
        ],
      }),
      answer('p2', 'q-postits', { notes: [{ id: 'n5', category: 1, text: 'Confusing nav' }] }),
    ]);
    expect(groups[0].notes.map((n) => n.text)).toEqual(['Great photography']);
    expect(groups[1].notes.map((n) => n.text)).toEqual(['Slow homepage', 'Confusing nav']);
    expect(groups[1].notes[1].pid).toBe('p2');
  });
});

describe('word cloud', () => {
  it('groups case-insensitively, keeps first casing, sorts by count', () => {
    const counts = wordCounts([
      answer('p1', 'q-words', { words: ['Bold', 'fresh'] }),
      answer('p2', 'q-words', { words: ['bold', 'Warm'] }),
      answer('p3', 'q-words', { words: ['BOLD', ' '] }),
    ]);
    expect(counts[0]).toMatchObject({ word: 'Bold', count: 3 });
    expect(counts.map((c) => c.word).sort()).toEqual(['Bold', 'Warm', 'fresh'].sort());
  });
});

describe('ranking', () => {
  const rank = q('q-rank') as RankQuestion;
  it('averages positions, best first', () => {
    const results = rankResults(rank, [
      answer('p1', 'q-rank', { order: [0, 1, 2] }), // Awareness, Trust, Conversion
      answer('p2', 'q-rank', { order: [1, 0, 2] }),
    ]);
    expect(results[0].option).toMatch(/Awareness|Trust/);
    expect(results[2].option).toBe('Conversion');
    expect(results[2].avgPosition).toBe(3);
  });
  it('penalizes skipped options for partial rankings', () => {
    const results = rankResults(rank, [answer('p1', 'q-rank', { order: [2] })]);
    expect(results[0].option).toBe('Conversion');
    expect(results[0].avgPosition).toBe(1);
    // The two skipped options got position order.length+1 = 2
    expect(results[1].avgPosition).toBe(2);
  });
});

describe('open + inspo', () => {
  it('drops empty open answers', () => {
    const list = openAnswers([
      answer('p1', 'q-open', { text: '  We make robots.  ' }),
      answer('p2', 'q-open', { text: '' }),
    ]);
    expect(list).toEqual([{ pid: 'p1', text: 'We make robots.' }]);
  });
  it('flattens inspo items with attribution', () => {
    const items = inspoItems([
      answer('p1', 'q-inspo', { items: [{ id: 'i1', kind: 'link', url: 'https://stripe.com' }] }),
      answer('p2', 'q-inspo', { items: [{ id: 'i2', kind: 'image', url: 'https://x.com/a.png', note: 'palette' }] }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[1].note).toBe('palette');
  });
});

describe('summaries', () => {
  it('gives useful one-liners', () => {
    expect(summarize(q('q-choice'), [])).toBe('No answers');
    expect(
      summarize(q('q-choice'), [answer('p1', 'q-choice', { picks: [2] }), answer('p2', 'q-choice', { picks: [2] })]),
    ).toContain('Burn it');
    expect(summarize(q('q-slider'), [answer('p1', 'q-slider', { value: 80 })])).toContain('80');
    expect(summarize(q('q-words'), [answer('p1', 'q-words', { words: ['bold'] })])).toContain('bold');
  });
});
