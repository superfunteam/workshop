import { motion } from 'motion/react';
import type { RankQuestion } from '../../../shared/types.ts';
import { rankResults } from '../../../shared/aggregate.ts';
import { BOUNCE } from '../../lib/springs.ts';
import type { ResultsProps } from './index.tsx';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankResults({ question, answers, big }: ResultsProps<RankQuestion>) {
  const results = rankResults(question, answers);
  return (
    <div className="flex w-full flex-col gap-3">
      {results.map((r, i) => (
        <motion.div
          key={r.index}
          initial={{ opacity: 0, x: -60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ ...BOUNCE, delay: 0.15 + i * 0.13 }}
          className={`card-pop flex items-center gap-4 px-5 ${big ? 'py-5' : 'py-3'} ${i === 0 ? 'bg-sun/60' : 'bg-white'}`}
          style={{ marginLeft: `${i * (big ? 14 : 8)}px` }}
        >
          <motion.span
            initial={{ scale: 0, rotate: -35 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...BOUNCE, delay: 0.3 + i * 0.13 }}
            className={`${big ? 'text-5xl' : 'text-3xl'}`}
            aria-hidden
          >
            {MEDALS[i] ?? `${i + 1}.`}
          </motion.span>
          <span className={`display-type flex-1 ${big ? 'text-4xl' : 'text-xl'}`}>{r.option}</span>
          <span className={`font-semibold text-ink-soft ${big ? 'text-xl' : 'text-sm'}`}>
            {r.avgPosition === null ? 'unranked' : `avg #${r.avgPosition}`}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
