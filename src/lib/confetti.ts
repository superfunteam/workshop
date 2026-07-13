// Tiny dependency-free confetti. One canvas, physics-lite, self-cleaning.

const COLORS = ['#e4573d', '#ffd23f', '#1f9e82', '#3e7fd6', '#8b5cf6', '#c94f9c', '#ff6b57'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  shape: 'rect' | 'circle';
}

let canvas: HTMLCanvasElement | null = null;
let pieces: Piece[] = [];
let raf = 0;

function ensureCanvas(): CanvasRenderingContext2D {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
    document.body.appendChild(canvas);
  }
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  return ctx;
}

function loop(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  pieces = pieces.filter((p) => p.y < window.innerHeight + 40);
  for (const p of pieces) {
    p.vy += 0.18;
    p.vx *= 0.992;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (pieces.length > 0) {
    raf = requestAnimationFrame(() => loop(ctx));
  } else {
    canvas?.remove();
    canvas = null;
    raf = 0;
  }
}

/** intensity 1 = small pop, 3 = section win, 5 = grand finale */
export function confetti(intensity = 2): void {
  const ctx = ensureCanvas();
  const count = 40 * intensity;
  const cx = window.innerWidth / 2;
  for (let i = 0; i < count; i++) {
    const fromLeft = Math.random() < 0.5;
    const burst = intensity >= 3;
    pieces.push({
      x: burst ? (fromLeft ? -10 : window.innerWidth + 10) : cx + (Math.random() - 0.5) * 320,
      y: burst ? window.innerHeight * (0.35 + Math.random() * 0.3) : window.innerHeight + 20,
      vx: burst ? (fromLeft ? 1 : -1) * (4 + Math.random() * 7) : (Math.random() - 0.5) * 7,
      vy: -(9 + Math.random() * 7),
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 7,
      h: 8 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() < 0.7 ? 'rect' : 'circle',
    });
  }
  if (!raf) raf = requestAnimationFrame(() => loop(ctx));
}
