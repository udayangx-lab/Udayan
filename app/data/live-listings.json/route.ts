import {after} from 'next/server';
import {applyOverrides, isStale, readListings, readOverrides, refreshListings} from '@/lib/server/listings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Serves the stored listings with admin corrections. If they are older than 30 minutes (for example
// when Vercel's plan runs cron only daily), a refresh starts after this response is sent.
export async function GET() {
  let feed = await readListings();
  // A brand-new database has nothing to show yet, so the first visitor waits for the first fetch.
  if (!feed) feed = await refreshListings().catch(error => {console.error('[listings]', error); return null;});
  else if (isStale(feed)) after(() => refreshListings().catch(error => console.error('[listings]', error)));
  if (!feed) return Response.json({error: 'Listings are refreshing'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  return Response.json(applyOverrides(feed, await readOverrides()), {headers: {'Cache-Control': 'no-store'}});
}
