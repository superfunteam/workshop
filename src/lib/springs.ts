// One spring language for the whole app: fast, poppy, no easing curves.
// (All motion, no audio — this thing runs in a quiet room.)

import type { Transition } from 'motion/react';

/** UI state changes — instant-feeling. */
export const POP: Transition = { type: 'spring', stiffness: 640, damping: 34, mass: 0.8 };

/** Celebration pops — a little overshoot. */
export const BOUNCE: Transition = { type: 'spring', stiffness: 520, damping: 19, mass: 0.7 };

/** Blocks entering/leaving the stage. */
export const SLIDE: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 };

/** Layout shifts (reorders, cross-column moves). */
export const SHIFT: Transition = { type: 'spring', stiffness: 560, damping: 36 };

/** Parent variants for stagger-popping children in. */
export const staggerParent = (stagger = 0.045) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});

export const popChild = {
  hidden: { opacity: 0, scale: 0.6, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: BOUNCE },
};

export const riseChild = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: SLIDE },
};
