// Every new room starts from this — a real two-day branding workshop skeleton
// that shows off every question type. Hosts edit it down or blow it away.

import type { Section } from '../../shared/types.ts';
import { rid } from '../../shared/codes.ts';

export function starterSections(): Section[] {
  return [
    {
      id: rid(8),
      title: 'Warm-up',
      questions: [
        {
          id: rid(8),
          type: 'wordcloud',
          prompt: 'Three words that describe the brand today',
          hint: 'First instinct — don’t overthink it',
          maxWords: 3,
          notes: 'Read the big words out loud. Ask whoever wrote an outlier to say more.',
        },
        {
          id: rid(8),
          type: 'slider',
          prompt: 'Where does the brand sit today?',
          left: 'Playful',
          right: 'Buttoned-up',
          notes: 'If the room is split, dig in — this usually means marketing and product disagree.',
        },
      ],
    },
    {
      id: rid(8),
      title: 'State of the brand',
      questions: [
        {
          id: rid(8),
          type: 'postits',
          prompt: 'The website, honestly',
          hint: 'Add as many notes as you want — short and punchy',
          categories: ['What’s working', 'What’s not'],
          notes: 'Give this one 5 minutes on the timer. Cluster duplicates out loud.',
        },
        {
          id: rid(8),
          type: 'choice',
          prompt: 'How do we feel about the current logo?',
          options: ['Love it, keep it', 'Fine, but tired', 'Time for a change'],
        },
        {
          id: rid(8),
          type: 'open',
          prompt: 'What’s the hardest thing to explain about what you do?',
          anonymous: true,
          notes: 'Anonymous on purpose — you want the honest one from the quiet person.',
        },
      ],
    },
    {
      id: rid(8),
      title: 'Where we’re headed',
      questions: [
        {
          id: rid(8),
          type: 'dotvote',
          prompt: 'Where should the brand focus next?',
          options: ['Website', 'Visual identity', 'Voice & messaging', 'Product experience'],
          dots: 3,
        },
        {
          id: rid(8),
          type: 'rank',
          prompt: 'Rank what the brand needs to earn',
          options: ['Awareness', 'Trust', 'Conversion'],
        },
        {
          id: rid(8),
          type: 'inspo',
          prompt: 'Drop brands you admire',
          hint: 'Paste links, or Cmd-V screenshots straight onto the board',
        },
        {
          id: rid(8),
          type: 'slider',
          prompt: 'In five years, this brand should feel…',
          left: 'Niche & beloved',
          right: 'Everywhere & known',
        },
      ],
    },
  ];
}
