import {describeRefresh, readSyncSettings, recordRun, refreshListings} from '@/lib/server/listings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called every 15 minutes by the Netlify scheduled function (netlify/functions/refresh-listings.mjs) or Vercel Cron
// (vercel.json), with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', {status: 401});
  const at = new Date().toISOString();
  if (!(await readSyncSettings()).automatic) {
    await recordRun({trigger: 'scheduled', status: 'skipped', at, detail: 'Automatic fetching is off.'});
    return Response.json({skipped: 'Automatic fetching is switched off in the admin panel.'});
  }
  try {
    const result = await refreshListings();
    if (!result) {
      await recordRun({trigger: 'scheduled', status: 'busy', at, detail: 'Another refresh was already running.'});
      return Response.json({skipped: 'A refresh is already running.'});
    }
    const detail = describeRefresh(result);
    await recordRun({trigger: 'scheduled', status: 'completed', at, detail});
    return Response.json({completed: detail});
  } catch (error) {
    await recordRun({trigger: 'scheduled', status: 'failed', at, detail: String((error as Error).message)}).catch(() => {});
    throw error;
  }
}
