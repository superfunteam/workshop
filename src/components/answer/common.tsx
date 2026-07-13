import { useState } from 'react';

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
    <button
      type="button"
      className="btn-pop bg-sun px-8 py-3 text-xl"
      disabled={busy || disabled}
      onClick={onClick}
    >
      {busy ? 'Sending…' : label ?? (editing ? 'Update answer' : 'Lock it in ✨')}
    </button>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="font-hand text-xl text-coral" role="alert">
      {error} — give it another tap
    </p>
  );
}
