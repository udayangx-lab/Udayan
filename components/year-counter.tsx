'use client';

import {useCinemaLoader} from './cinema-preloader';
import {useLayoutEffect, useRef} from 'react';

/** Keep the accessible year stable, and prepare the visual count before paint. */
export default function YearCounter({year}: {year: number}) {
  const {canReveal} = useCinemaLoader();
  const number = useRef<HTMLSpanElement>(null);
  const completed = useRef(false);
  useLayoutEffect(() => {
    const element = number.current;
    if (!element) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let started = false;
    const finish = () => { cancelAnimationFrame(frame); element.textContent = String(year); };
    if (completed.current || preference.matches || !('IntersectionObserver' in window)) { finish(); return; }
    const from = Math.max(0, year - 100);
    element.textContent = String(from);
    if (!canReveal) return finish;
    const start = () => {
      if (started) return;
      started = true;
      observer.disconnect();
      const beginning = performance.now();
      function tick(now: number) {
        const progress = Math.min((now - beginning) / 1500, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element!.textContent = String(Math.round(from + (year - from) * eased));
        if (progress < 1) frame = requestAnimationFrame(tick);
        else completed.current = true;
      }
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) start();
    }, {threshold: 0});
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) start();
    else observer.observe(element);
    const onPreference = () => { if (preference.matches) { observer.disconnect(); completed.current = true; finish(); } };
    preference.addEventListener('change', onPreference);
    return () => { observer.disconnect(); finish(); preference.removeEventListener('change', onPreference); };
  }, [year, canReveal]);
  return <span className="year-counter" aria-label={String(year)}><span ref={number} aria-hidden="true">{year}</span></span>;
}
