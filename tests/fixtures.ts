import type { Answer, AnswerValue, Participant, StoredRoomConfig } from '../shared/types.ts';

export function makeConfig(): StoredRoomConfig {
  return {
    code: 'TEST',
    name: 'Acme Brand Workshop',
    createdAt: 1_752_400_000_000,
    hostKey: 'secret-host-key',
    settings: { autoReveal: false },
    sections: [
      {
        id: 'sec1',
        title: 'Warm up',
        questions: [
          {
            id: 'q-choice',
            type: 'choice',
            prompt: 'How do we feel about the current logo?',
            options: ['Love it', 'It’s fine', 'Burn it'],
          },
          {
            id: 'q-slider',
            type: 'slider',
            prompt: 'Where should the brand sit?',
            left: 'Playful',
            right: 'Serious',
          },
        ],
      },
      {
        id: 'sec2',
        title: 'Dig in',
        questions: [
          {
            id: 'q-postits',
            type: 'postits',
            prompt: 'The website today',
            categories: ['Working', 'Not working'],
          },
          {
            id: 'q-open',
            type: 'open',
            prompt: 'One sentence: what does Acme do?',
            anonymous: true,
          },
          {
            id: 'q-words',
            type: 'wordcloud',
            prompt: 'Three words for the brand',
            maxWords: 3,
          },
          {
            id: 'q-dots',
            type: 'dotvote',
            prompt: 'Where should we focus?',
            options: ['Website', 'Logo', 'Voice', 'Product'],
            dots: 3,
          },
          {
            id: 'q-rank',
            type: 'rank',
            prompt: 'Rank the priorities',
            options: ['Awareness', 'Trust', 'Conversion'],
          },
          {
            id: 'q-inspo',
            type: 'inspo',
            prompt: 'Brands you admire',
          },
        ],
      },
    ],
  };
}

export function makeParticipants(now: number): Participant[] {
  return [
    { pid: 'p1', name: 'Dana', avatar: '🦊', joinedAt: now - 60_000, lastSeen: now },
    { pid: 'p2', name: 'Sam', avatar: '🐙', joinedAt: now - 50_000, lastSeen: now - 5_000 },
    { pid: 'p3', name: 'Alex', avatar: '🦉', joinedAt: now - 40_000, lastSeen: now - 60_000 }, // offline
    { pid: 'p4', name: 'Gone', avatar: '🫥', joinedAt: now - 30_000, lastSeen: now, removed: true },
  ];
}

export function answer(pid: string, qid: string, value: AnswerValue, updatedAt = 1_752_400_100_000): Answer {
  return { pid, qid, value, updatedAt };
}
