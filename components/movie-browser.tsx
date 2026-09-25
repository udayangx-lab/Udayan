'use client';

import {useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent} from 'react';
import {ArrowUpRight, ChevronLeft, ChevronRight, MapPin} from 'lucide-react';
import {useSiteContent} from './site-content';
import {useCinema} from './site-shell';
import {useBooking} from './booking-chooser';
import {useLiveListings} from './live-listings';
import {dateLabel, type Show} from '@/lib/listings';

export function MovieBrowser({compact = false}: {compact?: boolean}) {
  const {cinemas, upcoming} = useSiteContent();
  const [tab, setTab] = useState('showing');
  const [language, setLanguage] = useState('All languages');
  const {index} = useCinema();
  const openBooking = useBooking();
  const {data: feed, unavailable, now} = useLiveListings();
  const [chosenDate, setChosenDate] = useState('');
  const venue = feed?.venues[cinemas[index].id];
  const age = venue?.lastSuccessAt ? now - Date.parse(venue.lastSuccessAt) : Infinity;
  const cachedMovies = age < 24 * 60 * 60 * 1000 ? venue?.movies || [] : [];
  const availableDates = [...new Set(cachedMovies.flatMap(movie => movie.sessions.filter(show => Date.parse(show.startsAt) > now).map(show => show.date)))].sort();
  const date = availableDates.includes(chosenDate) ? chosenDate : availableDates[0] || '';
  const currentMovies = cachedMovies.map(movie => ({...movie, sessions: movie.sessions.filter(show => show.date === date && Date.parse(show.startsAt) > now)})).filter(movie => movie.sessions.length);
  const languages = [...new Set(currentMovies.map(movie => movie.language))].sort();
  const activeLanguage = languages.includes(language) ? language : 'All languages';
  const stale = Boolean(unavailable || venue?.error || age > 75 * 60 * 1000);
  useEffect(() => { setChosenDate(''); setLanguage('All languages'); }, [index]);
  const track = useRef<HTMLDivElement>(null);
  const trackId = useId();
  const [position, setPosition] = useState({first: 1, last: 4, previous: false, next: true});
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'upcoming') setTab('upcoming');
  }, []);
  const data: {id: string; title: string; poster: string; language?: string; format?: string; sessions: Show[]}[] = tab === 'showing'
    ? currentMovies.filter(movie => activeLanguage === 'All languages' || movie.language === activeLanguage)
    : upcoming.map(movie => ({id: movie.id, title: movie.title, poster: movie.poster, sessions: []}));

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
  }, [compact, tab, activeLanguage, index, date, data.length]);

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
        <button aria-pressed={tab === 'showing'} className={tab === 'showing' ? 'selected' : ''} onClick={() => setTab('showing')}>Now showing<span>{currentMovies.length}</span></button>
        <button aria-pressed={tab === 'upcoming'} className={tab === 'upcoming' ? 'selected' : ''} onClick={() => setTab('upcoming')}>Coming soon<span>{upcoming.length}</span></button>
      </div>
      {tab === 'showing' && <label className="language-filter"><span className="sr-only">Filter movies by language</span><select value={activeLanguage} onChange={event => setLanguage(event.target.value)}>{['All languages', ...languages].map(value => <option key={value}>{value}</option>)}</select></label>}
    </div>
    {tab === 'showing' && <div className="show-schedule">
      <div className="show-dates" role="group" aria-label="Show dates">{availableDates.map(value => <button key={value} className={date === value ? 'selected' : ''} aria-pressed={date === value} onClick={() => setChosenDate(value)}>{dateLabel(value)}</button>)}</div>
      <p className={stale ? 'sync-status stale' : 'sync-status'}>{venue?.lastSuccessAt ? `${stale ? 'Last saved listings' : 'Updated from District'} · ${new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}).format(new Date(venue.lastSuccessAt))} IST` : unavailable ? 'Listings temporarily unavailable' : 'Fetching the latest shows…'}</p>
      {stale && venue?.lastSuccessAt && <p className="sync-warning">Updates are delayed. Confirm show availability on your booking platform.</p>}
    </div>}
    {tab === 'showing' && data.length === 0 && <div className="movie-empty"><h3>{!feed && !unavailable ? 'Finding your next movie…' : 'Check the latest shows.'}</h3><p>{!feed && !unavailable ? 'Loading listings for your selected Udayan Cinema.' : 'No upcoming shows are available here right now. Check District or BookMyShow for the latest bookings.'}</p><button className="button red" onClick={() => openBooking()}>Choose booking platform<ArrowUpRight size={18}/></button></div>}
    {compact && data.length > 0 && <div className="movie-carousel-controls">
      <span className="carousel-count" role="status" aria-live="polite" aria-atomic="true">{position.first}–{Math.min(position.last, data.length)} of {data.length} movies</span>
      <div className="carousel-navigation"><span className="carousel-hint">Swipe or use the arrows</span>
        <button className="icon-button carousel-arrow" aria-label="Previous movies" aria-controls={trackId} disabled={!position.previous} onClick={() => slide(-1)}><ChevronLeft size={20}/></button>
        <button className="icon-button carousel-arrow" aria-label="Next movies" aria-controls={trackId} disabled={!position.next} onClick={() => slide(1)}><ChevronRight size={20}/></button>
      </div>
    </div>}
    <div ref={track} id={trackId} className={compact ? 'movie-grid movie-carousel' : 'movie-grid'} role={compact ? 'region' : undefined} aria-roledescription={compact ? 'carousel' : undefined} aria-label={compact ? `${tab === 'showing' ? 'Now showing' : 'Coming soon'} movies` : undefined} tabIndex={compact ? 0 : undefined} onKeyDown={compact ? onKeyDown : undefined}>
      {data.map((movie, i) => <article className="movie-card" key={movie.id}>
        <button type="button" className="poster-link" onClick={() => openBooking({movie: movie.title, language: movie.language, date: tab === 'showing' ? date : undefined, upcoming: tab === 'upcoming'})} aria-label={`Choose booking platform for ${movie.title}${movie.language ? ' in ' + movie.language : ''} at ${cinemas[index].name}`}>
          <img src={movie.poster} alt={movie.title + ' movie poster'} loading="lazy" onError={event => { event.currentTarget.onerror = null; if (!event.currentTarget.src.endsWith('/images/udayancinema-logo.png')) event.currentTarget.src = '/images/udayancinema-logo.png'; }}/>
          <span className="poster-badge">{tab === 'showing' ? movie.format || 'IN CINEMAS' : 'COMING SOON'}</span>
          <span className="poster-action">{tab === 'showing' ? 'Book tickets' : 'Check availability'}<ArrowUpRight size={19}/></span>
        </button>
        <div className="movie-meta"><span>{movie.language || 'Upcoming release'}</span><span>{String(i + 1).padStart(2, '0')}</span></div><h3>{movie.title}</h3>
        {tab === 'showing' && <div className="show-times" aria-label={`${movie.title} showtimes`}>{movie.sessions.map(show => <button key={show.id} title={show.screen} aria-label={`Book ${movie.title} at ${show.time}, ${dateLabel(show.date)}, ${show.screen}`} onClick={() => openBooking({movie: movie.title, language: movie.language, date: show.date, time: show.time})}>{show.time}</button>)}</div>}
      </article>)}
    </div>
    <div className="listings-note"><span><MapPin size={14}/>{tab === 'showing' ? `Booking at Udayan ${cinemas[index].name}` : 'More stories to look forward to'}</span><span>{tab === 'showing' ? 'Shows refresh every 30 minutes. Confirm prices and seats on your booking platform.' : 'Upcoming titles are from the cinema’s published list; booking availability may vary.'}</span></div>
  </>;
}
