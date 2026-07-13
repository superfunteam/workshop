// Random identifiers. Uses Web Crypto, available in the browser, Deno, and Node 20+.

/** Unambiguous alphabet: no 0/O, 1/I/L, 5/S, 8/B lookalikes. */
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXYZ234679';

function randomInts(count: number, max: number): number[] {
  const buf = new Uint32Array(count);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => n % max);
}

/** 4-letter room code, e.g. "KRWX". */
export function roomCode(): string {
  return randomInts(4, CODE_ALPHABET.length)
    .map((i) => CODE_ALPHABET[i])
    .join('');
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Short random id for questions, notes, participants, events. */
export function rid(len = 10): string {
  return randomInts(len, ID_ALPHABET.length)
    .map((i) => ID_ALPHABET[i])
    .join('');
}

/** Secret that gates host actions. */
export function hostKey(): string {
  return rid(24);
}
