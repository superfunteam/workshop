import type { AnswerValue, Question } from '../../../shared/types.ts';
import ChoiceInput from './ChoiceInput.tsx';
import OpenInput from './OpenInput.tsx';
import PostitsInput from './PostitsInput.tsx';
import SliderInput from './SliderInput.tsx';
import InspoInput from './InspoInput.tsx';
import WordcloudInput from './WordcloudInput.tsx';
import DotvoteInput from './DotvoteInput.tsx';
import RankInput from './RankInput.tsx';

/** Board types keep participants on the input (adding items) instead of a waiting screen. */
export const MULTI_ITEM_TYPES: ReadonlySet<string> = new Set(['postits', 'inspo']);

export default function AnswerInput({
  question,
  value,
  onSubmit,
  code,
  pid,
}: {
  question: Question;
  value: AnswerValue | null;
  onSubmit: (v: AnswerValue) => Promise<void>;
  code: string;
  pid: string;
}) {
  switch (question.type) {
    case 'choice':
      return <ChoiceInput question={question} value={value as never} onSubmit={onSubmit} />;
    case 'open':
      return <OpenInput question={question} value={value as never} onSubmit={onSubmit} />;
    case 'postits':
      return <PostitsInput question={question} value={value as never} onSubmit={onSubmit} />;
    case 'slider':
      return <SliderInput question={question} value={value as never} onSubmit={onSubmit} />;
    case 'inspo':
      return <InspoInput question={question} value={value as never} onSubmit={onSubmit} code={code} pid={pid} />;
    case 'wordcloud':
      return <WordcloudInput question={question} value={value as never} onSubmit={onSubmit} />;
    case 'dotvote':
      return <DotvoteInput question={question} value={value as never} onSubmit={onSubmit} />;
    case 'rank':
      return <RankInput question={question} value={value as never} onSubmit={onSubmit} />;
  }
}
