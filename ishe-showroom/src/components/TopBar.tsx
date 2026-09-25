'use client';
import { cartCount, useShowroom } from '@/store/showroom';
import { setAmbience } from '@/lib/sound';
import { Icon, IconButton } from './ui/primitives';

export default function TopBar() {
  const phase = useShowroom((s) => s.phase);
  const count = useShowroom((s) => cartCount(s.cart));
  const saved = useShowroom((s) => s.saved.length);
  const sound = useShowroom((s) => s.sound);
  const setSound = useShowroom((s) => s.setSound);
  const openDrawer = useShowroom((s) => s.openDrawer);
  const evening = useShowroom((s) => s.evening);
  const setEvening = useShowroom((s) => s.setEvening);
  const inside = phase === 'inside';
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between p-3 md:p-4">
      <a href="#main-controls" className="sr-only-focusable pointer-events-auto bg-paper px-3 py-2 font-ui text-sm">Skip to showroom controls</a>
      {/* Official wordmark on its white rectangular plaque. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/ishe-logo-plaque.png" alt="ISHÉ" width={1099} height={599}
        className="pointer-events-auto h-11 w-auto shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] md:h-14" />
      <nav aria-label="Showroom tools" className="pointer-events-auto flex items-center bg-paper/95 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]">
        {inside && (
          <IconButton label="Find a piece" onClick={() => openDrawer('finder')} data-testid="open-finder"><Icon name="search" /></IconButton>
        )}
        {/* Saved pieces are also a tab in the Jewel Box; the shortcut is hidden on narrow phones. */}
        <IconButton label={`Saved pieces (${saved})`} badge={saved} onClick={() => openDrawer('jewelBox')} className="!hidden sm:!inline-grid"><Icon name="heart" /></IconButton>
        <IconButton label={`Jewel Box (${count} items)`} badge={count} onClick={() => openDrawer('jewelBox')} data-testid="open-box"><Icon name="box" /></IconButton>
        <IconButton label="Book a private appointment" onClick={() => openDrawer('appointment')} data-testid="open-appointment"><Icon name="calendar" /></IconButton>
        <IconButton label="Evening mode" aria-pressed={evening} onClick={() => setEvening(!evening)} data-testid="evening-toggle">
          <Icon name={evening ? 'sun' : 'moon'} />
        </IconButton>
        <IconButton label={sound ? 'Turn sound off' : 'Turn sound on'} aria-pressed={sound} onClick={() => { setSound(!sound); setAmbience(!sound); }} data-testid="sound-toggle">
          <Icon name={sound ? 'soundOn' : 'soundOff'} />
        </IconButton>
        <IconButton label="Help and controls" onClick={() => openDrawer('help')}><Icon name="help" /></IconButton>
      </nav>
    </header>
  );
}
