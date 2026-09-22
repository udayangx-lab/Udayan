'use client';

import {usePathname} from 'next/navigation';
import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';

type Phase = 'loading' | 'opening' | 'idle';
const LoaderContext = createContext({isLoading: false, canReveal: true, beginNavigation: () => {}});
export const useCinemaLoader = () => useContext(LoaderContext);
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    if (signal.aborted) { resolve(); return; }
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, {once: true});
  });
}

async function waitForFirstFrame(signal: AbortSignal) {
  // Await the logo/hero, not every lazy-loaded poster and gallery photograph.
  const images = Array.from(document.images).filter(image => image.loading !== 'lazy' && image.getBoundingClientRect().top < window.innerHeight);
  const imageTasks = images.map(image => new Promise<void>(resolve => {
    if (image.complete || signal.aborted) { resolve(); return; }
    const done = () => {
      image.removeEventListener('load', done);
      image.removeEventListener('error', done);
      signal.removeEventListener('abort', done);
      resolve();
    };
    image.addEventListener('load', done, {once: true});
    image.addEventListener('error', done, {once: true});
    signal.addEventListener('abort', done, {once: true});
  }));
  await Promise.race([
    Promise.allSettled([...imageTasks, document.fonts?.ready ?? Promise.resolve()]),
    wait(1600, signal),
  ]);
}

export function CinemaLoaderProvider({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('loading');
  const [mounted, setMounted] = useState(false);
  const [intro, setIntro] = useState(true);
  const [sequence, setSequence] = useState(0);
  const isIntro = useRef(true);
  const started = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opening = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycle = useRef(0);
  const shownPhase = useRef<Phase>('loading');

  const dismiss = useCallback(() => {
    if (shownPhase.current !== 'loading') return;
    if (fallback.current) clearTimeout(fallback.current);
    if (opening.current) clearTimeout(opening.current);
    controller.current?.abort();
    shownPhase.current = 'opening';
    setPhase('opening');
    opening.current = setTimeout(() => {
      shownPhase.current = 'idle';
      setPhase('idle');
    }, prefersReducedMotion() ? 0 : 480);
  }, []);

  const beginNavigation = useCallback(() => {
    cycle.current += 1;
    controller.current?.abort();
    if (fallback.current) clearTimeout(fallback.current);
    if (opening.current) clearTimeout(opening.current);
    started.current = performance.now();
    shownPhase.current = 'loading';
    isIntro.current = false;
    setIntro(false);
    setSequence(value => value + 1);
    setPhase('loading');
    // Also covers aborted/failed navigation, where pathname never changes.
    fallback.current = setTimeout(dismiss, 3500);
  }, [dismiss]);

  useEffect(() => {
    setMounted(true);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => { if (preference.matches) dismiss(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) dismiss(); };
    preference.addEventListener('change', onPreference);
    window.addEventListener('pageshow', restore);
    return () => {
      cycle.current += 1;
      controller.current?.abort();
      if (fallback.current) clearTimeout(fallback.current);
      if (opening.current) clearTimeout(opening.current);
      preference.removeEventListener('change', onPreference);
      window.removeEventListener('pageshow', restore);
    };
  }, [dismiss]);

  useLayoutEffect(() => {
    if (shownPhase.current !== 'loading') beginNavigation();
    const initial = isIntro.current;
    if (!started.current) started.current = performance.now();
    const current = cycle.current;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = setTimeout(dismiss, 3500);
    const minimum = prefersReducedMotion() ? 0 : initial ? 1100 : 560;
    void Promise.all([
      wait(Math.max(0, minimum - (performance.now() - started.current)), abort.signal),
      waitForFirstFrame(abort.signal),
    ]).then(() => {
      if (!abort.signal.aborted && cycle.current === current) dismiss();
    });
    return () => abort.abort();
  }, [pathname, beginNavigation, dismiss]);

  const isLoading = phase !== 'idle';
  useLayoutEffect(() => {
    if (!isLoading) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isLoading]);
  return <LoaderContext.Provider value={{isLoading, canReveal: phase !== 'loading', beginNavigation}}>
    <div className="cinema-page" inert={mounted && isLoading} aria-busy={isLoading} data-loader-phase={phase}>{children}</div>
    {isLoading && <div key={sequence} className="cinema-loader" data-phase={phase} data-intro={intro}>
      <div className="loader-curtain loader-curtain-left" aria-hidden="true"/>
      <div className="loader-curtain loader-curtain-right" aria-hidden="true"/>
      <div className="loader-content" aria-hidden="true">
        <div className="loader-brand">UDAYAN<span>C I N E M A</span></div>
        <div className="film-countdown">
          <span className="countdown-crosshair horizontal"/><span className="countdown-crosshair vertical"/>
          <svg className="countdown-ring" viewBox="0 0 200 200"><circle className="ring-track" cx="100" cy="100" r="87"/><circle className="ring-progress" cx="100" cy="100" r="87"/><circle className="ring-inner" cx="100" cy="100" r="76"/></svg>
          <span className="countdown-digit digit-three">3</span><span className="countdown-digit digit-two">2</span><span className="countdown-digit digit-one">1</span>
        </div>
        <p className="loader-title">The show is about to begin.</p>
        <div className="loader-track"><span/></div>
        <span className="loader-caption">LIGHTS DOWN. UDAYAN ON.</span>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{phase === 'opening' ? 'Your page is ready.' : 'Udayan Cinema. Preparing your page.'}</div>
      {intro && phase === 'loading' && <button className="loader-skip" onClick={dismiss}>Skip intro <span aria-hidden="true">→</span></button>}
      <span className="loader-footer" aria-hidden="true">ENTERTAINING SINCE 1946</span>
    </div>}
    <noscript><style>{'.cinema-loader{display:none!important}.cinema-page{visibility:visible!important}'}</style></noscript>
  </LoaderContext.Provider>;
}
