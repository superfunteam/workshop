import { describe, expect, it } from 'vitest';
import { sanitizeQuestion, sanitizeSections, sanitizeValue } from '../shared/sanitize.ts';
import { summarize } from '../shared/aggregate.ts';
import { toCsv, toMarkdown } from '../shared/export.ts';
import { starterSections } from '../src/lib/template.ts';
import { flatQuestions } from '../shared/flow.ts';
import type { SlideQuestion, StoredRoomConfig } from '../shared/types.ts';

describe('slide + discuss types', () => {
  it('sanitizes a slide (emoji capped, body kept)', () => {
    const q = sanitizeQuestion({ type: 'slide', prompt: 'Welcome', emoji: '👋👋👋👋👋👋', body: ' Hello there \n\n' });
    expect(q?.type).toBe('slide');
    const slide = q as SlideQuestion;
    expect(slide.body).toBe('Hello there');
    expect([...(slide.emoji ?? '')].length).toBeLessThanOrEqual(4);
  });

  it('rejects any answer submitted to a talk type', () => {
    const slide = sanitizeQuestion({ type: 'slide', prompt: 'Welcome' })!;
    const discuss = sanitizeQuestion({ type: 'discuss', prompt: 'Content?' })!;
    expect(sanitizeValue(slide, { text: 'sneaky' })).toBeNull();
    expect(sanitizeValue(discuss, { picks: [0] })).toBeNull();
  });

  it('summarizes talk types without answers', () => {
    const slide = sanitizeQuestion({ type: 'slide', prompt: 'Welcome' })!;
    const discuss = sanitizeQuestion({ type: 'discuss', prompt: 'Content?' })!;
    expect(summarize(slide, [])).toBe('Slide');
    expect(summarize(discuss, [])).toBe('Talked it out live');
  });
});

describe('starter template', () => {
  const sections = starterSections();

  it('survives server sanitization intact', () => {
    const clean = sanitizeSections(sections);
    expect(clean.map((s) => s.questions.length)).toEqual(sections.map((s) => s.questions.length));
    const types = clean.flatMap((s) => s.questions.map((q) => q.type));
    expect(types).toEqual(['slide', 'choice', 'postits', 'slider', 'discuss', 'inspo', 'open', 'slide']);
  });

  it('opens with an intro slide and closes with an outro slide', () => {
    const flat = flatQuestions({ code: 'T', name: 't', createdAt: 0, sections, settings: { autoReveal: false } });
    expect(flat[0].question.type).toBe('slide');
    expect(flat[flat.length - 1].question.type).toBe('slide');
    expect(flat[0].question.prompt).toMatch(/welcome/i);
  });

  it('contains the house question set in order', () => {
    const prompts = sections.flatMap((s) => s.questions.map((q) => q.prompt.toLowerCase()));
    expect(prompts.some((p) => p.includes('website goal'))).toBe(true);
    expect(prompts.some((p) => p.includes('champagne'))).toBe(true);
  });

  it('exports cleanly with slides and discussions in the deck', () => {
    const config: StoredRoomConfig = {
      code: 'TMPL',
      name: 'Template room',
      createdAt: 0,
      sections: sanitizeSections(sections),
      settings: { autoReveal: false },
      hostKey: 'k',
    };
    const md = toMarkdown({ config, participants: [], answers: {} });
    expect(md).toContain('Welcome to the workshop');
    expect(md).toContain('Discussed live');
    const csv = toCsv({ config, participants: [], answers: {} });
    expect(csv.split('\r\n')).toHaveLength(1); // header only — no phantom rows from talk types
  });
});
