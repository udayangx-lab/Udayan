// Netlify Scheduled Function: refreshes District showtimes every 30 minutes by calling the
// site's protected cron route. Scheduled functions run only on published production deploys.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn('[listings] URL or CRON_SECRET is not set; skipping the scheduled refresh.');
    return;
  }
  const response = await fetch(`${base}/api/cron/listings`, {headers: {authorization: `Bearer ${secret}`}, signal: AbortSignal.timeout(25000)});
  console.log('[listings]', response.status, await response.text());
};

export const config = {schedule: '*/30 * * * *'};
