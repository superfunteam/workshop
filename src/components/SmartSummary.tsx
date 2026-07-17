// The Smart Summary view: Opus reads the entire session — every answer, vote,
// sticky note, scratchpad line, and reaction — and returns a structured
// strategy report. Generation outlives any single request, so this component
// polls open-endedly until the report lands.

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { SummaryReport, SummaryState } from '../../shared/types.ts';
import { normalizeReport } from '../../shared/report.ts';
import { api } from '../lib/api.ts';
import { BOUNCE, riseChild, staggerParent } from '../lib/springs.ts';
import { dataColor } from './bits.tsx';
import AnimatedEmoji from './AnimatedEmoji.tsx';
import Icon from './Icon.tsx';

const POLL_MS = 2_500;

const THINKING_LINES = [
  'reading every sticky note…',
  'weighing the dot votes…',
  'comparing the sliders…',
  'cross-referencing the scratchpad…',
  'looking for the contradictions…',
  'drafting action items…',
  'sharpening the headline…',
];

const EFFORT_META = {
  quick_win: { label: 'Quick win', icon: 'bolt', hue: '#1f9e82' },
  project: { label: 'Project', icon: 'calendar_month', hue: '#3e7fd6' },
  big_bet: { label: 'Big bet', icon: 'rocket_launch', hue: '#8b5cf6' },
} as const;

export default function SmartSummary({ code, hostKey }: { code: string; hostKey: string | null }) {
  const [state, setState] = useState<SummaryState | null>(null);
  const [kicking, setKicking] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setState(await api.summary(code));
    } catch {
      /* transient — next poll heals */
    }
  }, [code]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Open-ended polling while a run is in flight.
  useEffect(() => {
    if (state?.status !== 'running') return;
    timer.current = window.setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer.current);
  }, [state?.status, refresh]);

  const generate = async () => {
    if (!hostKey) return;
    setKicking(true);
    try {
      setState(await api.generateSummary(code, hostKey));
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : 'could not start' });
    } finally {
      setKicking(false);
    }
  };

  if (!state) {
    return (
      <div className="flex justify-center py-16">
        <div className="thinking-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (state.status === 'running') return <Thinking />;

  if (state.status === 'ready' && state.report) {
    // Reports stored before validation existed (or from degraded model output)
    // get coerced here; anything truly unusable falls through to the pitch card.
    const report = normalizeReport(state.report);
    if (report) {
      return (
        <ReportBoundary
          fallback={
            <BrokenReport onRegenerate={hostKey ? generate : undefined} busy={kicking} />
          }
        >
          <Report
            report={report}
            model={state.model}
            generatedAt={state.generatedAt}
            onRegenerate={hostKey ? generate : undefined}
            regenBusy={kicking}
          />
        </ReportBoundary>
      );
    }
  }

  // none / error → the pitch card
  return (
    <div className="card-pop mx-auto max-w-xl p-8 text-center">
      <AnimatedEmoji emoji="✨" size={72} />
      <h2 className="display-type mt-3 text-3xl">Smart Summary</h2>
      <p className="mx-auto mt-2 max-w-md font-medium text-ink-soft">
        Claude reads the entire session — every answer, vote, sticky note, and your scratchpad —
        and writes the strategy memo: key findings, where the room agrees, the tensions, and action items.
      </p>
      {state.status === 'error' && (
        <p className="mx-auto mt-4 max-w-md rounded-xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">
          {state.error ?? 'Something went wrong — try again.'}
        </p>
      )}
      <div className="mt-6">
        {hostKey ? (
          <button
            type="button"
            className="btn-pop bg-ink text-white hover:bg-ink/90 px-6 py-2.5 text-lg"
            disabled={kicking}
            onClick={() => void generate()}
          >
            <Icon name="auto_awesome" size={18} /> {kicking ? 'Starting…' : state.status === 'error' ? 'Try again' : 'Generate the summary'}
          </button>
        ) : (
          <p className="text-sm font-semibold text-ink-faint">Ask the host to generate it — then it shows here for everyone.</p>
        )}
      </div>
      <p className="mt-4 text-xs font-semibold text-ink-faint">Takes a minute or so · powered by Claude Opus via Netlify AI Gateway</p>
    </div>
  );
}

class ReportBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  render() {
    return this.state.broken ? this.props.fallback : this.props.children;
  }
}

function BrokenReport({ onRegenerate, busy }: { onRegenerate?: () => Promise<void>; busy: boolean }) {
  return (
    <div className="card-pop mx-auto max-w-xl p-8 text-center">
      <AnimatedEmoji emoji="🫠" size={64} />
      <h2 className="display-type mt-3 text-2xl">That report came back scrambled</h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-ink-soft">
        The model returned something we couldn't fully read. Regenerating usually fixes it.
      </p>
      {onRegenerate && (
        <button
          type="button"
          className="btn-pop bg-ink text-white hover:bg-ink/90 mt-5"
          disabled={busy}
          onClick={() => void onRegenerate()}
        >
          <Icon name="refresh" size={16} /> {busy ? 'Starting…' : 'Regenerate'}
        </button>
      )}
    </div>
  );
}

