import {refreshListings} from '@/lib/server/listings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called by Vercel Cron (vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', {status: 401});
  const result = await refreshListings();
  if (!result) return Response.json({skipped: 'A refresh is already running.'});
  return Response.json({venues: Object.fromEntries(Object.entries(result.venues).map(([id, venue]) => [id, venue.error || `${venue.movies.length} movies`]))});
}
