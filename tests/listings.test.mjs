import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDistrict, sources, mergeMovies, collectListings} from '../scripts/lib/listings.mjs';
const quiet = {log() {}, warn() {}, error() {}};
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
  const old = {source: 'District', lastSuccessAt: '2026-09-24T00:00:00Z', movies: [{id: 'cached', title: 'Preserved film', sessions: []}]};
  const result = await collectListings({previous: {venues: {sheoraphuli: old}}, log: quiet, fetchImpl: async url => {
    if (url.includes('1102426')) return {ok: false, status: 503};
    return {ok: true, text: async () => page(sources[1], [])};
  }});
  assert.equal(result.venues.sheoraphuli.lastSuccessAt, old.lastSuccessAt);
  assert.deepEqual(result.venues.sheoraphuli.movies, old.movies);
  assert.match(result.venues.sheoraphuli.error, /503/);
  assert.equal(result.venues.tarakeswar.error, null);
  assert.deepEqual(result.venues.tarakeswar.movies, []);
  assert.equal(result.version, 1);
});
test('a dated page without show data is retried, then reported without failing the venue', async () => {
  const {indiaDate} = await import('../scripts/lib/listings.mjs');
  const today = indiaDate(), tomorrow = indiaDate(new Date(Date.now() + 864e5));
  const source = sources[0];
  const later = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16);
  const state = {meta: {cinema: {id: Number(source.districtId)}}, data: {sessionDates: [today, tomorrow]}, arrangedSessions: [{entityCode: 7, entityName: 'Today film', data: {}, sessions: [{cid: Number(source.districtId), sid: '9', showTime: later, lang: 'Bengali', scrnFmt: '2D'}]}]};
  const main = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props: {pageProps: {data: {cinemaId: source.districtId, serverState: {[source.districtId]: state}}}}})}</script>`;
  const clientOnly = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props: {pageProps: {data: {cinemaId: source.districtId, isCSR: true, serverState: {}}}}})}</script>`;
  const requested = [];
  const result = await collectListings({log: quiet, retryDelayMs: 0, fetchImpl: async url => { requested.push(url); return {ok: true, text: async () => url.includes('fromdate') ? clientOnly : url.includes(source.districtId) ? main : page(sources[1], [])}; }});
  const venue = result.venues[source.id];
  assert.equal(venue.error, null);
  assert.equal(venue.movies[0].title, 'Today film');
  assert.deepEqual(venue.failedDates, [tomorrow]);
  assert.equal(requested.filter(url => url.includes(`fromdate=${tomorrow}`)).length, 3);
});
