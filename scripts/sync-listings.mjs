import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sources, parseDistrict, mergeMovies, indiaDate} from './lib/listings.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
export const cachePath = path.join(path.resolve(root, process.env.DATA_DIR || 'storage'), 'live-listings.json');
const lockPath = path.join(root, '.listings-sync.lock');
export const refreshInterval = 30 * 60 * 1000;
async function fetchPage(url, source, fetchImpl) {
  const response = await fetchImpl(url, {signal: AbortSignal.timeout(20000), headers: {'User-Agent': 'UdayanCinemaListings/1.0', 'Accept': 'text/html'}});
  if (!response.ok) throw new Error(`District returned HTTP ${response.status}`);
  return parseDistrict(await response.text(), source);
}
export async function syncListings({cacheFile = cachePath, lockFile = lockPath, fetchImpl = fetch} = {}) {
  try {
    const stat = await fs.stat(lockFile).catch(() => null);
    if (stat && Date.now() - stat.mtimeMs > 10 * 60 * 1000) await fs.unlink(lockFile);
    await fs.writeFile(lockFile, String(process.pid), {flag: 'wx'});
  } catch (error) { if (error.code === 'EEXIST') return; throw error; }
  try {
    let previous = {venues: {}};
    try { previous = JSON.parse(await fs.readFile(cacheFile, 'utf8')); } catch {}
    const attemptedAt = new Date().toISOString();
    const venues = {};
    await Promise.all(sources.map(async source => {
      try {
        const first = await fetchPage(source.url, source, fetchImpl);
        const today = indiaDate();
        const dates = first.dates.filter(date => date >= today).slice(0, 7);
        const covered = new Set(first.movies.flatMap(movie => movie.sessions.map(show => show.date)));
        const pages = [first];
        const skippedDates = [];
        // District renders some dated pages in the browser only. Keep the main page's shows rather than failing the venue.
        for (const date of dates) if (!covered.has(date)) {
          try { pages.push(await fetchPage(`${source.url}?fromdate=${date}`, source, fetchImpl)); }
          catch (error) { skippedDates.push(date); console.warn(`[listings] ${source.id} ${date}: ${error.message}; date skipped`); }
        }
        const movies = mergeMovies(pages).map(movie => ({...movie, sessions: movie.sessions.filter(show => show.date >= today)})).filter(movie => movie.sessions.length);
        venues[source.id] = {source: 'District', sourceUrl: source.url, lastSuccessAt: new Date().toISOString(), lastAttemptAt: attemptedAt, error: null, skippedDates, movies};
        console.log(`[listings] ${source.id}: ${movies.length} movie variants, ${movies.reduce((sum,movie) => sum + movie.sessions.length, 0)} shows`);
      } catch (error) {
        console.error(`[listings] ${source.id}: ${error.message}; keeping last successful data`);
        venues[source.id] = {...previous.venues?.[source.id], source: 'District', sourceUrl: source.url, lastAttemptAt: attemptedAt, error: String(error.message), movies: previous.venues?.[source.id]?.movies || []};
      }
    }));
    const result = {version: 1, refreshIntervalMinutes: 30, lastAttemptAt: attemptedAt, venues};
    await fs.mkdir(path.dirname(cacheFile), {recursive: true});
    const temp = cacheFile + '.tmp';
    await fs.writeFile(temp, JSON.stringify(result, null, 2) + '\n');
    await fs.rename(temp, cacheFile);
    return result;
  } finally { await fs.unlink(lockFile).catch(() => {}); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await syncListings();
  if (result && Object.values(result.venues).some(venue => venue.error)) process.exitCode = 1;
}
