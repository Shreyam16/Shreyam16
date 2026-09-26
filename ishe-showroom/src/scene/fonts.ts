'use client';
import { useEffect, useState } from 'react';

/** Canvas-drawn signage needs the web fonts loaded first, or it bakes in a fallback face. */
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([document.fonts.load('500 60px "Cormorant Garamond"'), document.fonts.load('400 30px Jost')])
      .catch(() => undefined)
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);
  return ready;
}
