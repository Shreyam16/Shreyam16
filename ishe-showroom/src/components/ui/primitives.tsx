'use client';
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Product } from '@/data/catalogue';
import { CATEGORY_LABEL } from '@/data/catalogue';
import { useShowroom } from '@/store/showroom';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'onDark'; size?: 'md' | 'lg' };

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'secondary', size = 'md', className = '', ...rest }, ref) {
  const base = 'inline-flex items-center justify-center gap-2 font-ui uppercase tracking-[0.22em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none';
  const sz = size === 'lg' ? 'min-h-[52px] px-6 text-[12px]' : 'min-h-[44px] px-4 text-[11px]';
  const v = {
    primary: 'bg-ink text-bone hover:bg-[#2a2a2a]',
    secondary: 'border border-ink/80 text-ink hover:bg-ink hover:text-bone',
    ghost: 'text-ink hover:bg-ink/5',
    onDark: 'on-dark border border-bone/70 text-bone hover:bg-bone hover:text-ink',
  }[variant];
  return <button ref={ref} type="button" className={`${base} ${sz} ${v} ${className}`} {...rest} />;
});

export function IconButton({ label, children, className = '', badge, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; badge?: number }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`relative inline-grid h-11 w-11 place-items-center text-ink hover:bg-ink/5 ${className}`} {...rest}>
      {children}
      {badge ? (
        <span aria-hidden className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink px-1 font-ui text-[10px] text-bone">{badge}</span>
      ) : null}
    </button>
  );
}

export function Chip({ active, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button type="button" aria-pressed={active}
      className={`min-h-[40px] border px-3 font-ui text-[11px] uppercase tracking-[0.18em] ${active ? 'border-ink bg-ink text-bone' : 'border-ink/25 text-ink hover:border-ink'}`}
      {...rest}>{children}</button>
  );
}

const paths: Record<string, ReactNode> = {
  close: <path d="M5 5l14 14M19 5L5 19" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  box: <><rect x="4" y="9" width="16" height="11" /><path d="M4 9l2-4h12l2 4M12 9v11" /></>,
  soundOn: <><path d="M4 10v4h4l5 4V6L8 10H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></>,
  soundOff: <><path d="M4 10v4h4l5 4V6L8 10H4z" /><path d="M17 10l4 4M21 10l-4 4" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5v.4M12 16.6v.2" /></>,
  arrowLeft: <path d="M19 12H5m6-6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14m-6-6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5m-6 6l6-6 6 6" />,
  arrowDown: <path d="M12 5v14m-6-6l6 6 6-6" />,
  turnLeft: <path d="M9 7L4 12l5 5M4 12h9a6 6 0 0 1 6 6" />,
  turnRight: <path d="M15 7l5 5-5 5M20 12h-9a6 6 0 0 0-6 6" />,
  map: <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z M9 4v14 M15 6v14" />,
  back: <path d="M10 6l-6 6 6 6M4 12h11a5 5 0 0 1 0 10h-2" />,
};

export function Icon({ name, className = 'h-5 w-5', filled }: { name: keyof typeof paths | string; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function ProductImage({ product, className = '', sizes }: { product: Product; className?: string; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-[#efeae1] ${className}`}>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image.src} alt={product.image.alt} sizes={sizes} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center p-3 text-center">
          <span className="editorial text-lg italic text-ink/60">{CATEGORY_LABEL[product.category]}</span>
        </div>
      )}
    </div>
  );
}

export function SampleTag({ children = 'Sample' }: { children?: ReactNode }) {
  return <span className="inline-block border border-ink/30 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-[0.2em] text-ink/70">{children}</span>;
}

/** Side sheet on desktop, bottom sheet on phones. Escape closes; focus moves in and is restored. */
export function Sheet({ label, onClose, children, side = 'right', wide, testId }: { label: string; onClose: () => void; children: ReactNode; side?: 'right' | 'left'; wide?: boolean; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useShowroom((s) => s.reducedMotion);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], button, [href], input');
    first?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && ref.current) {
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); prev?.focus?.({ preventScroll: true }); };
  }, [onClose]);
  const fromX = side === 'right' ? 40 : -40;
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-testid={testId}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: fromX }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: fromX }}
      transition={{ duration: reduced ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-panel pointer-events-auto fixed z-40 flex flex-col text-ink
        inset-x-0 bottom-0 max-h-[82dvh] md:inset-x-auto md:bottom-4 md:top-4 md:max-h-none
        ${side === 'right' ? 'md:right-4' : 'md:left-4'} ${wide ? 'md:w-[460px]' : 'md:w-[400px]'}`}
    >
      {children}
    </motion.div>
  );
}

export function SheetHeader({ eyebrow, title, onClose, closeLabel = 'Close' }: { eyebrow?: ReactNode; title: ReactNode; onClose: () => void; closeLabel?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 pb-3 pt-4">
      <div>
        {eyebrow && <p className="plaque-label text-ink/60">{eyebrow}</p>}
        <h2 className="editorial mt-1 text-[28px] font-medium leading-tight">{title}</h2>
      </div>
      <button type="button" onClick={onClose} data-autofocus
        className="-mr-2 inline-flex min-h-[44px] items-center gap-2 px-2 font-ui text-[11px] uppercase tracking-[0.2em] hover:bg-ink/5">
        <Icon name="close" className="h-4 w-4" /> {closeLabel}
      </button>
    </div>
  );
}
