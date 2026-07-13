// Choice + dot-vote reveal: chunky bars springing to width, direct-labeled in
// ink (never color-alone), voters chipped under each option when not anonymous.

import { motion } from 'motion/react';
import type { ChoiceQuestion, DotvoteQuestion } from '../../../shared/types.ts';
import { rankedTallies } from '../../../shared/aggregate.ts';
import { dataColor } from '../bits.tsx';
import { SLIDE, riseChild, staggerParent } from '../../lib/springs.ts';
import { AuthorChip, type ResultsProps } from './index.tsx';

export default function BarResults({
  question,
  answers,
  participants,
  big,
}: ResultsProps<ChoiceQuestion | DotvoteQuestion>) {
  const tallies = rankedTallies(question, answers);
  const max = Math.max(1, ...tallies.map((t) => t.count));
  const unit = question.type === 'dotvote' ? 'dots' : 'votes';
  const showAuthors = !question.anonymous && answers.some((a) => a.pid);

  return (
    <motion.div variants={staggerParent(0.07)} initial="hidden" animate="show" className="flex w-full flex-col gap-4">
      {tallies.map((t, rank) => (
        <motion.div key={t.index} variants={riseChild}>
          <div className={`mb-1 flex items-baseline justify-between gap-3 font-display font-bold ${big ? 'text-3xl' : 'text-lg'}`}>
            <span>
              {rank === 0 && t.count > 0 && (
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 16, delay: 0.5 }}
                  className="inline-block"
                  aria-hidden
                >
                  👑{' '}
                </motion.span>
              )}
              {t.option}
            </span>
            <span className={`tabular-nums ${big ? 'text-2xl' : 'text-base'}`}>
              {t.count} <span className="text-ink-soft text-[0.7em] font-sans font-semibold">{unit}</span>
            </span>
          </div>
          <div className={`w-full overflow-hidden rounded-full border border-line bg-white ${big ? 'h-9' : 'h-6'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(t.count / max) * 100}%` }}
              transition={{ ...SLIDE, delay: 0.1 + rank * 0.07 }}
              className="h-full rounded-full border-r border-line"
              style={{
                background: dataColor(t.index),
                borderRightWidth: t.count === 0 ? 0 : undefined,
              }}
            />
          </div>
          {showAuthors && t.pids.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {[...new Set(t.pids)].map((pid) => (
                <AuthorChip key={pid} participants={participants} pid={pid} />
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
