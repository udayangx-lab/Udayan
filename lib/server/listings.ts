import {collectListings} from '@/scripts/lib/listings.mjs';
import {query} from './db';
import {readSetting, writeSetting} from './content';
import type {LiveListings} from '@/lib/listings';

export type ListingOverrides = {hidden: string[]; titles: Record<string, string>; posters: Record<string, string>};
export const staleAfterMs = 30 * 60 * 1000;

export async function readListings() {return await readSetting<LiveListings>('live-listings');}

export async function readOverrides(): Promise<ListingOverrides> {
  const saved = await readSetting<Partial<ListingOverrides>>('listing-overrides') || {};
  return {hidden: Array.isArray(saved.hidden) ? saved.hidden : [], titles: saved.titles || {}, posters: saved.posters || {}};
}
export async function saveOverrides(value: ListingOverrides) {await writeSetting('listing-overrides', value);}

/** The public feed with admin corrections applied: hidden titles removed, titles and posters replaced. */
export function applyOverrides(feed: LiveListings, overrides: ListingOverrides): LiveListings {
  if (!overrides.hidden.length && !Object.keys(overrides.titles).length && !Object.keys(overrides.posters).length) return feed;
  const hidden = new Set(overrides.hidden);
  return {...feed, venues: Object.fromEntries(Object.entries(feed.venues).map(([id, venue]) => [id, {...venue,
    movies: venue.movies.filter(movie => !hidden.has(movie.id)).map(movie => ({...movie, title: overrides.titles[movie.id] || movie.title, poster: overrides.posters[movie.id] || movie.poster})),
  }]))};
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

/** Fetches District and stores the result. Returns null when another refresh is already running. */
export async function refreshListings() {
  if (!(await takeLease(2 * 60 * 1000))) return null;
  try {
    const previous = await readListings();
    const result = await collectListings({previous: previous || {venues: {}}}) as LiveListings;
    await writeSetting('live-listings', result);
    return result;
  } finally {
    await query("UPDATE settings SET value = '{\"until\":0}'::jsonb WHERE key = 'listings-lease'");
  }
}
