import {collectListings, collectUpcoming} from '@/scripts/lib/listings.mjs';
import {query} from './db';
import {readContent, readSetting, writeSetting} from './content';
import {buildComingSoon, defaultUpcomingSettings, type UpcomingSettings} from '@/lib/coming-soon';
import {indiaDate, type DistrictUpcoming, type ListingsFeed, type LiveListings} from '@/lib/listings';

export type ListingOverrides = {hidden: string[]; titles: Record<string, string>; posters: Record<string, string>};
export type SyncSettings = {automatic: boolean; updatedAt?: string};
export type SyncRun = {trigger: 'scheduled' | 'visitor' | 'admin'; status: 'completed' | 'skipped' | 'busy' | 'failed'; at: string; detail?: string};
export const staleAfterMs = 15 * 60 * 1000;

/** The stored feed, or null when it was written by an older version of the extractor (so the next request refetches). */
export async function readListings() {
  const feed = await readSetting<LiveListings>('live-listings');
  return feed?.version === 2 ? feed : null;
}
export async function readUpcoming() {return await readSetting<DistrictUpcoming>('upcoming-district');}

export async function readOverrides(): Promise<ListingOverrides> {
  const saved = await readSetting<Partial<ListingOverrides>>('listing-overrides') || {};
  return {hidden: Array.isArray(saved.hidden) ? saved.hidden : [], titles: saved.titles || {}, posters: saved.posters || {}};
}
export async function saveOverrides(value: ListingOverrides) {await writeSetting('listing-overrides', value);}

export async function readUpcomingSettings(): Promise<UpcomingSettings> {
  const saved = await readSetting<Partial<UpcomingSettings>>('upcoming-settings') || {};
  return {
    languages: Array.isArray(saved.languages) ? saved.languages.filter(item => typeof item === 'string') : defaultUpcomingSettings.languages,
    hidden: Array.isArray(saved.hidden) ? saved.hidden.filter(item => typeof item === 'string') : [],
    windowDays: Number.isInteger(saved.windowDays) && saved.windowDays! >= 7 && saved.windowDays! <= 180 ? saved.windowDays! : defaultUpcomingSettings.windowDays,
  };
}
export async function saveUpcomingSettings(value: UpcomingSettings) {await writeSetting('upcoming-settings', value);}

/** Automatic fetching can be switched off in Admin → Now showing. A missing record means on. */
export async function readSyncSettings(): Promise<SyncSettings> {
  const saved = await readSetting<Partial<SyncSettings>>('sync-settings');
  return {automatic: saved?.automatic !== false, updatedAt: saved?.updatedAt};
}
export async function saveSyncSettings(automatic: boolean) {await writeSetting('sync-settings', {automatic, updatedAt: new Date().toISOString()});}

/** The last run per trigger, so the admin can see that the schedule is actually running. */
export async function recordRun(run: SyncRun) {
  const runs = await readSetting<Partial<Record<SyncRun['trigger'], SyncRun>>>('sync-runs') || {};
  await writeSetting('sync-runs', {...runs, [run.trigger]: run});
}
export async function readRuns() {return await readSetting<Partial<Record<SyncRun['trigger'], SyncRun>>>('sync-runs') || {};}

/** The public feed with admin corrections applied: hidden titles removed, titles and posters replaced. */
export function applyOverrides(feed: LiveListings, overrides: ListingOverrides): LiveListings {
  if (!overrides.hidden.length && !Object.keys(overrides.titles).length && !Object.keys(overrides.posters).length) return feed;
  const hidden = new Set(overrides.hidden);
  return {...feed, venues: Object.fromEntries(Object.entries(feed.venues).map(([id, venue]) => [id, {...venue,
    movies: venue.movies.filter(movie => !hidden.has(movie.id)).map(movie => ({...movie, title: overrides.titles[movie.id] || movie.title, poster: overrides.posters[movie.id] || movie.poster})),
  }]))};
}

/** Everything /data/live-listings.json serves: showtimes with corrections, and the assembled Coming soon list. */
export async function publicFeed(feed: LiveListings): Promise<ListingsFeed> {
  const [overrides, district, settings, content] = await Promise.all([readOverrides(), readUpcoming(), readUpcomingSettings(), readContent()]);
  return {...applyOverrides(feed, overrides), upcoming: buildComingSoon({curated: content.upcoming, district: district?.films || [], settings, today: indiaDate()})};
}

export const isStale = (feed: LiveListings | null) => !feed || Date.now() - Date.parse(feed.lastAttemptAt) > staleAfterMs;

// A lease row stops two serverless instances (cron, a visitor, an admin) from refreshing at the same time.
async function takeLease(ms: number) {
  const until = Date.now() + ms;
  const rows = await query(`INSERT INTO settings (key, value) VALUES ('listings-lease', $1::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()
    WHERE (settings.value->>'until')::bigint < $2 RETURNING key`, [JSON.stringify({until}), Date.now()]);
  return rows.length > 0;
}

/**
 * Fetches District's showtimes (every open date at both cinemas) and its upcoming releases, and stores both.
 * Returns null when another refresh is already running.
 */
export async function refreshListings() {
  if (!(await takeLease(2 * 60 * 1000))) return null;
  try {
    const [previous, previousUpcoming] = await Promise.all([readListings(), readUpcoming()]);
    const [result, upcoming] = await Promise.all([
      collectListings({previous: previous || {venues: {}}}) as Promise<LiveListings>,
      collectUpcoming({previous: previousUpcoming}) as Promise<DistrictUpcoming>,
    ]);
    await Promise.all([writeSetting('live-listings', result), writeSetting('upcoming-district', upcoming)]);
    return {...result, upcoming};
  } finally {
    await query("UPDATE settings SET value = '{\"until\":0}'::jsonb WHERE key = 'listings-lease'");
  }
}

/** One-line outcome of a refresh, for run records and admin notices. */
export function describeRefresh(result: NonNullable<Awaited<ReturnType<typeof refreshListings>>>) {
  const venues = Object.entries(result.venues).map(([id, venue]) => venue.error ? `${id}: failed (${venue.error})` : `${id}: ${venue.movies.length} movies, ${venue.movies.reduce((sum, movie) => sum + movie.sessions.length, 0)} shows${venue.failedDates?.length ? `, ${venue.failedDates.length} dates kept from the last update` : ''}`);
  return [...venues, result.upcoming.error ? `upcoming: failed (${result.upcoming.error})` : `upcoming: ${result.upcoming.films.length} films`].join('; ');
}
