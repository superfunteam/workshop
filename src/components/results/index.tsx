import type { Answer, PublicParticipant, Question } from '../../../shared/types.ts';
import BarResults from './BarResults.tsx';
import SliderResults from './SliderResults.tsx';
import WordcloudResults from './WordcloudResults.tsx';
import RankResults from './RankResults.tsx';
import OpenResults from './OpenResults.tsx';
import PostitsResults from './PostitsResults.tsx';
import InspoResults from './InspoResults.tsx';

export interface ResultsProps<Q extends Question = Question> {
  question: Q;
  answers: Answer[];
  participants: PublicParticipant[];
  /** Projector sizing. */
  big?: boolean;
}

export function personFor(participants: PublicParticipant[], pid: string): PublicParticipant | null {
  return participants.find((p) => p.pid === pid) ?? null;
}

/** Tiny attribution chip; anonymous answers arrive with pid stripped. */
export function AuthorChip({ participants, pid }: { participants: PublicParticipant[]; pid: string }) {
  if (!pid) return null;
  const p = personFor(participants, pid);
  if (!p) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-1.5 py-0.5 text-[11px] font-bold border border-line">
      <span aria-hidden>{p.avatar}</span> {p.name}
    </span>
  );
}

export default function ResultsView({ question, answers, participants, big }: ResultsProps) {
  if (question.type === 'slide') {
    return (
      <p className="py-4 text-center font-semibold text-lg text-ink-soft whitespace-pre-line">
        🎬 {question.body || 'A slide — nothing collected.'}
      </p>
    );
  }
  if (question.type === 'discuss') {
    return (
      <p className="py-4 text-center font-semibold text-lg text-ink-soft">
        🗣️ Talked out live — highlights live in the host scratchpad.
      </p>
    );
  }
  if (answers.length === 0) {
    return (
      <p className="py-10 text-center font-semibold text-xl text-ink-soft">
        No answers on this one — and that’s an answer too
      </p>
    );
  }
  switch (question.type) {
    case 'choice':
    case 'dotvote':
      return <BarResults question={question} answers={answers} participants={participants} big={big} />;
    case 'slider':
      return <SliderResults question={question} answers={answers} participants={participants} big={big} />;
    case 'wordcloud':
      return <WordcloudResults question={question} answers={answers} participants={participants} big={big} />;
    case 'rank':
      return <RankResults question={question} answers={answers} participants={participants} big={big} />;
    case 'open':
      return <OpenResults question={question} answers={answers} participants={participants} big={big} />;
    case 'postits':
      return <PostitsResults question={question} answers={answers} participants={participants} big={big} />;
    case 'inspo':
      return <InspoResults question={question} answers={answers} participants={participants} big={big} />;
  }
}
