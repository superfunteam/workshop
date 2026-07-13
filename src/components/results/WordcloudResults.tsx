import { motion } from 'motion/react';
import type { WordcloudQuestion } from '../../../shared/types.ts';
import { wordCounts } from '../../../shared/aggregate.ts';
import { dataColor } from '../bits.tsx';
import { BOUNCE } from '../../lib/springs.ts';
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
          <motion.span
            key={c.word}
            initial={{ opacity: 0, scale: 0.2, rotate: -12 }}
            animate={{
              opacity: 0.55 + 0.45 * scale,
              scale: 1,
              rotate: ((hash(c.word) % 5) - 2) * 1.2,
            }}
            whileHover={{ scale: 1.12, rotate: 0, opacity: 1 }}
            transition={{ ...BOUNCE, delay: ((i * 60) % 700) / 1000 }}
            className="display-type inline-block cursor-default"
            style={{
              fontSize: `${base + (top - base) * scale ** 1.4}rem`,
              color: c.count === max ? 'var(--color-ink)' : dataColor(i % 6),
            }}
            title={`${c.count}×`}
          >
            {c.word}
            {c.count > 1 && <sup className="ml-0.5 font-sans text-[0.45em] font-bold text-ink-soft">×{c.count}</sup>}
          </motion.span>
        );
      })}
    </div>
  );
}
