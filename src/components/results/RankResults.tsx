import type { RankQuestion } from '../../../shared/types.ts';
import { rankResults } from '../../../shared/aggregate.ts';
import type { ResultsProps } from './index.tsx';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankResults({ question, answers, big }: ResultsProps<RankQuestion>) {
  const results = rankResults(question, answers);
  return (
    <div className="flex w-full flex-col gap-3">
      {results.map((r, i) => (
        <div
          key={r.index}
          className={`card-pop animate-pop-in flex items-center gap-4 px-5 ${big ? 'py-5' : 'py-3'} ${i === 0 ? 'bg-sun/60' : 'bg-white'}`}
          style={{ animationDelay: `${i * 110}ms`, marginLeft: `${i * (big ? 14 : 8)}px` }}
        >
          <span className={`${big ? 'text-5xl' : 'text-3xl'}`} aria-hidden>
            {MEDALS[i] ?? `${i + 1}.`}
          </span>
          <span className={`display-type flex-1 ${big ? 'text-4xl' : 'text-xl'}`}>{r.option}</span>
          <span className={`font-semibold text-ink-soft ${big ? 'text-xl' : 'text-sm'}`}>
            {r.avgPosition === null ? 'unranked' : `avg #${r.avgPosition}`}
          </span>
        </div>
      ))}
    </div>
  );
}
