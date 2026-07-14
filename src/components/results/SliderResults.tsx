// Everyone's vote lands on the track as their avatar; the group average gets
// the big flag. Spread gets a plain-language read: agreement or a split room.

import { motion } from 'motion/react';
import type { SliderQuestion } from '../../../shared/types.ts';
import { sliderStats } from '../../../shared/aggregate.ts';
import { BOUNCE, SLIDE } from '../../lib/springs.ts';
import { personFor, type ResultsProps } from './index.tsx';

export default function SliderResults({ question, answers, participants, big }: ResultsProps<SliderQuestion>) {
  const stats = sliderStats(answers);
  if (stats.average === null) return null;
  const verdict =
    stats.spread !== null && stats.spread <= 12
      ? 'The room agrees 🤝'
      : stats.spread !== null && stats.spread >= 30
        ? 'Split room — talk about it 👀'
        : 'Some range in the room';

  // Cheap collision handling: stack same-bucket avatars vertically.
  const buckets = new Map<number, typeof stats.values>();
  for (const v of stats.values) {
    const b = Math.round(v.value / 4);
    buckets.set(b, [...(buckets.get(b) ?? []), v]);
  }

  return (
    <div className="w-full py-4">
      <div className={`mb-10 flex justify-between font-display font-semibold ${big ? 'text-4xl' : 'text-xl'}`}>
        <span>← {question.left}</span>
        <span>{question.right} →</span>
      </div>
      <div className="relative mx-4">
        <div className={`w-full overflow-hidden rounded-full border border-line bg-white ${big ? 'h-7' : 'h-5'}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.average}%` }}
            transition={{ ...SLIDE, delay: 0.25 }}
            className="h-full rounded-l-full bg-note-sky/70"
          />
        </div>
        {[...buckets.entries()].map(([bucket, list]) =>
          list.map((v, stackIdx) => {
            const person = question.anonymous ? null : personFor(participants, v.pid);
            return (
              <motion.span
                key={`${bucket}-${stackIdx}`}
                initial={{ opacity: 0, y: -56, scale: 0.3 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...BOUNCE, delay: ((bucket * 17 + stackIdx * 90) % 500) / 1000 }}
                className={`absolute -translate-x-1/2 select-none ${big ? 'text-4xl' : 'text-2xl'}`}
                style={{
                  left: `${v.value}%`,
                  bottom: `${(big ? 34 : 24) + stackIdx * (big ? 34 : 26)}px`,
                }}
                title={person ? `${person.name}: ${v.value}` : String(v.value)}
              >
                {person?.avatar ?? '●'}
              </motion.span>
            );
          }),
        )}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...BOUNCE, delay: 0.55 }}
          className="absolute -bottom-12 -translate-x-1/2 text-center"
          style={{ left: `${stats.average}%` }}
        >
          <div className="mx-auto h-8 w-1 rounded bg-ink" />
          <div className={`card-pop mt-1 bg-sun px-3 py-1 font-display font-semibold whitespace-nowrap ${big ? 'text-2xl' : 'text-base'}`}>
            avg {stats.average}
          </div>
        </motion.div>
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        className={`mt-20 text-center font-semibold text-ink-soft ${big ? 'text-3xl' : 'text-lg'}`}
      >
        {verdict}
      </motion.p>
    </div>
  );
}
