import {after} from 'next/server';
import {describeRefresh, isStale, publicFeed, readListings, readSyncSettings, recordRun, refreshListings} from '@/lib/server/listings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function visitorRefresh() {
  const result = await refreshListings();
  if (result) await recordRun({trigger: 'visitor', status: 'completed', at: new Date().toISOString(), detail: describeRefresh(result)});
  return result;
}

// Serves the stored showtimes (with admin corrections) and the Coming soon list. If showtimes are older than
// 30 minutes, for example when a schedule was missed, a refresh starts after this response is sent.
export async function GET() {
  let feed = await readListings();
  const {automatic} = await readSyncSettings();
  // A brand-new database has nothing to show yet, so the first visitor waits for the first fetch.
  if (!feed && automatic) feed = await visitorRefresh().catch(error => {console.error('[listings]', error); return null;});
  else if (automatic && isStale(feed)) after(() => visitorRefresh().catch(error => console.error('[listings]', error)));
  if (!feed) return Response.json({error: 'Listings are refreshing'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  return Response.json(await publicFeed(feed), {headers: {'Cache-Control': 'no-store'}});
}
