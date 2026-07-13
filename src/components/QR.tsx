import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QR({ url, size = 180 }: { url: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    void QRCode.toCanvas(ref.current, url, {
      width: size,
      margin: 1,
      color: { dark: '#23211b', light: '#ffffff' },
    });
  }, [url, size]);
  return <canvas ref={ref} className="rounded-xl border-[2.5px] border-ink bg-white" aria-label={`QR code for ${url}`} />;
}