function Thinking() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((n) => (n + 1) % THINKING_LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="card-pop mx-auto max-w-xl p-8 text-center">
      <AnimatedEmoji emoji="🤖" size={72} />
      <h2 className="display-type mt-3 text-2xl">Reading the room…</h2>
      <p className="mt-2 h-6 font-semibold text-ink-soft" aria-live="polite">
        {THINKING_LINES[line]}
      </p>
      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5" aria-hidden>
        {[92, 100, 74, 88].map((w, i) => (
          <div key={i} className="h-3.5 animate-pulse rounded-full bg-ink/8" style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      <p className="mt-6 text-xs font-semibold text-ink-faint">
        Opus is writing the full report — usually under a minute. This page keeps checking; feel free to look at the recap meanwhile.
      </p>
    </div>
  );
}

function Report({
  report,
  model,
  generatedAt,
  onRegenerate,
  regenBusy,
}: {
  report: SummaryReport;
  model?: string;
  generatedAt?: number;
  onRegenerate?: () => Promise<void>;
  regenBusy: boolean;
}) {
  return (
    <motion.div variants={staggerParent(0.06)} initial="hidden" animate="show" className="flex flex-col gap-10">
      {/* hero */}
      <motion.section variants={riseChild} className="text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest text-ink-soft uppercase">
          <Icon name="auto_awesome" size={14} /> Smart Summary
        </span>
        <h2 className="display-type mx-auto mt-3 max-w-3xl text-4xl sm:text-5xl">{report.headline}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-ink-soft">{report.room_read}</p>
      </motion.section>

      {/* key findings */}
      <motion.section variants={riseChild}>
        <SectionTitle icon="key" title="Key findings" />
        <div className="grid gap-3 sm:grid-cols-2">
          {report.key_findings.map((f, i) => (
            <div key={i} className="card-pop p-5">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: dataColor(i) }}
              >
                {i + 1}
              </span>
              <h3 className="mt-2.5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm font-medium text-ink-soft">{f.detail}</p>
              {f.evidence && (
                <p className="mt-2.5 border-t border-line pt-2 text-xs font-medium text-ink-faint">
                  <Icon name="fact_check" size={13} /> {f.evidence}
                </p>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* agreements vs tensions */}
      <motion.section variants={riseChild} className="grid gap-3 sm:grid-cols-2">
        <div className="card-pop p-5" style={{ background: '#1f9e820d' }}>
          <SectionTitle icon="handshake" title="Where the room agrees" hue="#1f9e82" />
          <ul className="flex flex-col gap-2.5">
            {report.agreements.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm font-medium">
                <Icon name="check_circle" size={17} style={{ color: '#1f9e82' }} className="mt-0.5 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="card-pop p-5" style={{ background: '#e4573d0d' }}>
          <SectionTitle icon="bolt" title="Tensions to talk about" hue="#e4573d" />
          <ul className="flex flex-col gap-2.5">
            {report.tensions.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm font-medium">
                <Icon name="priority_high" size={17} style={{ color: '#e4573d' }} className="mt-0.5 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      {/* weak points */}
      {report.weak_points.length > 0 && (
        <motion.section variants={riseChild}>
          <SectionTitle icon="report" title="Weak points" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.weak_points.map((w, i) => (
              <div key={i} className="rounded-2xl border border-line bg-white p-4">
                <h3 className="flex items-start gap-2 font-semibold">
                  <Icon name="warning" size={17} style={{ color: '#b3820e' }} className="mt-0.5 shrink-0" />
                  {w.title}
                </h3>
                <p className="mt-1.5 text-sm font-medium text-ink-soft">{w.detail}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* action items */}
      <motion.section variants={riseChild}>
        <SectionTitle icon="checklist" title="Action items" />
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {report.action_items.map((a, i) => {
            const effort = EFFORT_META[a.effort] ?? EFFORT_META.project;
            return (
              <div key={i} className={`flex items-start gap-3.5 p-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{a.title}</h3>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: `${effort.hue}1a`, color: effort.hue }}
                    >
                      <Icon name={effort.icon} size={12} /> {effort.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink-soft">{a.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* quotes */}
      {report.quotes.length > 0 && (
        <motion.section variants={riseChild}>
          <SectionTitle icon="format_quote" title="Worth quoting back" />
          <div className="grid gap-3 sm:grid-cols-2">
            {report.quotes.map((q, i) => (
              <motion.figure
                key={i}
                initial={{ opacity: 0, y: 16, rotate: i % 2 ? 1 : -1 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...BOUNCE, delay: i * 0.08 }}
                className="card-pop bg-paper p-5"
              >
                <blockquote className="text-lg leading-snug font-medium">“{q.text}”</blockquote>
                {q.why && <figcaption className="mt-2 text-xs font-semibold text-ink-soft">{q.why}</figcaption>}
              </motion.figure>
            ))}
          </div>
        </motion.section>
      )}

      {/* section notes */}
      {report.section_notes.length > 0 && (
        <motion.section variants={riseChild}>
          <SectionTitle icon="segment" title="Section by section" />
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {report.section_notes.map((s, i) => (
              <div key={i} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <span className="chip bg-ink/5 text-xs">{s.section}</span>
                <p className="min-w-0 flex-1 text-sm font-medium text-ink-soft">{s.note}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      <motion.footer variants={riseChild} className="flex flex-wrap items-center justify-center gap-3 border-t border-line pt-5 text-xs font-semibold text-ink-faint">
        <span>
          <Icon name="auto_awesome" size={13} /> Generated by {model ?? 'Claude'}
          {generatedAt ? ` · ${new Date(generatedAt).toLocaleString()}` : ''}
        </span>
        {onRegenerate && (
          <button
            type="button"
            className="cursor-pointer text-ink-soft underline-offset-2 hover:underline"
            disabled={regenBusy}
            onClick={() => void onRegenerate()}
          >
            <Icon name="refresh" size={13} /> {regenBusy ? 'Starting…' : 'Regenerate'}
          </button>
        )}
      </motion.footer>
    </motion.div>
  );
}

function SectionTitle({ icon, title, hue }: { icon: string; title: string; hue?: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-widest text-ink-soft uppercase">
      <Icon name={icon} size={16} style={hue ? { color: hue } : undefined} /> {title}
    </h2>
  );
}
