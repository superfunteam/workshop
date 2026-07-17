// Keep the screen awake while a workshop is on it. Projectors, host laptops,
// and participants' phones all dim or lock on their own schedule — mid-session
// that reads as "the app died". Browsers without the Wake Lock API just
// behave the way they always did.

import { useEffect } from 'react';

export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen');
          if (disposed) void lock.release().catch(() => undefined);
        }
      } catch {
        /* low battery or a strict policy — screens just follow their own rules */
      }
    };
    void acquire();
    // The lock auto-releases whenever the tab hides; re-grab it on return.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
