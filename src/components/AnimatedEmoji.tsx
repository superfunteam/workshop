// Google's animated Noto emoji (https://googlefonts.github.io/noto-emoji-animation/).
//
// Two modes:
//  - default: plays the animated WebP on loop (hero moments, reaction floaters)
//  - paused:  shows the STATIC Noto art (emoji.svg) — flip `paused` off on
//    hover/press and the animated version takes over instantly (it's preloaded)
//
// Fallback chain: animated → static Noto SVG → plain system glyph. If the
// venue network can't reach gstatic, nothing breaks — you just get the glyph.

import { useEffect, useMemo, useState } from 'react';

function codepoints(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .join('_');
}

const animUrl = (cp: string) => `https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/512.webp`;
const staticUrl = (cp: string) => `https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/emoji.svg`;

export default function AnimatedEmoji({
  emoji,
  size = 64,
  className,
  paused = false,
}: {
  emoji: string;
  size?: number;
  className?: string;
  paused?: boolean;
}) {
  const [animFailed, setAnimFailed] = useState(false);
  const [staticFailed, setStaticFailed] = useState(false);
  const cp = useMemo(() => codepoints(emoji.trim()), [emoji]);

  // Preload the animated frames so un-pausing plays instantly.
  useEffect(() => {
    setAnimFailed(false);
    setStaticFailed(false);
    if (!cp) return;
    const probe = new Image();
    probe.src = animUrl(cp);
    probe.onerror = () => setAnimFailed(true);
  }, [cp]);

  const wantAnim = !paused && !animFailed;
  const glyphOnly = !emoji.trim() || (wantAnim ? animFailed && staticFailed : staticFailed);

  if (glyphOnly) {
    return (
      <span className={className} style={{ fontSize: size * 0.82, lineHeight: 1 }} aria-hidden>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={wantAnim ? animUrl(cp) : staticUrl(cp)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      loading="eager"
      className={className}
      style={{ display: 'inline-block' }}
      onError={() => (wantAnim ? setAnimFailed(true) : setStaticFailed(true))}
    />
  );
}
