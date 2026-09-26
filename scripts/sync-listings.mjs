// Checks the District extractor from the command line without touching the database:
//   npm run sync:listings
// The site refreshes listings itself through /api/cron/listings and when showtimes are stale.
import {collectListings} from './lib/listings.mjs';

const result = await collectListings();
for (const [id, venue] of Object.entries(result.venues)) {
  console.log(`${id}: ${venue.error ? 'FAILED — ' + venue.error : `${venue.movies.length} movies`}${venue.skippedDates?.length ? ` (skipped ${venue.skippedDates.join(', ')})` : ''}`);
}
if (Object.values(result.venues).some(venue => venue.error)) process.exitCode = 1;
