import {applyOverrides, readListings} from '@/lib/server/listings';

export const dynamic = 'force-dynamic';

// The listings worker rewrites the cache every 30 minutes; serve the latest copy with admin corrections applied.
export async function GET() {
  const feed = await readListings();
  if (!feed) return Response.json({error: 'Listings are refreshing'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  return Response.json(applyOverrides(feed), {headers: {'Cache-Control': 'no-store'}});
}
