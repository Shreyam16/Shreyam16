'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PRODUCTS, ROOMS, type RoomId } from '@/data/catalogue';
import { ROOM_ENTRY, ROOM_STOPS } from '@/scene/layout';
import { useShowroom } from '@/store/showroom';
import { held, type HeldKey } from '@/scene/input';
import { Icon } from './ui/primitives';

const ROOM_ORDER: RoomId[] = ['left', 'centre', 'right'];
const ARROW: Record<RoomId, string> = { left: 'arrowLeft', centre: 'arrowUp', right: 'arrowRight' };

export function JunctionChooser() {
  const goTo = useShowroom((s) => s.goTo);
  const reduced = useShowroom((s) => s.reducedMotion);
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 px-3 pb-4 md:bottom-8 md:px-0"
      role="group" aria-label="Choose a room" data-testid="junction-chooser"
    >
      <p className="plaque-label mb-3 text-center text-ink/70">Where would you like to begin?</p>
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 md:gap-3">
        {ROOM_ORDER.map((r) => (
          <button key={r} type="button" onClick={() => goTo({ kind: 'node', node: ROOM_ENTRY[r] })} data-testid={`choose-${r}`}
            className="group glass-panel flex min-h-[96px] flex-col items-center justify-center gap-1 px-2 py-3 text-center hover:bg-ink hover:text-bone md:min-h-[120px]">
            <Icon name={ARROW[r]} className="h-6 w-6" />
            <span className="plaque-label">{ROOMS[r].direction}</span>
            <span className="editorial text-[17px] leading-tight md:text-[22px]">{ROOMS[r].label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function MiniMap({ room, onPick }: { room: RoomId | 'foyer'; onPick: (r: RoomId | 'foyer') => void }) {
  const fill = (r: RoomId | 'foyer') => (room === r ? '#0d0d0d' : 'transparent');
  const text = (r: RoomId | 'foyer') => (room === r ? '#fbf9f3' : '#0d0d0d');
  // 15 x 14 m plan drawn at 8 px/m; front (street) at the bottom.
  return (
    <svg viewBox="0 0 120 112" className="h-[92px] w-[98px]" role="img" aria-label="Showroom plan">
      <title>Showroom plan: a central aisle between two colonnades, side galleries left and right, the far end at the top; entrance at the bottom</title>
      <g stroke="#0d0d0d" strokeWidth="1" onClick={() => onPick('left')} style={{ cursor: 'pointer' }}>
        <rect x="0" y="0" width="36.8" height="112" fill={fill('left')} />
      </g>
      <g stroke="#0d0d0d" strokeWidth="1" onClick={() => onPick('right')} style={{ cursor: 'pointer' }}>
        <path d="M83.2 32H120V112H83.2Z" fill={fill('right')} />
      </g>
      <g stroke="#0d0d0d" strokeWidth="1" onClick={() => onPick('centre')} style={{ cursor: 'pointer' }}>
        <path d="M36.8 0H120V32H83.2V40H36.8Z" fill={fill('centre')} />
      </g>
      <g stroke="#0d0d0d" strokeWidth="1" onClick={() => onPick('foyer')} style={{ cursor: 'pointer' }}>
        <rect x="36.8" y="40" width="46.4" height="72" fill={fill('foyer')} />
      </g>
      {[92.8, 72, 51.2, 30.4].flatMap((y) => [36.8, 83.2].map((x) => (
        <rect key={`${x}${y}`} x={x - 2} y={y - 2} width="4" height="4" fill="#fbf9f3" stroke="#0d0d0d" strokeWidth="0.8" pointerEvents="none" />
      )))}
      <text x="18" y="60" fontSize="7" textAnchor="middle" fill={text('left')} fontFamily="Jost">L</text>
      <text x="60" y="22" fontSize="7" textAnchor="middle" fill={text('centre')} fontFamily="Jost">C</text>
      <text x="102" y="74" fontSize="7" textAnchor="middle" fill={text('right')} fontFamily="Jost">R</text>
      <text x="60" y="80" fontSize="6" textAnchor="middle" fill={text('foyer')} fontFamily="Jost">IN</text>
      <rect x="52" y="108" width="16" height="4" fill="#0d0d0d" />
    </svg>
  );
}

export function RoomNav() {
  const room = useShowroom((s) => s.room);
  const goTo = useShowroom((s) => s.goTo);
  const moving = useShowroom((s) => s.moving);
  const mode = useShowroom((s) => s.renderMode);
  const [open, setOpen] = useState(false);
  const here = room === 'foyer' ? [] : PRODUCTS.filter((p) => p.room === room);
  const pick = (r: RoomId | 'foyer') => goTo({ kind: 'node', node: ROOM_ENTRY[r] });
  useEffect(() => setOpen(false), [room]);

  return (
    <nav aria-label="Showroom wayfinding" id="main-controls" data-testid="room-nav"
      className="pointer-events-auto fixed bottom-0 left-0 z-20 w-full md:bottom-4 md:left-4 md:w-auto md:max-w-[620px]">
      <div className="glass-panel p-3">
        <div className="flex items-start gap-3">
          <div className="hidden md:block"><MiniMap room={room} onPick={pick} /></div>
          <div className="min-w-0 flex-1">
            <p className="plaque-label text-ink/60" aria-live="polite" data-testid="current-room">
              {moving ? 'Walking…' : room === 'foyer' ? 'Entrance hall' : ROOMS[room].label}
            </p>
            <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
              <RoomButton active={room === 'foyer'} onClick={() => pick('foyer')} label="Entrance hall" />
              {ROOM_ORDER.map((r) => (
                <RoomButton key={r} active={room === r} onClick={() => pick(r)} label={ROOMS[r].label} icon={ARROW[r]} testId={`nav-${r}`} />
              ))}
            </div>
            {room !== 'foyer' && (
              <div className="-mx-3 mt-1 flex items-center gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:mt-2 md:flex-wrap md:px-0">
                {ROOM_STOPS[room].map((st) => (
                  <button key={st.label} type="button"
                    onClick={() => (st.label === 'Combos' ? goTo({ kind: 'combos' }) : goTo({ kind: 'node', node: st.node }))}
                    className="min-h-[40px] shrink-0 px-2.5 font-ui text-[11px] uppercase tracking-[0.18em] text-ink/80 underline-offset-4 hover:underline" data-testid={`stop-${st.label.toLowerCase()}`}>
                    {st.label}
                  </button>
                ))}
                <button type="button" onClick={() => goTo({ kind: 'staff', id: room === 'centre' ? 'consultant' : room })} data-testid="talk-staff"
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 px-2.5 font-ui text-[11px] uppercase tracking-[0.18em] text-ink/80 underline-offset-4 hover:underline">
                  <Icon name="chat" className="h-3.5 w-3.5" /> {mode === 'lite' ? 'Guided tour' : room === 'centre' ? 'Ask the consultant' : 'Ask the attendant'}
                </button>
                <button type="button" aria-expanded={open} aria-controls="displays-here" onClick={() => setOpen((o) => !o)}
                  className="ml-auto min-h-[40px] shrink-0 border border-ink/25 px-3 font-ui text-[11px] uppercase tracking-[0.18em] hover:border-ink" data-testid="displays-toggle">
                  Displays here ({here.length})
                </button>
              </div>
            )}
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.ul id="displays-here" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="mt-2 grid max-h-[40dvh] grid-cols-1 overflow-y-auto border-t border-ink/10 pt-2 sm:grid-cols-2">
              {here.map((p) => (
                <li key={p.sku}>
                  <button type="button" onClick={() => goTo({ kind: 'product', sku: p.sku })} className="flex min-h-[44px] w-full items-baseline gap-2 px-1 text-left hover:bg-ink/5" data-testid={`display-btn-${p.sku}`}>
                    <span className="editorial text-[17px]">{p.name}</span>
                    <span className="font-ui text-[10px] tracking-[0.12em] text-ink/50">{p.sku}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}

function RoomButton({ active, onClick, label, icon, testId }: { active: boolean; onClick: () => void; label: string; icon?: string; testId?: string }) {
  return (
    <button type="button" aria-current={active ? 'location' : undefined} onClick={onClick} data-testid={testId}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap border px-3 font-ui text-[11px] uppercase tracking-[0.16em] ${active ? 'border-ink bg-ink text-bone' : 'border-ink/25 hover:border-ink'}`}>
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}{label}
    </button>
  );
}

/** Thumb-friendly hold-to-walk pad (touch devices), mirroring W / S / Q / E. */
export function MovePad() {
  const bind = (k: HeldKey) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      held[k] = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    },
    onPointerUp: () => { held[k] = false; },
    onPointerCancel: () => { held[k] = false; },
    onPointerLeave: () => { held[k] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const cls = 'grid h-14 w-14 place-items-center bg-paper/90 text-ink shadow active:bg-ink active:text-bone touch-none select-none';
  return (
    <div className="pointer-events-auto fixed bottom-[168px] right-3 z-20 grid grid-cols-3 gap-1 md:hidden" role="group" aria-label="Walk controls (hold)" data-testid="move-pad">
      <span />
      <button type="button" aria-label="Walk forward" className={cls} {...bind('forward')}><Icon name="arrowUp" /></button>
      <span />
      <button type="button" aria-label="Turn left" className={cls} {...bind('turnLeft')}><Icon name="turnLeft" /></button>
      <button type="button" aria-label="Step back" className={cls} {...bind('back')}><Icon name="arrowDown" /></button>
      <button type="button" aria-label="Turn right" className={cls} {...bind('turnRight')}><Icon name="turnRight" /></button>
    </div>
  );
}
