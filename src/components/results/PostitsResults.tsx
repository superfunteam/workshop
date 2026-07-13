import type { PostitsQuestion } from '../../../shared/types.ts';
import { postitsByCategory } from '../../../shared/aggregate.ts';
import { noteColor, tiltFor } from '../bits.tsx';
import { personFor, type ResultsProps } from './index.tsx';

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
                <div
                  key={note.id}
                  className={`sticky-note animate-pop-in ${big ? 'text-2xl' : ''}`}
                  style={{
                    background: noteColor(group.index),
                    ['--tilt' as string]: tiltFor(note.id),
                    animationDelay: `${(i * 70) % 600}ms`,
                  }}
                >
                  {note.text}
                  {author && (
                    <div className="mt-1 text-right font-sans text-[10px] font-bold text-ink/50">
                      {author.avatar} {author.name}
                    </div>
                  )}
                </div>
              );
            })}
            {group.notes.length === 0 && (
              <p className="py-4 text-center font-hand text-xl text-ink-faint">nothing here yet</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
