'use client';

import Link from 'next/link';
import {useCinemaLoader} from './cinema-preloader';
import {usePathname, useRouter} from 'next/navigation';
import {createContext, useCallback, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode} from 'react';

const MotionContext = createContext<((href: string) => boolean) | null>(null);
const ease = 'cubic-bezier(.22, 1, .36, 1)';
const revealTargets = [
  '.hero-copy > *', '.hero-card', '.page-heading .eyebrow', '.page-heading h1', '.page-heading p',
  '.highlights > span', '.section-head', '.movie-toolbar', '.movie-grid:not(.movie-carousel) > .movie-card', '.movie-carousel', '.movie-carousel-controls',
  '.listings-note', '.feature-photo', '.feature-copy > *', '.venue-card',
  '.cafe-panel', '.heritage > *', '.wide-photo', '.amenity-grid > article',
  '.inline-cta', '.story-layout > *', '.timeline > article', '.gallery-tile',
  '.contact-card', '.contact-secondary > div', '.faq > *',
  'footer .footer-main > div', '.footer-cta > *',
  '.collection-heading', '.document-book', '.advertising-intro > *', '.advertising-formats > article',
  '.career-layout > *', '.career-steps > *', '.form-section > *',
].join(',');
// Photos slide in from the side, cards rise and scale, everything else fades up.
const fromLeft = '.feature-photo, .story-layout > img, .advertising-intro > img, .career-photo, .heritage-year, .footer-cta > :first-child';
const fromRight = '.feature-copy > *, .story-layout > .prose, .advertising-intro > .prose, .career-layout > .prose, .heritage > div, .footer-cta > :last-child';
const lifted = '.hero-card, .venue-card, .amenity-grid > article, .timeline > article, .advertising-formats > article, .gallery-tile, .contact-card, .contact-secondary > div, .movie-grid:not(.movie-carousel) > .movie-card';
function keyframesFor(element: Element): Keyframe[] {
  const end = {opacity: 1, transform: 'translate3d(0,0,0) scale(1)'};
  if (element.matches(fromLeft)) return [{opacity: 0, transform: 'translate3d(-44px,0,0) scale(1)'}, end];
  if (element.matches(fromRight)) return [{opacity: 0, transform: 'translate3d(44px,0,0) scale(1)'}, end];
  if (element.matches(lifted)) return [{opacity: 0, transform: 'translate3d(0,28px,0) scale(.95)'}, end];
  return [{opacity: 0, transform: 'translate3d(0,18px,0) scale(1)'}, end];
}

export function MotionProvider({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const {canReveal, beginNavigation} = useCinemaLoader();
  const router = useRouter();
  const completed = useRef(new WeakSet<Element>());

  const navigate = useCallback((href: string) => {
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin || target.pathname.replace(/\/$/, '') === window.location.pathname.replace(/\/$/, '')) return false;
    beginNavigation();
    router.push(target.pathname + target.search + target.hash);
    return true;
  }, [router, beginNavigation]);

  useLayoutEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pending = new Set<HTMLElement>();
    const animations = new Map<HTMLElement, Animation>();
    let observer: IntersectionObserver | undefined;
    let mutations: MutationObserver | undefined;

    function finish(element: HTMLElement) {
      completed.current.add(element);
      pending.delete(element);
      delete element.dataset.motion;
      element.dataset.revealed = 'true';
      animations.get(element)?.cancel();
      animations.delete(element);
      observer?.unobserve(element);
    }
    function reveal(element: HTMLElement, order = 0) {
      if (!pending.has(element) || animations.has(element)) return;
      observer?.unobserve(element);
      if (preference.matches) { finish(element); return; }
      // Keep the prepared state through any stagger; release it atomically at the end.
      const animation = element.animate(keyframesFor(element), {duration: 760, delay: Math.min(order, 4) * 80, easing: ease, fill: 'both'});
      animations.set(element, animation);
      void animation.finished.then(() => finish(element)).catch(() => {});
    }
    function register() {
      const targets = Array.from(document.querySelectorAll<HTMLElement>(revealTargets));
      const targetSet = new Set<Element>(targets);
      let order = 0;
      for (const element of targets) {
        // One reveal per visual group; nested fades multiply opacity and cause a blink.
        let parent = element.parentElement;
        while (parent && !targetSet.has(parent)) parent = parent.parentElement;
        if (parent || completed.current.has(element) || pending.has(element)) continue;
        if (preference.matches || !('IntersectionObserver' in window)) { finish(element); continue; }
        element.dataset.motion = 'pending';
        pending.add(element);
        if (!canReveal) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) reveal(element, order++);
        else if (rect.bottom <= 0) finish(element);
        else observer?.observe(element);
      }
    }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        let order = 0;
        for (const entry of entries) if (entry.isIntersecting) reveal(entry.target as HTMLElement, order++);
      }, {threshold: 0, rootMargin: '0px 0px -16px 0px'});
    }
    // Layout effects run before paint, while the initial page is still behind curtains.
    register();
    mutations = new MutationObserver(register);
    const main = document.getElementById('main');
    if (main) mutations.observe(main, {childList: true, subtree: true});
    const onPreference = () => {
      if (preference.matches) for (const element of pending) finish(element);
    };
    const onFocus = (event: FocusEvent) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-motion="pending"]') : null;
      if (element) finish(element);
    };
    preference.addEventListener('change', onPreference);
    document.addEventListener('focusin', onFocus);
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      for (const [element, animation] of animations) {
        completed.current.add(element);
        animation.cancel();
      }
      for (const element of pending) delete element.dataset.motion;
      preference.removeEventListener('change', onPreference);
      document.removeEventListener('focusin', onFocus);
    };
  }, [pathname, canReveal]);

  return <MotionContext.Provider value={navigate}>{children}</MotionContext.Provider>;
}

export function MotionLink({href, onNavigate, ...props}: ComponentProps<typeof Link>) {
  const navigate = useContext(MotionContext);
  return <Link {...props} href={href} onNavigate={event => {
    onNavigate?.(event);
    if (typeof href === 'string' && navigate?.(href)) event.preventDefault();
  }}/>;
}
