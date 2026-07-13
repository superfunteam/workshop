import type { OpenQuestion } from '../../../shared/types.ts';
import { openAnswers } from '../../../shared/aggregate.ts';
import { noteColor, tiltFor } from '../bits.tsx';
import { AuthorChip, type ResultsProps } from './index.tsx';

export default function OpenResults({ question, answers, participants, big }: ResultsProps<OpenQuestion>) {
  const list = openAnswers(answers);
  return (
    <div className={`grid w-full gap-4 ${big ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {list.map((a, i) => (
        <figure
          key={`${a.pid}-${i}`}
          className="card-pop animate-pop-in flex flex-col gap-3 p-5"
          style={{
            animationDelay: `${i * 90}ms`,
            background: `${noteColor(i)}40`,
            transform: `rotate(${tiltFor(a.text)})`,
          }}
        >
          <blockquote className={`font-hand leading-snug ${big ? 'text-3xl' : 'text-2xl'}`}>“{a.text}”</blockquote>
          {!question.anonymous && a.pid && (
            <figcaption className="mt-auto">
              <AuthorChip participants={participants} pid={a.pid} />
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
