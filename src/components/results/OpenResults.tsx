import { motion } from 'motion/react';
import type { OpenQuestion } from '../../../shared/types.ts';
import { openAnswers } from '../../../shared/aggregate.ts';
import { noteColor, tiltFor } from '../bits.tsx';
import { BOUNCE } from '../../lib/springs.ts';
import { AuthorChip, type ResultsProps } from './index.tsx';

export default function OpenResults({ question, answers, participants, big }: ResultsProps<OpenQuestion>) {
  const list = openAnswers(answers);
  return (
    <div className={`grid w-full gap-4 ${big ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {list.map((a, i) => (
        <motion.figure
          key={`${a.pid}-${i}`}
          drag
          dragMomentum={false}
          whileDrag={{ scale: 1.05, rotate: 0, zIndex: 60, cursor: 'grabbing' }}
          whileHover={{ scale: 1.02 }}
          initial={{ opacity: 0, y: 26, scale: 0.9, rotate: -3 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: Number.parseFloat(tiltFor(a.text)) / 2 }}
          transition={{ ...BOUNCE, delay: Math.min(i * 0.07, 0.6) }}
          className="card-pop flex cursor-grab flex-col gap-3 p-5"
          style={{ background: `${noteColor(i)}40` }}
        >
          <blockquote className={`font-medium leading-snug ${big ? 'text-2xl' : 'text-lg'}`}>“{a.text}”</blockquote>
          {!question.anonymous && a.pid && (
            <figcaption className="mt-auto">
              <AuthorChip participants={participants} pid={a.pid} />
            </figcaption>
          )}
        </motion.figure>
      ))}
    </div>
  );
}
