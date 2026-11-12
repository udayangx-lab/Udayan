import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDistrict, parseUpcoming, collectListings, collectUpcoming, sources} from '../scripts/lib/listings.mjs';
import {buildComingSoon, languageMatch} from '../lib/coming-soon.ts';
import {districtAppLink} from '../lib/district-link.ts';
import {dayLabel, titleKey} from '../lib/listings.ts';

const quiet = {log() {}, warn() {}, error() {}};
const source = sources[0];
const cid = Number(source.districtId);
// Shaped like District's real page data (checked against the live pages on 12 November 2026).
function session(sid, showTime, extra = {}) {
  return {sid: String(sid), cid, showTime, lang: 'Hindi', scrnFmt: '3D', audi: 'SCREEN 1', premiumLabel: 'S1 : 2K 3D LASER DOLBY 5.1',
    entityDataCode: 'rtb7dmwvuo', fid: 'rTb7Dmwvuo', contentId: 176276, encSessionId: `${cid}-${sid}-obe015-rtb7dmwvuo`,
    areas: [{label: 'SILVER', price: 230}, {label: 'GOLD', price: 250}, {label: 'BLOCKED', price: 0}], ...extra};
}
function districtPage({date, sessions, key = date ? source.districtId + date : source.districtId, dates = ['2026-11-12', '2026-11-13', '2026-11-14']}) {
  const state = {serverTime: 0, pageData: {}, data: {sessionDates: dates},
    meta: {cinema: {id: cid, name: 'Udayan Cinema, Sheoraphuli'}, movies: [{contentId: 176276, appImgPath: 'https://b.zmtcdn.com/data/edition_assets/ramayana.jpg'}]},
    arrangedSessions: [{entityCode: 176276, entityName: 'Ramayana', entityUrl: '/ramayana-movie-tickets-in--MV176276', cinemaId: cid,
      data: {label: 'Ramayana', contentId: 176276, censor: 'U', duration: 195, grn: ['Action', 'Drama'], releaseDate: '2026-11-05', lang: 'Hindi', appImgPath: ''}, sessions}]};
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props: {pageProps: {type: 'cinema', data: {cinemaId: cid, serverState: {[key]: state}}}}})}</script>`;
}

test('reads dated pages, whose schedule District keys by cinema ID plus date', () => {
  const result = parseDistrict(districtPage({date: '2026-11-14', sessions: [session(25877, '2026-11-14T04:30')]}), source);
  assert.equal(result.movies.length, 1);
  assert.equal(result.movies[0].sessions[0].date, '2026-11-14');
  assert.match(result.movies[0].sessions[0].time, /10:00/);
});

test('captures film details, the lowest price, the screen, and the District film page', () => {
  const movie = parseDistrict(districtPage({sessions: [session(1, '2026-11-12T13:00')]}), source).movies[0];
  assert.equal(movie.id, '176276');
  assert.deepEqual([movie.languages, movie.formats], [['Hindi'], ['3D']]);
  assert.equal(movie.poster, 'https://b.zmtcdn.com/data/edition_assets/ramayana.jpg');
  assert.deepEqual([movie.contentId, movie.censor, movie.duration, movie.releaseDate], ['176276', 'U', 195, '2026-11-05']);
  assert.deepEqual(movie.genres, ['Action', 'Drama']);
  assert.equal(movie.filmUrl, 'https://www.district.in/movies/ramayana-movie-tickets-MV176276');
  const show = movie.sessions[0];
  assert.equal(show.price, 230);
  assert.equal(show.screen, 'SCREEN 1');
  assert.equal(show.label, 'S1 : 2K 3D LASER DOLBY 5.1');
});

test('each show links to District seat selection for that show, and never to another cinema’s session', () => {
  const [ok, foreign, unsafe] = parseDistrict(districtPage({sessions: [
    session(1, '2026-11-12T13:00'),
    session(2, '2026-11-12T14:00', {encSessionId: '1102427-2-obe015-rtb7dmwvuo'}),
    session(3, '2026-11-12T15:00', {entityDataCode: 'bad/code'}),
  ]}), source).movies[0].sessions;
  assert.equal(ok.seat, true);
  assert.equal(ok.districtUrl, 'https://www.district.in/movies/seat-layout/rtb7dmwvuo?encsessionid=1102426-1-obe015-rtb7dmwvuo&freeseating=false&fromsessions=true&type=CINEMAS&contentid=176276');
  for (const show of [foreign, unsafe]) {
    assert.equal(show.seat, false);
    assert.equal(show.districtUrl, source.url + '?fromdate=2026-11-12');
  }
});

test('fetches every date District has opened, and keeps the last good shows for a date District answers wrongly', async () => {
  const now = Date.parse('2026-11-12T06:00:00Z');
  const pages = {
    main: districtPage({sessions: [session(1, '2026-11-12T13:00')]}),
    '2026-11-13': districtPage({date: '2026-11-13', sessions: [session(2, '2026-11-13T13:00')]}),
    // A stale answer: the 12th's page for the 14th.
    '2026-11-14': districtPage({date: '2026-11-12', sessions: [session(1, '2026-11-12T13:00')]}),
  };
  const previous = {venues: {[source.id]: {movies: [{id: '176276', title: 'Ramayana', languages: ['Hindi'], formats: ['3D'], poster: '', sessions: [
    {id: 'old-14', startsAt: '2026-11-14T13:00:00.000Z', date: '2026-11-14', time: '6:30 pm', screen: 'SCREEN 1', districtUrl: source.url},
    {id: 'old-13', startsAt: '2026-11-13T09:00:00.000Z', date: '2026-11-13', time: '2:30 pm', screen: 'SCREEN 1', districtUrl: source.url},
  ]}]}}};
  const requests = [];
  const result = await collectListings({previous, now, log: quiet, retryDelayMs: 0, fetchImpl: async url => {
    requests.push(url);
    if (!url.includes(source.districtId)) return {ok: false, status: 503};
    const date = new URL(url).searchParams.get('fromdate');
    return {ok: true, text: async () => pages[date || 'main']};
  }});
  const venue = result.venues[source.id];
  assert.deepEqual(venue.dates, ['2026-11-12', '2026-11-13', '2026-11-14']);
  assert.deepEqual(venue.failedDates, ['2026-11-14']);
  const shows = venue.movies[0].sessions.map(show => show.id);
  // The 13th comes from District; the 14th keeps the previous show; the 13th's old show is replaced, not kept.
  assert.deepEqual(shows, ['1102426-1', '1102426-2', 'old-14']);
  assert.equal(requests.filter(url => url.includes('fromdate=2026-11-14')).length, 3);
  assert.ok(requests.some(url => url.includes('fromdate=2026-11-14&_=')), 'retries bypass caches');
});

const upcomingHtml = items => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props: {pageProps: {data: {serverState: {EDSResponse: {rails: [
  {snippet_type: 'rail_type_movies_poster_grid_v1', items: []},
  {snippet_type: 'rail_type_upcoming_movies_grid_v1', items: items.map(MovieData => ({ItemDetails: {MovieData}}))},
]}}}}}})}</script>`;
// 1 December 2026 00:00 IST = 30 November 18:30 UTC.
const releasing = date => String(Date.parse(date + 'T00:00:00+05:30') / 1000);

