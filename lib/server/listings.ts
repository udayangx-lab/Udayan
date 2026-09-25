import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {cachePath} from './listings-cache';
import {dataDir} from './db';
import {readSetting, writeSetting} from './content';
import type {LiveListings} from '@/lib/listings';

export type ListingOverrides = {hidden: string[]; titles: Record<string, string>; posters: Record<string, string>};
const empty: ListingOverrides = {hidden: [], titles: {}, posters: {}};

export async function readListings(): Promise<LiveListings | null> {
  try {return JSON.parse(await fs.readFile(cachePath, 'utf8')) as LiveListings;} catch {return null;}
}

export function readOverrides(): ListingOverrides {
  const saved = readSetting<Partial<ListingOverrides>>('listing-overrides') || {};
  return {hidden: Array.isArray(saved.hidden) ? saved.hidden : [], titles: saved.titles || {}, posters: saved.posters || {}};
}
export function saveOverrides(value: ListingOverrides) {writeSetting('listing-overrides', value);}

/** The public feed with admin corrections applied: hidden titles removed, titles and posters replaced. */
export function applyOverrides(feed: LiveListings, overrides = readOverrides()): LiveListings {
  if (!overrides.hidden.length && !Object.keys(overrides.titles).length && !Object.keys(overrides.posters).length) return feed;
  const hidden = new Set(overrides.hidden);
  return {...feed, venues: Object.fromEntries(Object.entries(feed.venues).map(([id, venue]) => [id, {...venue,
    movies: venue.movies.filter(movie => !hidden.has(movie.id)).map(movie => ({...movie, title: overrides.titles[movie.id] || movie.title, poster: overrides.posters[movie.id] || movie.poster})),
  }]))};
}

let running: Promise<{ok: boolean; output: string}> | null = null;
/** Runs the same sync script as the 30-minute worker. Concurrent refreshes share one run. */
export function refreshListings() {
  running ??= new Promise<{ok: boolean; output: string}>(resolve => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts/sync-listings.mjs')], {cwd: process.cwd(), env: {...process.env, DATA_DIR: dataDir}});
    let output = '';
    child.stdout.on('data', chunk => {output += chunk;});
    child.stderr.on('data', chunk => {output += chunk;});
    child.on('error', error => resolve({ok: false, output: error.message}));
    child.on('close', code => resolve({ok: code === 0, output}));
  }).finally(() => {running = null;});
  return running;
}
