// The revealed sticky wall. Notes spring in staggered — and they're draggable
// (locally) so whoever's driving the projector can cluster them while the room
// talks. Positions are play-space, not saved.

import { motion } from 'motion/react';
import type { PostitsQuestion } from '../../../shared/types.ts';
import { postitsByCategory } from '../../../shared/aggregate.ts';
import { noteColor, tiltFor } from '../bits.tsx';
import { BOUNCE } from '../../lib/springs.ts';
import { personFor, type ResultsProps } from './index.tsx';

const tiltDeg = (id: string): number => Number.parseFloat(tiltFor(id));

export default function PostitsResults({ question, answers, participants, big }: ResultsProps<PostitsQuestion>) {
  const groups = postitsByCategory(question, answers);
  return (
    <div
      className="grid w-full items-start gap-4"
      style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, big ? 4 : 3)}, minmax(0, 1fr))` }}
    >
      {groups.map((group) => (
        <section key={group.index} className="card-pop p-4" style={{ background: `${noteColor(group.index)}2e` }}>
          <h3 className={`display-type mb-3 flex items-baseline justify-between ${big ? 'text-3xl' : 'text-xl'}`}>
            {group.category}
            <span className="font-sans text-sm font-bold text-ink-soft">{group.notes.length}</span>
          </h3>
          <div className="flex flex-col gap-3">
            {group.notes.map((note, i) => {
              const author = question.anonymous ? null : personFor(participants, note.pid);
              return (
                <motion.div
                  key={note.id}
                  drag
                  dragMomentum={false}
                  whileDrag={{ scale: 1.08, rotate: 0, zIndex: 60, cursor: 'grabbing' }}
                  whileHover={{ scale: 1.04, rotate: 0 }}
                  initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: tiltDeg(note.id), opacity: 1 }}
                  transition={{ ...BOUNCE, delay: Math.min(i * 0.06, 0.5) }}
                  className={`sticky-note cursor-grab ${big ? 'text-2xl' : ''}`}
                  style={{ background: noteColor(group.index) }}
                >
                  {note.text}
                  {author && (
                    <div className="mt-1 text-right font-sans text-[10px] font-bold text-ink/50">
                      {author.avatar} {author.name}
                    </div>
                  )}
                </motion.div>
              );
            })}
            {group.notes.length === 0 && (
              <p className="py-4 text-center font-semibold text-base text-ink-faint">nothing here yet</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
