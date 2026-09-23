import * as cheerio from 'cheerio';

export const sources = [
  {id: 'sheoraphuli', districtId: '1102426', url: 'https://www.district.in/movies/udayan-cinema-sheoraphuli-in-howrah-CD1102426'},
  {id: 'tarakeswar', districtId: '1102427', url: 'https://www.district.in/movies/udayan-cinema-tarakeswar-in-hoogly-CD1102427'},
];
export const indiaDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(value);
export function parseDistrict(html, source) {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').text();
  if (!raw) throw new Error('District page data is missing');
  const page = JSON.parse(raw).props?.pageProps?.data;
  const state = page?.serverState?.[source.districtId];
  if (String(page?.cinemaId) !== source.districtId || String(state?.meta?.cinema?.id) !== source.districtId || !Array.isArray(state?.arrangedSessions) || !Array.isArray(state?.data?.sessionDates)) throw new Error('District listing format or cinema identity changed');
  const movies = [];
  for (const group of state.arrangedSessions) {
    if (!Array.isArray(group.sessions)) throw new Error('District sessions are missing');
    for (const session of group.sessions) {
      if (String(session.cid) !== source.districtId) throw new Error('Unexpected cinema in show data');
      const stamp = String(session.showTime || '');
      // District's unzoned showTime values are UTC; its UI converts them to IST.
      const startsAt = new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(stamp) ? stamp : stamp + 'Z');
      if (!stamp || !Number.isFinite(startsAt.getTime())) throw new Error('Invalid show time');
      const language = String(session.lang || group.data?.lang || '');
      const format = String(session.scrnFmt || '');
      const title = String(group.entityName || group.data?.name || '').trim();
      if (!title || !language || group.entityCode == null || session.sid == null) throw new Error('Incomplete movie or show identity');
      const id = `${group.entityCode}-${language}-${format}`;
      let movie = movies.find(item => item.id === id);
      if (!movie) {
        const poster = String(group.data?.appImgPath || '');
        const allowed = /^https:\/\/(b\.zmtcdn\.com|cdn\.district\.in|assetscdn1\.paytm\.com)\//.test(poster);
        movie = {id, title, language, format, poster: allowed ? poster : '/images/udayancinema-logo.png', sessions: []};
        movies.push(movie);
      }
      const date = indiaDate(startsAt);
      const show = {id: `${source.districtId}-${session.sid}`, startsAt: startsAt.toISOString(), date,
        time: new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true}).format(startsAt),
        screen: String(session.premiumLabel || session.audi || ''), districtUrl: `${source.url}?fromdate=${date}`};
      if (!movie.sessions.some(item => item.id === show.id)) movie.sessions.push(show);
    }
  }
  return {dates: state.data.sessionDates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)), movies};
}
export function mergeMovies(pages) {
  const merged = new Map();
  for (const page of pages) for (const movie of page.movies) {
    if (!merged.has(movie.id)) merged.set(movie.id, {...movie, sessions: []});
    const target = merged.get(movie.id);
    for (const show of movie.sessions) if (!target.sessions.some(item => item.id === show.id)) target.sessions.push(show);
  }
  return [...merged.values()].map(movie => ({...movie, sessions: movie.sessions.sort((a,b) => a.startsAt.localeCompare(b.startsAt))}));
}
