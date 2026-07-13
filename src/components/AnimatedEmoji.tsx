// Google's animated Noto emoji (https://googlefonts.github.io/noto-emoji-animation/)
// for hero moments. If an emoji isn't in the animated set — or the venue WiFi
// can't reach gstatic — we fall back to the plain glyph, so nothing ever breaks.

import { useState } from 'react';

function codepoints(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .join('_');
}

export default function AnimatedEmoji({
  emoji,
  size = 64,
  className,
}: {
  emoji: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !emoji.trim()) {
    return (
      <span className={className} style={{ fontSize: size * 0.82, lineHeight: 1 }} aria-hidden>
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={`https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoints(emoji.trim())}/512.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      loading="eager"
      className={className}
      style={{ display: 'inline-block' }}
      onError={() => setFailed(true)}
    />
  );
}
