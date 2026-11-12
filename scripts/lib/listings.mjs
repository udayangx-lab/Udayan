import * as cheerio from 'cheerio';

// District (by Zomato) has no public API. Everything here reads the page data District's own Next.js pages ship to
// browsers (`__NEXT_DATA__`), so parsing is defensive, every answer is validated, and a failed fetch never replaces
// good data.
export const sources = [
  {id: 'sheoraphuli', districtId: '1102426', url: 'https://www.district.in/movies/udayan-cinema-sheoraphuli-in-howrah-CD1102426'},
  {id: 'tarakeswar', districtId: '1102427', url: 'https://www.district.in/movies/udayan-cinema-tarakeswar-in-hoogly-CD1102427'},
];
export const upcomingSource = 'https://www.district.in/movies/upcoming-movies';
const userAgent = 'UdayanCinemaListings/1.0';
// District opens a few days at a time; this caps the dated pages fetched per cinema.
const maxDates = 14;
// Dated pages fetched at once per cinema, to stay gentle with District.
const concurrency = 3;
const posterHosts = /^https:\/\/(b\.zmtcdn\.com|cdn\.district\.in|assetscdn1\.paytm\.com)\//;
const fallbackPoster = '/images/udayancinema-logo.png';

export const indiaDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(value);
const indiaTime = value => new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true}).format(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const safe = value => /^[\w~.-]+$/.test(value);

function nextData(html) {
  const raw = cheerio.load(html)('#__NEXT_DATA__').text();
  if (!raw) throw new Error('District page data is missing');
  return JSON.parse(raw);
}

// District's film pages: entityUrl carries an empty city slug ("/ramayana-movie-tickets-in--MV176276"), which 404s.
// The city-free form ("/ramayana-movie-tickets-MV176276") opens the film.
function filmUrl(entityUrl) {
  const path = text(entityUrl).replace(/-in-[\w-]*?-MV(\d+)$/, '-MV$1');
  return /^\/[\w-]+-MV\d+$/.test(path) ? 'https://www.district.in/movies' + path : '';
}

/**
 * One District cinema page (the main page or a `?fromdate=` page). Throws when the page has no show data or belongs
 * to another cinema, so the caller keeps its previous listings instead of storing an empty schedule.
 */
export function parseDistrict(html, source) {
  const page = nextData(html).props?.pageProps?.data;
  // The main page keys its schedule by cinema ID ("1102426"); dated pages by ID and date ("11024262026-11-14").
  const entries = Object.values(page?.serverState || {}).filter(entry => Array.isArray(entry?.arrangedSessions));
  if (!entries.length) throw new Error('District page data is missing');
  const state = entries.find(entry => String(entry.meta?.cinema?.id) === source.districtId);
  if (String(page?.cinemaId) !== source.districtId || !state || !Array.isArray(state.data?.sessionDates)) throw new Error('District listing format or cinema identity changed');
  const posters = new Map((state.meta?.movies || []).map(movie => [String(movie.contentId), movie.appImgPath || movie.imgPath]));
  const movies = [];
  for (const group of state.arrangedSessions) {
    if (!Array.isArray(group.sessions)) throw new Error('District sessions are missing');
    const film = group.data || {};
    for (const session of group.sessions) {
      if (String(session.cid) !== source.districtId) throw new Error('Unexpected cinema in show data');
      const stamp = String(session.showTime || '');
      // District's unzoned showTime values are UTC; its UI converts them to IST.
      const startsAt = new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(stamp) ? stamp : stamp + 'Z');
      if (!stamp || !Number.isFinite(startsAt.getTime())) throw new Error('Invalid show time');
      const language = text(session.lang) || text(session.languageLabel) || text(film.lang);
      const format = text(session.scrnFmt);
      const title = text(group.entityName) || text(film.name) || text(film.label);
      if (!title || !language || group.entityCode == null || session.sid == null) throw new Error('Incomplete movie or show identity');
      const contentId = String(session.contentId ?? film.contentId ?? group.entityCode);
      // One movie per film: District lists a film once with 2D and 3D (or dubbed) shows underneath it.
      const id = String(group.entityCode);
      let movie = movies.find(item => item.id === id);
      if (!movie) {
        const poster = text(film.appImgPath) || text(posters.get(contentId));
        const genres = (Array.isArray(film.genre) ? film.genre : Array.isArray(film.grn) ? film.grn : []).filter(item => typeof item === 'string');
        movie = {id, title, languages: [], formats: [], poster: posterHosts.test(poster) ? poster : fallbackPoster, contentId,
          censor: text(film.censor), duration: Number.isFinite(film.duration) && film.duration > 0 ? film.duration : undefined, genres,
          releaseDate: isDate(film.releaseDate) ? film.releaseDate : undefined, filmUrl: filmUrl(group.entityUrl) || undefined, sessions: []};
        movies.push(movie);
      }
      const date = indiaDate(startsAt);
      // A seat link opens District's seat selection for exactly this show. Its session ID must belong to this cinema;
      // otherwise the show falls back to the cinema's page for that date, so a button never opens another cinema's show.
      const code = String(session.entityDataCode || session.fid || '').toLowerCase();
      const encSession = String(session.encSessionId || '');
      const seat = safe(code) && safe(encSession) && encSession.startsWith(source.districtId + '-') && /^\d+$/.test(contentId);
      const prices = (Array.isArray(session.areas) ? session.areas : []).map(area => area?.price).filter(price => typeof price === 'number' && price > 0);
      if (!movie.languages.includes(language)) movie.languages.push(language);
      if (format && !movie.formats.includes(format)) movie.formats.push(format);
      const show = {id: `${source.districtId}-${session.sid}`, startsAt: startsAt.toISOString(), date, time: indiaTime(startsAt), language, format,
        screen: text(session.audi) || text(session.premiumLabel), label: text(session.premiumLabel) || undefined,
        price: prices.length ? Math.min(...prices) : undefined, seat,
        districtUrl: seat ? `https://www.district.in/movies/seat-layout/${code}?encsessionid=${encSession}&freeseating=false&fromsessions=true&type=CINEMAS&contentid=${contentId}` : `${source.url}?fromdate=${date}`};
      if (!movie.sessions.some(item => item.id === show.id)) movie.sessions.push(show);
    }
  }
  return {dates: state.data.sessionDates.filter(isDate), movies};
}

