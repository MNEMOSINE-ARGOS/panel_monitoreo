import React, { useEffect, useRef } from 'react';
import { CalendarDays } from 'lucide-react';

interface MonitorHeroProps {
  totalCount: number;
}

// Dos picos positivos seguidos y uno negativo al final: la zona alta del trazo es verde, la baja roja y la franja media (línea base) gris.
const POINTS: Array<[number, number]> = [
  [0, 60], [60, 60], [72, 56], [82, 62], [100, 60],
  [112, 58], [122, 10], [134, 66], [146, 60],
  [190, 60], [202, 56], [212, 62], [230, 60],
  [242, 58], [252, 22], [264, 64], [276, 60],
  [340, 60], [352, 56], [362, 62], [400, 60],
  [412, 64], [424, 112], [436, 56], [448, 60],
  [520, 60], [600, 60],
];

const LIFELINE = POINTS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

// Franja gris entre estas alturas (viewBox de 120): arriba verde, abajo rojo.
const GRAY_TOP = 42 / 120;
const GRAY_BOTTOM = 78 / 120;

const CYCLE_MS = 40000;
const REVEAL_PART = 0.8; // el barco recorre la línea en el 80 % del ciclo y se desvanece al final

// Arranca con velocidad y va frenando suave hacia el final.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 1.5);

// Altura y pendiente (en unidades del viewBox) de la línea en una posición x.
function sampleLine(x: number): { y: number; slope: number } {
  for (let i = 1; i < POINTS.length; i++) {
    const [x1, y1] = POINTS[i];
    const [x0, y0] = POINTS[i - 1];
    if (x <= x1 || i === POINTS.length - 1) {
      const dx = x1 - x0 || 1;
      const k = Math.min(1, Math.max(0, (x - x0) / dx));
      return { y: y0 + (y1 - y0) * k, slope: (y1 - y0) / dx };
    }
  }
  return { y: 60, slope: 0 };
}

export const MonitorHero: React.FC<MonitorHeroProps> = ({ totalCount }) => {
  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const boxRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<SVGRectElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const shipRef = useRef<HTMLImageElement>(null);

  // Un solo reloj mueve el trazo y el barco, para que el barco "surfee" justo en la punta de la línea.
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      revealRef.current?.setAttribute('width', '600');
      if (shipRef.current) shipRef.current.style.display = 'none';
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % CYCLE_MS) / CYCLE_MS;
      const progress = t < REVEAL_PART ? easeOut(t / REVEAL_PART) : 1;
      const fade = t < REVEAL_PART ? 1 : 1 - (t - REVEAL_PART) / (1 - REVEAL_PART);
      const x = 600 * progress;
      revealRef.current?.setAttribute('width', String(x));
      if (pathRef.current) pathRef.current.style.opacity = String(fade);

      const box = boxRef.current;
      const ship = shipRef.current;
      if (box && ship) {
        const w = box.clientWidth;
        const h = box.clientHeight;
        const { y, slope } = sampleLine(x);
        const px = (x / 600) * w;
        const py = (y / 120) * h;
        const slopePx = (slope * (h / 120)) / (w / 600);
        const angle = Math.max(-40, Math.min(40, (Math.atan(slopePx) * 180) / Math.PI));
        const bob = Math.sin(now / 1000) * 1.5;
        ship.style.opacity = String(fade * Math.min(1, x / 180));
        ship.style.transform = `translate(${px}px, ${py + bob}px) translate(-50%, -82%) rotate(${angle}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <header className="relative isolate overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(to right, transparent, #000 70%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 70%)',
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 top-0 flex h-1" aria-hidden="true">
        <span className="flex-1 bg-argos-blue" />
        <span className="flex-1 bg-argos-gold" />
      </div>

      <div ref={boxRef} className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[62%] sm:block" aria-hidden="true">
      <svg
        className="lifeline h-full w-full"
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lifeline-color" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="120">
            <stop offset="0" stopColor="#16a34a" />
            <stop offset={GRAY_TOP} stopColor="#16a34a" />
            <stop offset={GRAY_TOP} stopColor="#94a3b8" />
            <stop offset={GRAY_BOTTOM} stopColor="#94a3b8" />
            <stop offset={GRAY_BOTTOM} stopColor="#dc2626" />
            <stop offset="1" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id="lifeline-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="lifeline-mask">
            <rect width="600" height="120" fill="url(#lifeline-fade)" />
          </mask>
          <clipPath id="lifeline-reveal">
            <rect ref={revealRef} width="0" height="120" />
          </clipPath>
        </defs>
        <g mask="url(#lifeline-mask)" fill="none" stroke="url(#lifeline-color)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5">
          <path ref={pathRef} d={LIFELINE} clipPath="url(#lifeline-reveal)" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <img
        ref={shipRef}
        src="/argos_logo.svg"
        alt=""
        className="absolute left-0 top-0 h-7 w-auto will-change-transform"
        style={{ opacity: 0 }}
      />
      </div>

      <div className="relative px-5 py-5 sm:px-7 sm:py-7">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <CalendarDays className="h-3.5 w-3.5 text-blue-ink dark:text-blue-glow" strokeWidth={2} aria-hidden="true" />
          <span className="first-letter:uppercase">{today}</span>
        </p>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.04em] leading-[1.05] text-slate-900 dark:text-white">
            Monitoreo{' '}
            <span className="text-blue-ink dark:text-blue-glow">de medios</span>
          </h1>
          <div className="inline-flex flex-col border-l-4 border-argos-gold pl-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Notas analizadas
            </span>
            <span className="text-3xl sm:text-4xl font-bold tabular-nums tracking-[-0.03em] leading-none text-slate-900 dark:text-white mt-1">
              {totalCount.toLocaleString('es-MX')}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
