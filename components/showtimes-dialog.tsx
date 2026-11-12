'use client';
import {useEffect, useRef} from 'react';
import {ArrowUpRight, MapPin, X} from 'lucide-react';
import DistrictLink from './district-link';
import {dayLabel, runtime, type LiveMovie} from '@/lib/listings';

/** A film's showtimes at the selected cinema, every date District has opened. Each showtime opens seat selection on District. */
export default function ShowtimesDialog({movie, venueName, venueUrl, now, onClose}: {movie: LiveMovie | null; venueName: string; venueUrl: string; now: number; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!movie || !element) return;
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = previous; };
  }, [movie]);
  const sessions = (movie?.sessions || []).filter(show => Date.parse(show.startsAt) > now);
  const dates = [...new Set(sessions.map(show => show.date))].sort();
  const multiFormat = (movie?.formats.length || 0) > 1, multiLanguage = (movie?.languages.length || 0) > 1;
  return <dialog className="showtimes-dialog" ref={dialog} aria-labelledby="showtimes-title" onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    {movie && <>
      <button type="button" className="icon-button showtimes-close" aria-label="Close" onClick={onClose}><X size={20}/></button>
      <div className="showtimes-head">
        <img src={movie.poster} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/udayancinema-logo.png'; }}/>
        <div>
          <span className="eyebrow">NOW SHOWING</span>
          <h2 id="showtimes-title">{movie.title}</h2>
          <p className="showtimes-meta">{[movie.languages.join(', '), movie.formats.join(' / '), movie.censor, runtime(movie.duration), movie.genres?.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}</p>
          <p className="showtimes-venue"><MapPin size={15}/>Udayan {venueName}</p>
        </div>
      </div>
      <div className="showtimes-body">
        {dates.length === 0 && <p className="showtimes-meta">No upcoming shows are listed right now.</p>}
        {dates.map(date => <section className="showtimes-day" key={date}>
          <h3>{dayLabel(date, now)}</h3>
          <div className="showtimes-list">{sessions.filter(show => show.date === date).map(show =>
            <DistrictLink key={show.id} href={show.districtUrl} startsAt={show.seat ? show.startsAt : undefined}
              aria-label={`${show.time}, ${dayLabel(show.date, now)}${multiFormat ? ', ' + show.format : ''}${show.screen ? ', ' + show.screen : ''}${show.price ? `, from ₹${show.price}` : ''}: choose seats on District`}>
              {show.time}
              <small>{[multiFormat ? show.format : '', multiLanguage ? show.language : '', show.screen, show.price ? `from ₹${show.price}` : ''].filter(Boolean).join(' · ')}</small>
            </DistrictLink>)}</div>
        </section>)}
      </div>
      <div className="showtimes-foot">
        <span><img src="/brands/district.png" alt="District" width="160" height="64"/>Tap a show to choose seats on District. Prices and availability are confirmed there; it opens in a new tab, or the District app on phones.</span>
        <DistrictLink className="text-link" href={venueUrl}>All shows on District<ArrowUpRight size={16}/></DistrictLink>
      </div>
    </>}
  </dialog>;
}
