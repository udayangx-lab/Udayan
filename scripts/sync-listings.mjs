// Checks the District extractor from the command line without touching the database:
//   npm run sync:listings
// The site refreshes listings itself through /api/cron/listings and when showtimes are stale.
import {collectListings, collectUpcoming} from './lib/listings.mjs';

const [result, upcoming] = await Promise.all([collectListings(), collectUpcoming()]);
for (const [id, venue] of Object.entries(result.venues)) {
  const shows = venue.movies.reduce((sum, movie) => sum + movie.sessions.length, 0);
  const seats = venue.movies.reduce((sum, movie) => sum + movie.sessions.filter(show => show.seat).length, 0);
  console.log(`${id}: ${venue.error ? 'FAILED — ' + venue.error : `${venue.movies.length} movies, ${shows} shows (${seats} with seat links) on ${venue.dates?.join(', ') || 'no dates'}`}${venue.failedDates?.length ? ` · failed dates ${venue.failedDates.join(', ')}` : ''}`);
  for (const movie of venue.movies) console.log(`  ${movie.title} · ${movie.language} ${movie.format} · ${[...new Set(movie.sessions.map(show => show.date))].map(date => `${date} ×${movie.sessions.filter(show => show.date === date).length}`).join(', ')}`);
}
console.log(`upcoming: ${upcoming.error ? 'FAILED — ' + upcoming.error : `${upcoming.films.length} films from District (Kolkata)`}`);
if (Object.values(result.venues).some(venue => venue.error) || upcoming.error) process.exitCode = 1;
