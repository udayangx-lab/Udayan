'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {ArrowLeft, ArrowRight, Check, ChevronDown, LocateFixed, MapPin, X} from 'lucide-react';
import {MotionLink as Link} from './site-motion';
import {useSiteContent} from './site-content';
import {useCinema} from './site-shell';
import {useLiveListings} from './live-listings';
import DistrictLink from './district-link';
import WestBengalMap, {type MapView} from './wb-map';
import {distanceKm} from '@/lib/cinema-location';
import {dayLabel, runtime, type LiveMovie, type Show} from '@/lib/listings';

type Panel = 'map' | 'cinema' | 'showtimes';
const steps = ['Choose cinema', 'Pick a show', 'Seats on District'];
const upcomingShows = (movies: LiveMovie[], now: number) => movies.flatMap(movie => movie.sessions.filter(show => Date.parse(show.startsAt) > now).map(show => ({movie, show})))
  .sort((a, b) => a.show.startsAt.localeCompare(b.show.startsAt));
const distanceLabel = (km: number) => km < 1 ? 'Under 1 km away' : `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;

/**
 * The home page's booking flow: choose a cinema on the map (or by location), pick a show, then choose seats on District.
 * `intro` is the server-rendered heading and text; `stats` the figures under it.
 */
export default function HeroBooking({intro, stats}: {intro: ReactNode; stats: {value: ReactNode; label: string}[]}) {
  const {cinemas} = useSiteContent();
  const {index, setIndex, status, locate, position} = useCinema();
  const {data: feed, unavailable, now} = useLiveListings();
  const [panel, setPanel] = useState<Panel>('map');
  const [view, setView] = useState<MapView>('state');
  const [chosenDate, setChosenDate] = useState('');
  const [booked, setBooked] = useState(false);
  const touched = useRef(false);
  const cinema = cinemas[index] || cinemas[0];
  const venue = feed?.venues[cinema.id];
  const fresh = venue?.lastSuccessAt && now - Date.parse(venue.lastSuccessAt) < 24 * 60 * 60 * 1000;
  const movies = fresh ? venue.movies : [];
  const live = upcomingShows(movies, now);
  const dates = [...new Set(live.map(item => item.show.date))].sort();
  const date = dates.includes(chosenDate) ? chosenDate : dates[0] || '';
  const showing = movies.filter(movie => movie.sessions.some(show => Date.parse(show.startsAt) > now));
  const distance = position ? distanceKm(position, cinema.coordinates) : null;

  // A remembered cinema opens straight to its showtimes; a detected one is shown on the map first.
  useEffect(() => {
    if (touched.current) return;
    if (status === 'manual') setPanel('showtimes');
    if (status === 'nearest') { setView('hooghly'); setPanel('cinema'); }
  }, [status]);
  useEffect(() => { setChosenDate(''); setBooked(false); }, [index]);

  const act = (next: () => void) => { touched.current = true; next(); };
  const pick = (next: number) => act(() => { setIndex(next); setView('hooghly'); setPanel('cinema'); });
  const step = panel === 'showtimes' ? (booked ? 2 : 1) : 0;
  const locating = status === 'locating';
  const locationNote = {denied: 'Location access is off. Tap Udayan on the map instead.', unavailable: 'We couldn’t find your location. Tap Udayan on the map instead.'}[status as string];

  return <div className="hero-booking">
    <div className="hero-copy">
      {intro}
      <ol className="hero-steps" aria-label="How booking works">
        {steps.map((label, i) => <li key={label} data-state={i < step ? 'done' : i === step ? 'current' : 'next'} aria-current={i === step ? 'step' : undefined}>
          <span>{i < step ? <Check size={15} aria-hidden="true"/> : i + 1}</span>{label}
        </li>)}
      </ol>
      <div className="hero-chosen">
        <span className="hero-chosen-label">YOUR CINEMA</span>
        <strong><MapPin size={16} aria-hidden="true"/>Udayan {cinema.name}</strong>
        <button type="button" onClick={() => act(() => { setView('hooghly'); setPanel('map'); })}>Change</button>
      </div>
      <Link href="/movies" className="hero-films">
        <span className="hero-films-posters" aria-hidden="true">{showing.slice(0, 3).map(movie => <img key={movie.id} src={movie.poster} alt=""/>)}{!showing.length && <img src="/images/udayancinema-logo.png" alt=""/>}</span>
        <span><b>{feed ? showing.length : '–'}</b> {showing.length === 1 ? 'film' : 'films'} now showing<em>See all movies<ArrowRight size={15} aria-hidden="true"/></em></span>
      </Link>
      <dl className="hero-stats">{stats.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    </div>

    <section className="hero-card glass" aria-label="Find a show">
      {panel !== 'showtimes' ? <>
        <div className="hero-card-tools">
          <button type="button" className="button red hero-locate" onClick={() => act(locate)} aria-busy={locating}><LocateFixed size={18} aria-hidden="true"/>{locating ? 'Finding you…' : 'Use my location'}</button>
          <label className="hero-select"><MapPin size={17} aria-hidden="true"/><span className="sr-only">Choose a cinema</span>
            <select value={panel === 'map' && status !== 'manual' && status !== 'nearest' ? '' : String(index)} onChange={event => {
              if (event.target.value === '') return;
              act(() => { setIndex(Number(event.target.value)); setPanel('showtimes'); });
            }}>
              <option value="" disabled>Choose a cinema</option>
              {cinemas.map((item, i) => <option key={item.id} value={i}>Udayan {item.name}</option>)}
            </select><ChevronDown size={17} aria-hidden="true"/></label>
        </div>
        <p className="hero-card-hint" role="status">{locationNote || (view === 'state' ? 'Or tap Udayan on the map.' : 'Tap a cinema to see its next shows.')}</p>
        <div className="hero-map-frame">
          <WestBengalMap cinemas={cinemas} selected={panel === 'cinema' ? index : null} view={view} position={position}
            onView={next => act(() => { setView(next); if (next === 'state') setPanel('map'); })} onPick={pick}/>
          {panel === 'cinema' && <div className="hero-sheet glass" role="dialog" aria-label={`Udayan ${cinema.name}`}>
            <div className="hero-sheet-head">
              <div><span className="eyebrow">{cinema.tagline.toUpperCase()} · HOOGHLY</span><h3>Udayan {cinema.name}</h3></div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => act(() => setPanel('map'))}><X size={18}/></button>
            </div>
            <p className="hero-sheet-meta">{[distance !== null ? distanceLabel(distance) : '', cinema.parking].filter(Boolean).join(' · ')}</p>
            {live.length > 0 && <><span className="hero-sheet-label">NEXT SHOWS</span>
              <div className="hero-sheet-shows">{live.slice(0, 3).map(({movie, show}) =>
                <DistrictLink key={show.id} href={show.districtUrl} startsAt={show.seat ? show.startsAt : undefined} onClick={() => setBooked(true)}
                  aria-label={`${movie.title}, ${show.time} ${dayLabel(show.date, now)}: choose seats on District`}>
                  <b>{show.time}</b><span>{movie.title}</span>
                </DistrictLink>)}</div></>}
            {!live.length && <p className="hero-sheet-meta">{feed || unavailable ? 'No upcoming shows are listed right now.' : 'Loading shows…'}</p>}
            <button type="button" className="button red" onClick={() => act(() => setPanel('showtimes'))}>All showtimes<ArrowRight size={17} aria-hidden="true"/></button>
          </div>}
        </div>
      </> : <div className="hero-showtimes">
        <button type="button" className="hero-back" onClick={() => act(() => { setView('hooghly'); setPanel('map'); })}><ArrowLeft size={16} aria-hidden="true"/>Change cinema</button>
        <h3>Udayan {cinema.name}</h3>
        <p className="hero-showtimes-sub">{[cinema.tagline, distance !== null ? distanceLabel(distance) : ''].filter(Boolean).join(' · ')}</p>
        {dates.length > 0 && <div className="hero-dates" role="group" aria-label="Show dates">{dates.map(value => {
          const count = live.filter(item => item.show.date === value).length;
          return <button key={value} type="button" aria-pressed={date === value} onClick={() => setChosenDate(value)}>
            <b>{dayLabel(value, now)}</b><span>{count} {count === 1 ? 'show' : 'shows'}</span>
          </button>;
        })}</div>}
        <div className="hero-films-list">
          {!dates.length && <p className="hero-empty">{feed || unavailable ? <>No upcoming shows are listed here right now. <DistrictLink href={cinema.district}>Check District</DistrictLink></> : 'Loading the latest shows…'}</p>}
          {movies.map(movie => {
            const sessions = movie.sessions.filter(show => show.date === date && Date.parse(show.startsAt) > now);
            if (!sessions.length) return null;
            const multi = movie.formats.length > 1;
            return <article key={movie.id} className="hero-film">
              <img src={movie.poster} alt="" loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/udayancinema-logo.png'; }}/>
              <div>
                <h4>{movie.title}</h4>
                <p>{[movie.languages.join(', '), movie.formats.join(' / '), movie.censor, runtime(movie.duration)].filter(Boolean).join(' · ')}</p>
                <div className="hero-times">{sessions.map((show: Show) =>
                  <DistrictLink key={show.id} href={show.districtUrl} startsAt={show.seat ? show.startsAt : undefined} onClick={() => setBooked(true)}
                    aria-label={`${movie.title}, ${show.time}${multi ? ' ' + show.format : ''}${show.price ? `, from ₹${show.price}` : ''}: choose seats on District`}>
                    <b>{show.time}</b>{multi && <i>{show.format}</i>}{show.price ? <span>₹{show.price}</span> : null}
                  </DistrictLink>)}</div>
              </div>
            </article>;
          })}
        </div>
        <p className="hero-showtimes-foot"><img src="/brands/district.png" alt="District" width="160" height="64"/>Tap a time to choose seats on District. Prices from the lowest seat class.</p>
      </div>}
    </section>
  </div>;
}
