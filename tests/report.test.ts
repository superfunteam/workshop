import { describe, expect, it } from 'vitest';
import { normalizeReport } from '../shared/report.ts';

describe('normalizeReport', () => {
  it('passes a clean report through', () => {
    const r = normalizeReport({
      headline: 'Big story',
      room_read: 'Aligned room.',
      key_findings: [{ title: 'A', detail: 'B', evidence: 'C' }],
      agreements: ['x'],
      tensions: ['y'],
      weak_points: [{ title: 'W', detail: 'D' }],
      action_items: [{ title: 'Do', detail: 'It', effort: 'quick_win' }],
      quotes: [{ text: 'hi' }],
      section_notes: [{ section: 'S', note: 'N' }],
    });
    expect(r?.key_findings).toHaveLength(1);
    expect(r?.action_items[0].effort).toBe('quick_win');
  });

  it('rescues the degraded parameter-wrapped tool output (the 6YUV failure)', () => {
    const r = normalizeReport({
      headline: 'A fun game',
      room_read: 'Small room.',
      key_findings: '\n<parameter name="key_findings">[{"title":"The site\'s job is funding","detail":"Two of three chose it."}]</parameter>',
      agreements: '\n<parameter name="agreements">["The product is fun — everyone said so"]',
      tensions: '\n<parameter name="tensions">["Fun vs corporate is unresolved"]</parameter>',
      weak_points: '\n<parameter name="weak_points">[{"title":"No social","detail":"Flagged twice"}]',
      action_items: '\n<parameter name="action_items">[{"title":"Resolve tone","detail":"One meeting","effort":"quick_win"}]',
      quotes: '\n<parameter name="quotes">[{"text":"everyone tells their family","why":"organic love"}]',
      section_notes: '\n<parameter name="section_notes">[{"section":"Goal","note":"Funding beat customers"}]',
    });
    expect(r).not.toBeNull();
    expect(r?.key_findings[0].title).toContain('funding');
    expect(r?.agreements).toEqual(['The product is fun — everyone said so']);
    expect(r?.tensions).toHaveLength(1);
    expect(r?.action_items[0].effort).toBe('quick_win');
    expect(r?.quotes[0].why).toBe('organic love');
  });

  it('coerces junk item shapes instead of crashing', () => {
    const r = normalizeReport({
      headline: 'H',
      room_read: '',
      key_findings: { 0: { title: 'From object' }, 1: 'garbage' },
      agreements: [{ text: 'object agreement' }, 42, ''],
      tensions: 'not json at all',
      weak_points: null,
      action_items: [{ title: 'Do', detail: 'x', effort: 'sideways' }],
      quotes: ['bare string quote'],
      section_notes: [{}],
    });
    expect(r).not.toBeNull();
    expect(r?.key_findings).toEqual([{ title: 'From object', detail: '', evidence: undefined }]);
    expect(r?.agreements).toEqual(['object agreement']);
    expect(r?.tensions).toEqual([]);
    expect(r?.action_items[0].effort).toBe('project');
    expect(r?.quotes[0].text).toBe('bare string quote');
    expect(r?.section_notes).toEqual([]);
  });

  it('returns null for reports with no usable substance', () => {
    expect(normalizeReport(null)).toBeNull();
    expect(normalizeReport('nope')).toBeNull();
    expect(normalizeReport({ headline: '', room_read: '', key_findings: [], agreements: [], tensions: [], weak_points: [], action_items: [], quotes: [], section_notes: [] })).toBeNull();
  });
});
