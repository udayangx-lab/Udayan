import type {Metadata} from 'next';
import {CircleAlert, CircleCheck, RefreshCw} from 'lucide-react';
import {requireAdmin} from '@/lib/server/auth';
import {readContent} from '@/lib/server/content';
import {readListings, readOverrides} from '@/lib/server/listings';
import {formatDate} from '@/components/admin/submission-table';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import {refreshNowShowing, saveMovieOverride} from '../../listings-actions';

export const metadata: Metadata = {title: 'Now showing'};

export default async function NowShowing({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await requireAdmin('content');
  const feed = await readListings();
  const overrides = readOverrides();
  const cinemas = readContent().cinemas;
  const now = Date.now();
  // One row per movie variant (title + language + format), across both cinemas.
  const movies = new Map<string, {id: string; title: string; language: string; format: string; poster: string; venues: string[]; shows: number}>();
  for (const cinema of cinemas) for (const movie of feed?.venues[cinema.id]?.movies || []) {
    const upcoming = movie.sessions.filter(show => Date.parse(show.startsAt) > now).length;
    const entry = movies.get(movie.id) || {id: movie.id, title: movie.title, language: movie.language, format: movie.format, poster: movie.poster, venues: [], shows: 0};
    entry.venues.push(cinema.name);
    entry.shows += upcoming;
    movies.set(movie.id, entry);
  }
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">WEBSITE</span><h1>Now showing</h1>
      <p className="admin-subtitle">Movies and showtimes are read from District every 30 minutes. Hide a listing or correct its title or poster here. Corrections stay in place across refreshes.</p></div>
      <form action={refreshNowShowing}><SubmitButton pending="Refreshing from District…"><RefreshCw size={15}/>Refresh now</SubmitButton></form></header>
    <Notice searchParams={searchParams}/>
    <section className="admin-sync">{cinemas.map(cinema => {
      const venue = feed?.venues[cinema.id];
      const age = venue?.lastSuccessAt ? now - Date.parse(venue.lastSuccessAt) : Infinity;
      const healthy = venue && !venue.error && age < 75 * 60 * 1000;
      return <div key={cinema.id} className={`admin-callout${healthy ? '' : ' warning'}`}>{healthy ? <CircleCheck size={20}/> : <CircleAlert size={20}/>}<div>
        <strong>{cinema.name}: {venue ? `${venue.movies.length} listings` : 'no data yet'}</strong>
        <p>{venue?.lastSuccessAt ? `Last successful update ${formatDate(venue.lastSuccessAt)} IST.` : 'Never updated successfully.'}
          {venue?.lastAttemptAt && venue.lastAttemptAt !== venue.lastSuccessAt ? ` Last attempt ${formatDate(venue.lastAttemptAt)} IST.` : ''}
          {venue?.error ? ` Error: ${venue.error.replace(/\.?$/, '.')}` : ''}{venue?.skippedDates?.length ? ` District did not provide shows for ${venue.skippedDates.join(', ')}; those dates appear once they reach the main listing.` : ''}{!healthy && venue?.lastSuccessAt ? ' The website shows a “delayed” notice until the next successful update.' : ''}</p></div></div>;
    })}</section>
    <section className="admin-panel">
      <div className="admin-panel-head"><h2>{movies.size} listings</h2></div>
      {!movies.size && <p className="admin-empty">No listings yet. Use Refresh now, or check that the listings worker is running.</p>}
      <div className="admin-movies">{[...movies.values()].map(movie => {
        const hidden = overrides.hidden.includes(movie.id);
        const poster = overrides.posters[movie.id] || movie.poster;
        return <form key={movie.id} id={movie.id} action={saveMovieOverride} className={`admin-movie${hidden ? ' hidden' : ''}`}>
          <input type="hidden" name="movie" value={movie.id}/><input type="hidden" name="original" value={movie.title}/>
          <label className="admin-poster"><img src={poster} alt=""/><input type="file" name="posterFile" accept="image/jpeg,image/png,image/webp" aria-label={`Replace poster for ${movie.title}`}/></label>
          <div className="admin-movie-fields">
            <label>Title<input name="title" defaultValue={overrides.titles[movie.id] || movie.title} maxLength={120}/></label>
            <small>{[movie.language, movie.format].filter(Boolean).join(' · ')} · {movie.venues.join(' & ')} · {movie.shows} upcoming shows{overrides.titles[movie.id] ? ` · District title: ${movie.title}` : ''}</small>
            <div className="admin-movie-options">
              <label className="admin-check"><input type="checkbox" name="hidden" defaultChecked={hidden}/>Hide from the website</label>
              {overrides.posters[movie.id] && <label className="admin-check"><input type="checkbox" name="resetPoster"/>Use District’s poster</label>}
            </div>
          </div>
          <SubmitButton className="admin-button small">Save</SubmitButton>
        </form>;
      })}</div>
    </section>
  </>;
}
