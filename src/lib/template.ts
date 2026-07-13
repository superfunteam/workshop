// Every new room starts from this deck — intro slide, the house question set,
// outro slide. Hosts edit it down or blow it away.

import type { Section } from '../../shared/types.ts';
import { rid } from '../../shared/codes.ts';

export function starterSections(): Section[] {
  return [
    {
      id: rid(8),
      title: 'Kickoff',
      questions: [
        {
          id: rid(8),
          type: 'slide',
          emoji: '👋',
          prompt: 'Welcome to the workshop',
          body: 'Today is about getting honest about the brand — no wrong answers, no bad ideas. Everything you type is saved, so say the real thing.\n\nGrab the join code on screen and settle in.',
          notes: 'Intros around the room while people join. Set the tone: honest beats polite.',
        },
      ],
    },
    {
      id: rid(8),
      title: 'The workshop',
      questions: [
        {
          id: rid(8),
          type: 'choice',
          prompt: 'Our main website goal is:',
          options: ['Gain customers', 'Attract funding'],
          notes: 'If this splits the room, that IS the finding — the site can’t serve two masters equally.',
        },
        {
          id: rid(8),
          type: 'postits',
          prompt: 'The brand, honestly',
          hint: 'Add as many notes as you want — short and punchy',
          categories: ['What it does well', 'What it can do better'],
          notes: 'Give this 5 minutes on the timer. Read clusters out loud, ask for stories behind the spicy ones.',
        },
        {
          id: rid(8),
          type: 'slider',
          prompt: 'Are we more…',
          left: 'Fun',
          right: 'Corporate',
          notes: 'Ask: is where we LANDED where we WANT to be? Gap = the brief.',
        },
        {
          id: rid(8),
          type: 'discuss',
          prompt: 'What kind of content are we going to make?',
          hint: 'Talk it out — blog, video, social, docs, events…',
          notes: 'Scratchpad time. Push past formats into cadence + who owns it.',
        },
        {
          id: rid(8),
          type: 'inspo',
          prompt: 'Who has the best website?',
          hint: 'Paste links, or Cmd-V screenshots straight onto the board',
          notes: 'Ask each person WHY they pinned theirs — steal principles, not pixels.',
        },
        {
          id: rid(8),
          type: 'open',
          prompt: 'One year from now: what is our champagne moment?',
          hint: 'Be specific — what happened, and how do we know?',
          notes: 'Read every one aloud. Circle the ones that show up twice — that’s the goal slide.',
        },
      ],
    },
    {
      id: rid(8),
      title: 'Wrap-up',
      questions: [
        {
          id: rid(8),
          type: 'slide',
          emoji: '🥂',
          prompt: 'That’s the workshop!',
          body: 'Thank you — this was gold. Next: we turn today into a plan. What we heard, what changes, what ships first.\n\nWatch your inbox for the recap.',
          notes: 'Point at the recap link + tell them the summary doc lands this week.',
        },
      ],
    },
  ];
}
