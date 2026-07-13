// Everyone's vote lands on the track as their avatar; the group average gets
// the big flag. Spread gets a plain-language read: agreement or a split room.

import type { SliderQuestion } from '../../../shared/types.ts';
import { sliderStats } from '../../../shared/aggregate.ts';
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
      <div className={`mb-10 flex justify-between font-display font-bold ${big ? 'text-4xl' : 'text-xl'}`}>
        <span>← {question.left}</span>
        <span>{question.right} →</span>
      </div>
      <div className="relative mx-4">
        <div className={`w-full rounded-full border-[2.5px] border-ink bg-white ${big ? 'h-7' : 'h-5'}`}>
          <div
            className="h-full rounded-l-full bg-note-sky/70"
            style={{ width: `${stats.average}%` }}
          />
        </div>
        {[...buckets.entries()].map(([bucket, list]) =>
          list.map((v, stackIdx) => {
            const person = question.anonymous ? null : personFor(participants, v.pid);
            return (
              <span
                key={`${bucket}-${stackIdx}`}
                className={`animate-pop-in absolute -translate-x-1/2 select-none ${big ? 'text-4xl' : 'text-2xl'}`}
                style={{
                  left: `${v.value}%`,
                  bottom: `${(big ? 34 : 24) + stackIdx * (big ? 34 : 26)}px`,
                  animationDelay: `${(bucket * 17 + stackIdx * 90) % 500}ms`,
                }}
                title={person ? `${person.name}: ${v.value}` : String(v.value)}
              >
                {person?.avatar ?? '●'}
              </span>
            );
          }),
        )}
        <div className="absolute -bottom-12 -translate-x-1/2 text-center" style={{ left: `${stats.average}%` }}>
          <div className="mx-auto h-8 w-1 rounded bg-ink" />
          <div className={`card-pop mt-1 bg-sun px-3 py-1 font-display font-extrabold whitespace-nowrap ${big ? 'text-2xl' : 'text-base'}`}>
            avg {stats.average}
          </div>
        </div>
      </div>
      <p className={`mt-20 text-center font-hand text-ink-soft ${big ? 'text-4xl' : 'text-2xl'}`}>{verdict}</p>
    </div>
  );
}
