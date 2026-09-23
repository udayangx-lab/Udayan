import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseDistrict, sources, mergeMovies} from '../scripts/lib/listings.mjs';
import {syncListings} from '../scripts/sync-listings.mjs';
function page(source = sources[0], sessions = [{cid: Number(source.districtId), sid: '1', showTime: '2026-09-24T06:15', lang: 'Hindi', scrnFmt: '2D'}]) {
  const state = {meta: {cinema: {id: Number(source.districtId)}}, data: {sessionDates: ['2026-09-24']}, arrangedSessions: sessions.length ? [{entityCode: 42, entityName: 'Test film', data: {appImgPath: 'https://b.zmtcdn.com/poster.jpg'}, sessions}] : []};
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props: {pageProps: {data: {cinemaId: source.districtId, serverState: {[source.districtId]: state}}}}})}</script>`;
}
test('converts actual District UTC-shaped times to IST without local-machine timezone dependence', () => {
  const movie = parseDistrict(page(), sources[0]).movies[0];
  assert.equal(movie.sessions[0].date, '2026-09-24');
  assert.match(movie.sessions[0].time, /11:45/);
  assert.equal(movie.sessions[0].startsAt, '2026-09-24T06:15:00.000Z');
  assert.equal(movie.sessions[0].districtUrl, sources[0].url + '?fromdate=2026-09-24');
});
test('IST midnight rollover and language/format variants stay distinct', () => {
  const sessions = ['Hindi', 'Bengali'].map((lang,i) => ({cid: 1102426, sid: String(i), showTime: '2026-09-24T20:15', lang, scrnFmt: i ? '3D' : '2D'}));
  const result = parseDistrict(page(sources[0], sessions), sources[0]);
  assert.equal(result.movies.length, 2);
  assert.equal(result.movies[1].format, '3D');
  assert.equal(result.movies[0].sessions[0].date, '2026-09-25');
  assert.match(result.movies[0].sessions[0].time, /1:45/);
});
test('rejects the wrong cinema and changed payload instead of replacing the cache with an empty list', () => {
  assert.throws(() => parseDistrict(page(sources[1]), sources[0]), /cinema identity/);
  assert.throws(() => parseDistrict('<h1>Temporarily unavailable</h1>', sources[0]), /missing/);
});
test('deduplicates overlapping dates but accepts a verified empty schedule', () => {
  const data = parseDistrict(page(), sources[0]);
  assert.equal(mergeMovies([data, data])[0].sessions.length, 1);
  assert.deepEqual(parseDistrict(page(sources[0], []), sources[0]).movies, []);
});
test('a failed refresh preserves prior successful listings and records failure independently for each venue', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'udayan-sync-test-'));
  const cacheFile = path.join(dir, 'feed.json');
  const lockFile = path.join(dir, 'lock');
  const old = {source: 'District', lastSuccessAt: '2026-09-24T00:00:00Z', movies: [{id: 'cached', title: 'Preserved film', sessions: []}]};
  await fs.writeFile(cacheFile, JSON.stringify({venues: {sheoraphuli: old}}));
  try {
    const result = await syncListings({cacheFile, lockFile, fetchImpl: async url => {
      if (url.includes('1102426')) return {ok: false, status: 503};
      return {ok: true, text: async () => page(sources[1], [])};
    }});
    assert.equal(result.venues.sheoraphuli.lastSuccessAt, old.lastSuccessAt);
    assert.deepEqual(result.venues.sheoraphuli.movies, old.movies);
    assert.match(result.venues.sheoraphuli.error, /503/);
    assert.equal(result.venues.tarakeswar.error, null);
    assert.deepEqual(result.venues.tarakeswar.movies, []);
    assert.equal(JSON.parse(await fs.readFile(cacheFile, 'utf8')).version, 1);
    await assert.rejects(fs.stat(lockFile), /ENOENT/);
  } finally { await fs.rm(dir, {recursive: true, force: true}); }
});
