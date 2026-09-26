'use client';
import { useShowroom, type View } from '@/store/showroom';

const isDetail = (v: View) => v.kind !== 'node';

/**
 * Browser Back / Forward for the showroom: opening a piece (or the counter, the combos table or a
 * member of staff) adds one history entry, so the browser's Back button closes it and returns the
 * visitor to where they stood, exactly like "Back to room". Room-to-room walks are not added, so
 * Back never jumps the visitor around the shop.
 */
export function startHistorySync() {
  let pushed = false;
  let ignorePop = false;
  let fromPop = false;

  const unsub = useShowroom.subscribe((s, prev) => {
    if (s.view === prev.view) return;
    if (isDetail(s.view) && !isDetail(prev.view) && s.phase === 'inside') {
      history.pushState({ ishe: 'detail' }, '');
      pushed = true;
    } else if (!isDetail(s.view) && isDetail(prev.view) && pushed) {
      pushed = false;
      if (fromPop) { fromPop = false; return; }
      // Closed from the page ("Back to room", Esc): drop our history entry too.
      ignorePop = true;
      history.back();
    }
  });

  const onPop = () => {
    if (ignorePop) { ignorePop = false; return; }
    const s = useShowroom.getState();
    if (isDetail(s.view) && pushed) {
      fromPop = true;
      if (s.view.kind === 'cashier') s.endCheckout(); else s.back();
    }
  };
  addEventListener('popstate', onPop);
  return () => { unsub(); removeEventListener('popstate', onPop); };
}
