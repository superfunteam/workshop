// Inspo board: paste a URL, or literally Cmd/Ctrl-V a screenshot — images
// upload to the room and pin to the shared board on reveal.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { InspoItem, InspoQuestion, InspoValue } from '../../../shared/types.ts';
import { rid } from '../../../shared/codes.ts';
import { api } from '../../lib/api.ts';
import { BOUNCE } from '../../lib/springs.ts';

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;

export default function InspoInput({
  value,
  onSubmit,
  code,
  pid,
}: {
  question: InspoQuestion;
  value: InspoValue | null;
  onSubmit: (v: InspoValue) => Promise<void>;
  code: string;
  pid: string;
}) {
  const [items, setItems] = useState<InspoItem[]>(value?.items ?? []);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'uploading' | 'failed'>('idle');
  const latest = useRef(items);
  latest.current = items;

  useEffect(() => {
    if (value && value.items.length > latest.current.length) setItems(value.items);
  }, [value]);

  const save = async (next: InspoItem[]) => {
    setItems(next);
    setStatus('saving');
    try {
      await onSubmit({ items: next });
      setStatus('idle');
    } catch {
      setStatus('failed');
    }
  };

  const addUrl = () => {
    const url = draft.trim();
    if (!url) return;
    setDraft('');
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    void save([
      ...items,
      { id: rid(8), kind: IMAGE_RE.test(withProtocol) ? 'image' : 'link', url: withProtocol },
    ]);
  };

  // Cmd-V an image anywhere on the page while this question is up.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
      if (!file) return;
      e.preventDefault();
      setStatus('uploading');
      api
        .upload(code, pid, file)
        .then(({ url }) => save([...latest.current, { id: rid(8), kind: 'upload', url }]))
        .catch(() => setStatus('failed'));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [code, pid]);

  const remove = (id: string) => void save(items.filter((i) => i.id !== id));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex gap-2">
        <input
          className="input-pop flex-1 text-base"
          placeholder="Paste a link… or Cmd-V a screenshot right onto the page"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addUrl();
          }}
        />
        <button type="button" className="btn-pop bg-sun" disabled={!draft.trim()} onClick={addUrl}>
          Pin it
        </button>
      </div>
      <div className="text-right text-sm font-semibold text-ink-soft">
        {status === 'uploading' && 'uploading…'}
        {status === 'saving' && 'saving…'}
        {status === 'failed' && (
          <button type="button" className="text-coral underline" onClick={() => void save(items)}>
            couldn’t save — retry
          </button>
        )}
        {status === 'idle' && items.length > 0 && `${items.length} pinned ✓`}
      </div>
      <div className="columns-2 gap-3 sm:columns-3">
        <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.5, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.12 } }}
            whileHover={{ scale: 1.02, y: -2 }}
            transition={BOUNCE}
            className="group relative mb-3 break-inside-avoid"
          >
            {item.kind === 'link' ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="card-pop block p-3 text-sm font-semibold break-all hover:bg-note-sky/40"
              >
                🔗 {item.url.replace(/^https?:\/\//, '').slice(0, 80)}
              </a>
            ) : (
              <img
                src={item.url}
                alt=""
                loading="lazy"
                className="card-pop w-full p-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).closest('div')?.classList.add('opacity-40');
                }}
              />
            )}
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="absolute -top-2 -right-2 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-white text-xs group-hover:flex"
              aria-label="remove pin"
            >
              ✕
            </button>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
      {items.length === 0 && (
        <p className="text-center font-semibold text-lg text-ink-soft">
          Sites you love, screenshots, moodboard bits — pin anything
        </p>
      )}
    </div>
  );
}
