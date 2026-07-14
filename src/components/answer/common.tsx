import { useState } from 'react';
import { motion } from 'motion/react';
import { POP } from '../../lib/springs.ts';

/** Shared submit affordance: big, bouncy, honest about failures. */
export function useSubmit<V>(onSubmit: (v: V) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (v: V) => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t send — try again');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

export function SubmitButton({
  busy,
  disabled,
  onClick,
  editing,
  label,
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  editing?: boolean;
  label?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      whileHover={disabled ? undefined : { scale: 1.04 }}
      transition={POP}
      type="button"
      className="btn-pop bg-ink text-white hover:bg-ink/90 px-8 py-3 text-xl"
      disabled={busy || disabled}
      onClick={onClick}
    >
      {busy ? 'Sending…' : label ?? (editing ? 'Update answer' : 'Lock it in ✨')}
    </motion.button>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={POP}
      className="font-semibold text-base text-coral"
      role="alert"
    >
      {error} — give it another tap
    </motion.p>
  );
}
