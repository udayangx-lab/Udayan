'use client';

import {useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent} from 'react';
import {ArrowUpRight, ChevronLeft, ChevronRight, MapPin} from 'lucide-react';
import {useSiteContent} from './site-content';
import {useCinema} from './site-shell';
import {useBooking} from './booking-chooser';
import {useLiveListings} from './live-listings';
import {dayLabel, indiaDate, runtime, titleKey, type ComingSoon, type LiveMovie, type Show} from '@/lib/listings';

type Card = {id: string; title: string; poster: string; language?: string; format?: string; censor?: string; duration?: number; sessions: Show[];
  badge: string; note?: string; releaseDate?: string; url?: string; advance?: boolean};
const stamp = (movie: Pick<LiveMovie, 'censor' | 'duration'>) => [movie.censor, runtime(movie.duration)].filter(Boolean).join(' · ');

export function MovieBrowser({compact = false}: {compact?: boolean}) {
  const {cinemas, upcoming: curated} = useSiteContent();
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
  const today = indiaDate(new Date(now || Date.now()));
  // Coming soon for this cinema: District's upcoming releases and the cinema's own titles, minus anything already
  // bookable here. A title with advance booking open at the other Udayan cinema says so.
  const bookable = (movies: LiveMovie[]) => new Set(movies.filter(movie => movie.sessions.some(show => Date.parse(show.startsAt) > now)).flatMap(movie => [titleKey(movie.title), movie.contentId ? 'id:' + movie.contentId : '']).filter(Boolean));
  const here = bookable(cachedMovies);
  const elsewhere = cinemas.filter((_, i) => i !== index).map(cinema => ({cinema, keys: bookable(feed?.venues[cinema.id]?.movies || [])}));
  const upcoming: ComingSoon[] = (feed?.upcoming ?? curated.map(movie => ({...movie, source: 'curated' as const}))).filter(movie => !here.has(titleKey(movie.title)) && !here.has('id:' + movie.id));
  const data: Card[] = tab === 'showing'
    ? currentMovies.filter(movie => activeLanguage === 'All languages' || movie.language === activeLanguage).map(movie => {
      const advance = Boolean(movie.releaseDate && movie.releaseDate > today);
      return {...movie, advance, badge: advance ? 'ADVANCE BOOKING' : movie.format || 'IN CINEMAS', note: stamp(movie)};
    })
    : upcoming.map(movie => {
      const open = elsewhere.find(({keys}) => keys.has(titleKey(movie.title)) || keys.has('id:' + movie.id));
      return {id: movie.id, title: movie.title, poster: movie.poster || '/images/udayancinema-logo.png', language: movie.language, censor: movie.censor, duration: movie.duration, sessions: [],
        releaseDate: movie.releaseDate, url: movie.url, badge: movie.releaseDate ? dayLabel(movie.releaseDate, now || Date.now()).toUpperCase() : 'COMING SOON',
        note: open ? `Advance booking open at ${open.cinema.name}` : movie.releaseDate ? `Releases ${dayLabel(movie.releaseDate, now || Date.now())}` : undefined};
    });

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
      <div className="show-dates" role="group" aria-label="Show dates">{availableDates.map(value => <button key={value} className={date === value ? 'selected' : ''} aria-pressed={date === value} onClick={() => setChosenDate(value)}>{dayLabel(value, now)}</button>)}</div>
      <p className={stale ? 'sync-status stale' : 'sync-status'}>{venue?.lastSuccessAt ? `${stale ? 'Last saved listings' : 'Updated from District'} · ${new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}).format(new Date(venue.lastSuccessAt))} IST` : unavailable ? 'Listings temporarily unavailable' : 'Fetching the latest shows…'}</p>
      {stale && venue?.lastSuccessAt && <p className="sync-warning">Updates are delayed. Confirm show availability on your booking platform.</p>}
    </div>}
    {tab === 'upcoming' && data.length === 0 && <div className="movie-empty"><h3>New releases are on their way.</h3><p>{feed ? 'There are no announced releases to show right now. Check back soon.' : 'Loading upcoming releases…'}</p></div>}
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
        <button type="button" className="poster-link" onClick={() => openBooking(tab === 'showing' ? {movie: movie.title, language: movie.language, date} : {movie: movie.title, language: movie.language, upcoming: true, releaseDate: movie.releaseDate, districtUrl: movie.url})} aria-label={`${tab === 'showing' ? 'Choose booking platform for' : 'Booking options for upcoming'} ${movie.title}${movie.language ? ' in ' + movie.language : ''} at ${cinemas[index].name}`}>
          <img src={movie.poster} alt={movie.title + ' movie poster'} loading="lazy" onError={event => { event.currentTarget.onerror = null; if (!event.currentTarget.src.endsWith('/images/udayancinema-logo.png')) event.currentTarget.src = '/images/udayancinema-logo.png'; }}/>
          <span className={movie.advance ? 'poster-badge advance' : 'poster-badge'}>{movie.badge}</span>
          <span className="poster-action">{tab === 'showing' ? 'Book tickets' : movie.url ? 'View details' : 'Check availability'}<ArrowUpRight size={19}/></span>
        </button>
        <div className="movie-meta"><span>{[movie.language || 'Upcoming release', movie.advance ? movie.format : ''].filter(Boolean).join(' · ')}</span><span>{String(i + 1).padStart(2, '0')}</span></div><h3>{movie.title}</h3>
        {movie.note && <p className="movie-note">{movie.note}</p>}
        {tab === 'showing' && <div className="show-times" aria-label={`${movie.title} showtimes`}>{movie.sessions.map(show => <button key={show.id} title={[show.label || show.screen, show.price ? `from ₹${show.price}` : ''].filter(Boolean).join(' · ')} aria-label={`Book ${movie.title} at ${show.time}, ${dayLabel(show.date, now)}${show.screen ? ', ' + show.screen : ''}`}
          onClick={() => openBooking({movie: movie.title, language: [movie.language, movie.format].filter(Boolean).join(' '), date: show.date, time: show.time, screen: show.screen, price: show.price, startsAt: show.startsAt, districtUrl: show.districtUrl, seat: show.seat})}>{show.time}</button>)}</div>}
      </article>)}
    </div>
    <div className="listings-note"><span><MapPin size={14}/>{tab === 'showing' ? `Booking at Udayan ${cinemas[index].name}` : `Coming to Udayan ${cinemas[index].name}`}</span><span>{tab === 'showing' ? 'Shows refresh from District every 30 minutes. Confirm prices and seats on your booking platform.' : 'Please note that the list of upcoming movies is tentative and subject to change.'}</span></div>
  </>;
}