test('reads District’s upcoming list with release dates in India and the Kolkata city cookie', async () => {
  const html = upcomingHtml([
    {movie_id: '237820', name: 'Nazarbandi', image: 'https://cdn.district.in/movies-assets/images/cinema/n.jpg', release_date: releasing('2026-11-19'), movie_variants: [{language: 'Bengali'}], description: 'A thriller.', web_url: 'https://www.district.in/movies/nazarbandi-movie-tickets-MV237820', censor: 'UA13+', Duration: 130, genres: ['Thriller']},
    {movie_id: '237820', name: 'Nazarbandi (duplicate)', release_date: releasing('2026-11-19'), movie_variants: []},
    {movie_id: 'x', name: 'Broken id'},
  ]);
  const films = parseUpcoming(html);
  assert.equal(films.length, 1);
  assert.deepEqual(films[0], {id: '237820', title: 'Nazarbandi', poster: 'https://cdn.district.in/movies-assets/images/cinema/n.jpg', releaseDate: '2026-11-19', languages: ['Bengali'],
    description: 'A thriller.', url: 'https://www.district.in/movies/nazarbandi-movie-tickets-MV237820', censor: 'UA13+', duration: 130, genres: ['Thriller']});
  let cookie = '';
  const result = await collectUpcoming({log: quiet, fetchImpl: async (url, options) => { cookie = options.headers.cookie; return {ok: true, text: async () => html}; }});
  assert.equal(result.status, 'success');
  assert.match(decodeURIComponent(cookie), /"cityId":15/);
  const failed = await collectUpcoming({previous: result, log: quiet, fetchImpl: async () => ({ok: false, status: 500})});
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.films.length, 1, 'a failed fetch keeps the previous list');
  assert.equal(failed.lastSuccessAt, result.lastSuccessAt);
});