/** Combines pages into one list per movie variant: shows deduplicated and sorted, missing details filled in. */
export function mergeMovies(pages) {
  const merged = new Map();
  for (const page of pages) for (const movie of page.movies) {
    if (!merged.has(movie.id)) merged.set(movie.id, {...movie, sessions: []});
    const target = merged.get(movie.id);
    for (const [key, value] of Object.entries(movie)) {
      if (key === 'sessions') continue;
      if (Array.isArray(value) && Array.isArray(target[key])) { for (const item of value) if (!target[key].includes(item)) target[key].push(item); }
      else if (target[key] == null || target[key] === '' || (key === 'poster' && target.poster === fallbackPoster)) target[key] = value;
    }
    for (const show of movie.sessions) if (!target.sessions.some(item => item.id === show.id)) target.sessions.push(show);
  }
  return [...merged.values()].map(movie => ({...movie, sessions: movie.sessions.sort((a, b) => a.startsAt.localeCompare(b.startsAt))}));
}

async function fetchPage(url, source, fetchImpl) {
  const response = await fetchImpl(url, {signal: AbortSignal.timeout(8000), headers: {'User-Agent': userAgent, 'Accept': 'text/html'}});
  if (!response.ok) throw new Error(`District returned HTTP ${response.status}`);
  return parseDistrict(await response.text(), source);
}

// District sometimes answers a `?fromdate=` request with another date's page (a stale cache). An answer counts only
// when it holds shows for the requested date; otherwise it is retried with a cache-buster.
async function fetchDate(source, date, {fetchImpl, retryDelayMs, log}) {
  let problem = 'District answered with another date';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const page = await fetchPage(`${source.url}?fromdate=${date}${attempt ? '&_=' + Date.now() : ''}`, source, fetchImpl);
      if (page.movies.some(movie => movie.sessions.some(show => show.date === date))) return page;
      problem = 'District answered with another date';
    } catch (error) { problem = error.message; }
    if (attempt < 2 && retryDelayMs) await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
  }
  log.warn(`[listings] ${source.id} ${date}: ${problem}; keeping the previous shows for this date`);
  return null;
}

/**
 * Fetches every cinema from District: the main page, then each later date District has opened. A cinema that fails
 * keeps its previous listings and records the error; a date that fails keeps that date's previous shows.
 */
export async function collectListings({previous = {venues: {}}, fetchImpl = fetch, log = console, retryDelayMs = 600, now = Date.now()} = {}) {
  const attemptedAt = new Date(now).toISOString();
  const today = indiaDate(new Date(now));
  const venues = {};
  await Promise.all(sources.map(async source => {
    const prior = previous?.venues?.[source.id];
    try {
      const first = await fetchPage(source.url, source, fetchImpl);
      const dates = first.dates.filter(date => date >= today).slice(0, maxDates);
      const covered = new Set(first.movies.flatMap(movie => movie.sessions.map(show => show.date)));
      const later = dates.filter(date => !covered.has(date));
      const answers = new Array(later.length);
      let next = 0;
      await Promise.all(Array.from({length: Math.min(concurrency, later.length)}, async () => {
        while (next < later.length) { const index = next++; answers[index] = await fetchDate(source, later[index], {fetchImpl, retryDelayMs, log}); }
      }));
      const failedDates = later.filter((_, index) => !answers[index]);
      const pages = [first, ...answers.filter(Boolean)];
      // A flaky date keeps the last correct shows for that date instead of disappearing.
      if (failedDates.length && prior?.movies) pages.push({movies: prior.movies.filter(movie => Array.isArray(movie.languages)).map(movie => ({...movie, sessions: movie.sessions.filter(show => failedDates.includes(show.date))}))});
      const movies = mergeMovies(pages).map(movie => ({...movie, sessions: movie.sessions.filter(show => Date.parse(show.startsAt) > now)})).filter(movie => movie.sessions.length);
      venues[source.id] = {source: 'District', sourceUrl: source.url, lastSuccessAt: new Date().toISOString(), lastAttemptAt: attemptedAt, error: null, dates, failedDates, movies};
      log.log(`[listings] ${source.id}: ${movies.length} movie variants, ${movies.reduce((sum, movie) => sum + movie.sessions.length, 0)} shows across ${dates.length} dates${failedDates.length ? ` (failed: ${failedDates.join(', ')})` : ''}`);
    } catch (error) {
      log.error(`[listings] ${source.id}: ${error.message}; keeping last successful data`);
      venues[source.id] = {...prior, source: 'District', sourceUrl: source.url, lastAttemptAt: attemptedAt, error: String(error.message), movies: prior?.movies || []};
    }
  }));
  // Version 2: one movie per film, shows tagged with language and format. Older stored feeds are refetched, not served.
  return {version: 2, refreshIntervalMinutes: 15, lastAttemptAt: attemptedAt, venues};
}

