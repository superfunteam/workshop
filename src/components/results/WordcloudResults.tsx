import type { WordcloudQuestion } from '../../../shared/types.ts';
import { wordCounts } from '../../../shared/aggregate.ts';
import { dataColor } from '../bits.tsx';
import type { ResultsProps } from './index.tsx';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function WordcloudResults({ answers, big }: ResultsProps<WordcloudQuestion>) {
  const counts = wordCounts(answers);
  const max = Math.max(1, ...counts.map((c) => c.count));
  // Organic cloud: deterministic shuffle so it doesn't reflow on every push.
  const shuffled = [...counts].sort((a, b) => hash(a.word) - hash(b.word));
  const base = big ? 1.6 : 1.05;
  const top = big ? 6.5 : 3.6;

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2 py-6 text-center">
      {shuffled.map((c, i) => {
        const scale = c.count / max;
        return (
          <span
            key={c.word}
            className="animate-pop-in display-type inline-block"
            style={{
              fontSize: `${base + (top - base) * scale ** 1.4}rem`,
              color: c.count === max ? 'var(--color-ink)' : dataColor(i % 6),
              transform: `rotate(${((hash(c.word) % 5) - 2) * 1.2}deg)`,
              animationDelay: `${(i * 60) % 700}ms`,
              opacity: 0.55 + 0.45 * scale,
            }}
            title={`${c.count}×`}
          >
            {c.word}
            {c.count > 1 && <sup className="ml-0.5 font-sans text-[0.45em] font-bold text-ink-soft">×{c.count}</sup>}
          </span>
        );
      })}
    </div>
  );
}