const film = (id, title, releaseDate, languages) => ({id, title, poster: '', releaseDate, languages, description: '', url: ''});
test('Coming soon keeps original-language and English or Bengali releases inside the window', () => {
  const settings = {languages: ['Bengali', 'Hindi', 'English'], hidden: ['5'], windowDays: 56};
  const district = [
    film('1', 'Bengali film', '2026-11-20', ['Bengali']),
    film('2', 'Telugu film with a Hindi dub', '2026-11-20', ['Telugu', 'Hindi']),
    film('3', 'Japanese film in English', '2026-11-21', ['Japanese', 'English']),
    film('4', 'Far-off film', '2027-06-01', ['Hindi']),
    film('5', 'Hidden film', '2026-11-22', ['Hindi']),
    film('6', 'Undated film', '', ['Hindi']),
    film('7', 'Released film', '2026-11-01', ['Hindi']),
    film('8', 'Avengers: Doomsday', '2026-12-17', ['English', 'Hindi', 'Tamil']),
  ];
  const curated = [{id: 'c1', title: 'Avengers Doomsday', poster: '/media/a.jpg'}, {id: 'c2', title: 'Old curated', poster: '', releaseDate: '2026-10-01'}];
  const list = buildComingSoon({curated, district, settings, today: '2026-11-12'});
  assert.deepEqual(list.map(item => item.title), ['Bengali film', 'Japanese film in English', 'Avengers Doomsday']);
  const avengers = list.at(-1);
  assert.equal(avengers.source, 'curated');
  assert.equal(avengers.poster, '/media/a.jpg');
  assert.equal(avengers.releaseDate, '2026-12-17', 'a curated title borrows District’s release date');
  assert.equal(list[1].language, 'English');
  assert.deepEqual(languageMatch({languages: ['Hindi', 'Kannada']}, ['Bengali']), []);
});

test('District app link opens the same show and falls back to the seat page', () => {
  const seat = 'https://www.district.in/movies/seat-layout/rtb7dmwvuo?encsessionid=1102426-25877-obe015-rtb7dmwvuo&freeseating=false&fromsessions=true&type=CINEMAS&contentid=176276';
  const link = new URL(districtAppLink(seat, '2026-11-14T19:00:00.000Z'));
  assert.equal(link.origin + link.pathname, 'https://link.district.in/DSTRKT');
  const params = JSON.parse(link.searchParams.get('link_params'));
  assert.deepEqual(params, {movie_id: '176276', cinema_id: '1102426', session_id: '25877', show_date: '2026-11-15', format_id: 'rtb7dmwvuo', movie_variant: 'OBE015', is_free_seating: 'false', parent_caller_type: 'CINEMAS', is_tuesday99: 'false'});
  assert.equal(link.searchParams.get('af_web_dp'), seat);
  assert.equal(districtAppLink(source.url, '2026-11-14T19:00:00.000Z'), null);
});

test('labels days in India and matches titles across punctuation', () => {
  const now = Date.parse('2026-11-12T20:00:00Z'); // 13 November, 1:30 am in India
  assert.equal(dayLabel('2026-11-13', now), 'Today');
  assert.equal(dayLabel('2026-11-14', now), 'Tomorrow');
  assert.match(dayLabel('2026-11-15', now), /Sun, 15 Nov/);
  assert.equal(titleKey('Avengers: Doomsday'), titleKey('avengers doomsday'));
});
