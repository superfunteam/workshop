// A link on an inspo board, shown as an actual look at the site: screenshot
// via WordPress mShots (free, keyless, cached server-side) + favicon + domain.
// mShots returns a "generating" placeholder on first request, so we quietly
// re-mount the image once after a few seconds to pick up the real shot.
// If the service is unreachable, we fall back to a clean favicon-only card —
// the board never breaks.

import { useEffect, useState } from 'react';
import Icon from './Icon.tsx';

const shotUrl = (url: string) => `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=640`;

export default function SiteCard({ url }: { url: string }) {
  const [shotFailed, setShotFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const domain = url.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // One quiet retry ~6s in, for the placeholder → real-shot handoff.
  useEffect(() => {
    if (shotFailed) return;
    const t = setTimeout(() => setAttempt(1), 6000);
    return () => clearTimeout(t);
  }, [shotFailed]);

  return (
    <span className="block overflow-hidden rounded-xl border border-line bg-white">
      {!shotFailed && (
        <img
          key={attempt}
          src={shotUrl(url)}
          alt={`screenshot of ${domain}`}
          loading="lazy"
          draggable={false}
          className="aspect-[4/3] w-full bg-paper object-cover object-top"
          onError={() => setShotFailed(true)}
        />
      )}
      <span className={`flex items-center gap-2 px-3 py-2 ${shotFailed ? 'py-3' : 'border-t border-line'}`}>
        {!faviconFailed && (
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
            alt=""
            width={16}
            height={16}
            draggable={false}
            onError={() => setFaviconFailed(true)}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{domain}</span>
        <Icon name="open_in_new" size={14} className="shrink-0 text-ink-faint" />
      </span>
    </span>
  );
}
