import { motion } from 'motion/react';
import type { InspoQuestion } from '../../../shared/types.ts';
import { inspoItems } from '../../../shared/aggregate.ts';
import { BOUNCE } from '../../lib/springs.ts';
import SiteCard from '../SiteCard.tsx';
import { AuthorChip, type ResultsProps } from './index.tsx';

export default function InspoResults({ question, answers, participants, big }: ResultsProps<InspoQuestion>) {
  const items = inspoItems(answers);
  return (
    <div className={`w-full gap-4 ${big ? 'columns-3 xl:columns-4' : 'columns-2 sm:columns-3'}`}>
      {items.map((item, i) => (
        <motion.div
          key={`${item.pid}-${item.id}`}
          drag
          dragMomentum={false}
          whileDrag={{ scale: 1.06, zIndex: 60, cursor: 'grabbing' }}
          whileHover={{ scale: 1.03, y: -3 }}
          initial={{ opacity: 0, scale: 0.6, rotate: i % 2 ? 3 : -3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ ...BOUNCE, delay: Math.min(i * 0.07, 0.6) }}
          className="relative mb-4 cursor-grab break-inside-avoid"
        >
          {item.kind === 'link' ? (
            <a href={item.url} target="_blank" rel="noreferrer" draggable={false} className="block transition-transform hover:-translate-y-0.5">
              <SiteCard url={item.url} />
            </a>
          ) : (
            <img src={item.url} alt={item.note ?? ''} loading="lazy" className="card-pop w-full p-1.5" draggable={false} />
          )}
          <div className="absolute right-2 bottom-2 flex gap-1">
            {!question.anonymous && item.pid && <AuthorChip participants={participants} pid={item.pid} />}
          </div>
          {item.note && <p className="mt-1 px-1 font-semibold text-base">{item.note}</p>}
        </motion.div>
      ))}
    </div>
  );
}
