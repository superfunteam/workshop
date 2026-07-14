/** The reaction bar. Server validates emotes against this set. */
export const EMOTES = ['❤️', '😂', '🔥', '👏', '🤯', '💡', '🎉', '😬'] as const;

/** Join-screen avatar choices. */
export const AVATARS = [
  '🦊', '🐙', '🦉', '🐸', '🦄', '🐝', '🦁', '🐼',
  '🐳', '🐧', '🦔', '🐢', '🦋', '🐌', '🦩', '🐿️',
  '🦥', '🐻', '🦈', '🐞', '🦚', '🐇', '🦭', '🐅',
] as const;

export const isEmote = (e: string): boolean => (EMOTES as readonly string[]).includes(e);
export const isAvatar = (e: string): boolean => (AVATARS as readonly string[]).includes(e);
export const randomAvatar = (): string => AVATARS[Math.floor(Math.random() * AVATARS.length)];