// District picks the upcoming list's city from a `location` cookie and otherwise assumes Delhi NCR, whose list differs.
// Both cinemas are in Hooghly, so the list is always requested for Kolkata (District city id 15). `?city=` and
// `/upcoming-movies-in-<city>` do not work for server requests.
const kolkataCookie = 'location=' + encodeURIComponent(JSON.stringify({fullname: 'Kolkata, West Bengal, India', lat: 22.5726, long: 88.3639, subtitle: 'West Bengal', title: 'Kolkata', id: 15, cityId: 15, cityName: 'Kolkata', pCityKey: 'kolkata', pCityName: 'Kolkata', pStateKey: 'west-bengal', pStateName: 'West Bengal', countryId: '1', countryKey: 'india'}));

/** District's upcoming releases for Kolkata: an all-India list of about 200 films, every language, original language first. */
export function parseUpcoming(html) {
  const rails = nextData(html).props?.pageProps?.data?.serverState?.EDSResponse?.rails;
  if (!Array.isArray(rails)) throw new Error('District upcoming data is missing');
  const rail = rails.find(item => String(item?.snippet_type).includes('upcoming'));
  if (!Array.isArray(rail?.items)) throw new Error('District upcoming list format changed');
  const seen = new Set(), films = [];
  for (const item of rail.items) {
    const movie = item?.ItemDetails?.MovieData;
    const title = text(movie?.name), id = String(movie?.movie_id ?? '');
    if (!title || !/^\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const seconds = Number(movie.release_date);
    const releaseDate = Number.isFinite(seconds) && seconds > 0 ? indiaDate(new Date(seconds * 1000)) : '';
    const poster = text(movie.image), url = text(movie.web_url);
    films.push({id, title, poster: posterHosts.test(poster) ? poster : '', releaseDate: releaseDate && releaseDate < '2080' ? releaseDate : '',
      languages: [...new Set((Array.isArray(movie.movie_variants) ? movie.movie_variants : []).map(variant => text(variant?.language)).filter(Boolean))],
      description: text(movie.description).slice(0, 400), url: url.startsWith('https://www.district.in/') ? url : '',
      censor: text(movie.censor), duration: Number.isFinite(movie.Duration) && movie.Duration > 0 ? movie.Duration : undefined,
      genres: (Array.isArray(movie.genres) ? movie.genres : []).filter(genre => typeof genre === 'string')});
  }
  if (!films.length) throw new Error('District upcoming list is empty');
  return films;
}

/**
 * Fetches District's upcoming list. A failed or unreadable fetch keeps the previous list.
 * @param {{previous?: {lastSuccessAt?: string | null; films?: unknown[]} | null; fetchImpl?: typeof fetch; log?: Pick<Console, 'log' | 'error'>; now?: number}} [options]
 */
export async function collectUpcoming({previous = null, fetchImpl = fetch, log = console, now = Date.now()} = {}) {
  const checkedAt = new Date(now).toISOString();
  try {
    const response = await fetchImpl(upcomingSource, {signal: AbortSignal.timeout(12000), headers: {'User-Agent': userAgent, 'Accept': 'text/html', cookie: kolkataCookie}});
    if (!response.ok) throw new Error(`District returned HTTP ${response.status}`);
    const films = parseUpcoming(await response.text());
    log.log(`[listings] upcoming: ${films.length} films`);
    return {source: upcomingSource, status: 'success', checkedAt, lastSuccessAt: checkedAt, error: null, films};
  } catch (error) {
    log.error(`[listings] upcoming: ${error.message}; keeping the previous list`);
    return {source: upcomingSource, status: 'unavailable', checkedAt, lastSuccessAt: previous?.lastSuccessAt || null, error: String(error.message), films: previous?.films || []};
  }
}
