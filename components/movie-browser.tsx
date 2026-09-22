'use client';

import {useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent} from 'react';
import {ArrowUpRight, ChevronLeft, ChevronRight, MapPin} from 'lucide-react';
import {movies, upcoming, cinemas} from '@/lib/data';
import {useCinema} from './site-shell';

export function MovieBrowser({compact = false}: {compact?: boolean}) {
  const [tab, setTab] = useState('showing');
  const [language, setLanguage] = useState('All languages');
  const {index} = useCinema();
  const track = useRef<HTMLDivElement>(null);
  const trackId = useId();
  const [position, setPosition] = useState({first: 1, last: 4, previous: false, next: true});
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'upcoming') setTab('upcoming');
  }, []);
  const data: {title: string; image: string; language?: string}[] = tab === 'showing'
    ? movies.filter(movie => language === 'All languages' || movie.language === language)
    : upcoming;

  useLayoutEffect(() => {
    const element = track.current;
    if (!compact || !element) return;
    element.scrollTo({left: 0, behavior: 'instant'});
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const visible = Array.from(element.children).map((card, i) => ({rect: card.getBoundingClientRect(), i}))
        .filter(({rect}) => rect.right > bounds.left + 2 && rect.left < bounds.right - 2);
      const next = {
        first: visible.length ? visible[0].i + 1 : 0,
        last: visible.length ? visible[visible.length - 1].i + 1 : 0,
        previous: element.scrollLeft > 2,
        next: element.scrollLeft < element.scrollWidth - element.clientWidth - 2,
      };
      setPosition(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(element);
    element.addEventListener('scroll', update, {passive: true});
    return () => { resize.disconnect(); element.removeEventListener('scroll', update); };
  }, [compact, tab, language, data.length]);

  function slide(direction: number) {
    const element = track.current;
    if (!element || !element.firstElementChild) return;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    const stride = element.firstElementChild.getBoundingClientRect().width + gap;
    const page = Math.max(1, Math.floor((element.clientWidth + gap + 1) / stride));
    element.scrollBy({left: direction * stride * page, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      slide(event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const element = track.current;
      element?.scrollTo({left: event.key === 'Home' ? 0 : element.scrollWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    }
  }

  return <>
    <div className="movie-toolbar">
      <div className="movie-tabs" role="group" aria-label="Movie listings">
        <button aria-pressed={tab === 'showing'} className={tab === 'showing' ? 'selected' : ''} onClick={() => setTab('showing')}>Now showing<span>{movies.length}</span></button>
        <button aria-pressed={tab === 'upcoming'} className={tab === 'upcoming' ? 'selected' : ''} onClick={() => setTab('upcoming')}>Coming soon<span>{upcoming.length}</span></button>
      </div>
      {tab === 'showing' && <label className="language-filter"><span className="sr-only">Filter movies by language</span><select value={language} onChange={event => setLanguage(event.target.value)}>{['All languages', 'Hindi', 'English', 'Bangla'].map(value => <option key={value}>{value}</option>)}</select></label>}
    </div>
    {compact && <div className="movie-carousel-controls">
      <span className="carousel-count" role="status" aria-live="polite" aria-atomic="true">{position.first}–{Math.min(position.last, data.length)} of {data.length} movies</span>
      <div className="carousel-navigation"><span className="carousel-hint">Swipe or use the arrows</span>
        <button className="icon-button carousel-arrow" aria-label="Previous movies" aria-controls={trackId} disabled={!position.previous} onClick={() => slide(-1)}><ChevronLeft size={20}/></button>
        <button className="icon-button carousel-arrow" aria-label="Next movies" aria-controls={trackId} disabled={!position.next} onClick={() => slide(1)}><ChevronRight size={20}/></button>
      </div>
    </div>}
    <div ref={track} id={trackId} className={compact ? 'movie-grid movie-carousel' : 'movie-grid'} role={compact ? 'region' : undefined} aria-roledescription={compact ? 'carousel' : undefined} aria-label={compact ? `${tab === 'showing' ? 'Now showing' : 'Coming soon'} movies` : undefined} tabIndex={compact ? 0 : undefined} onKeyDown={compact ? onKeyDown : undefined}>
      {data.map((movie, i) => <article className="movie-card" key={movie.image}>
        <a href={tab === 'showing' ? cinemas[index].booking : '/movies?tab=upcoming'} className="poster-link" target={tab === 'showing' ? '_blank' : undefined} rel={tab === 'showing' ? 'noreferrer' : undefined} aria-label={tab === 'showing' ? `Check ${movie.title} ${movie.language || ''} showtimes at ${cinemas[index].name}` : `${movie.title}, coming soon`}>
          <img src={'/images/' + movie.image} alt={movie.title + ' movie poster'} loading="lazy"/>
          <span className="poster-badge">{tab === 'showing' ? '2D' : 'COMING SOON'}</span>
          <span className="poster-action">{tab === 'showing' ? 'Check showtimes' : 'Coming to the big screen'}<ArrowUpRight size={19}/></span>
        </a>
        <div className="movie-meta"><span>{movie.language || 'Upcoming release'}</span><span>{String(i + 1).padStart(2, '0')}</span></div><h3>{movie.title}</h3>
      </article>)}
    </div>
    <div className="listings-note"><span><MapPin size={14}/>{tab === 'showing' ? `Booking at Udayan ${cinemas[index].name}` : 'More stories to look forward to'}</span><span>{tab === 'showing' ? 'Check BookMyShow for current availability, showtimes & prices.' : 'Release dates to be announced by the cinema.'}</span></div>
  </>;
}
