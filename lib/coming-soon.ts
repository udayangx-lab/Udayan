// Assembles the Coming soon list from the admin's own titles and District's upcoming releases. Kept free of runtime
// imports so the rules can be tested directly.
import type {ComingSoon, DistrictFilm} from './listings';
import type {UpcomingMovie} from './data';

export type UpcomingSettings = {languages: string[]; hidden: string[]; windowDays: number};
export const defaultUpcomingSettings: UpcomingSettings = {languages: ['Bengali', 'Hindi', 'English'], hidden: [], windowDays: 56};

const key = (title: string) => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const addDays = (date: string, days: number) => new Date(Date.parse(date + 'T00:00:00Z') + days * 864e5).toISOString().slice(0, 10);

/**
 * Whether a District title belongs in Coming soon, ignoring the release window. District lists a film's original
 * language first and dubs after it. A film qualifies when its original language is a chosen one (so Hindi dubs of
 * Telugu or Kannada films stay out), or when it has a Bengali or English version and that language is chosen.
 */
export function languageMatch(film: Pick<DistrictFilm, 'languages'>, languages: string[]) {
  const wanted = new Set(languages.map(language => language.toLowerCase()));
  const lower = film.languages.map(language => language.toLowerCase());
  const original = Boolean(lower[0] && wanted.has(lower[0]));
  const always = ['bengali', 'english'].some(language => wanted.has(language) && lower.includes(language));
  return original || always ? film.languages.filter(language => wanted.has(language.toLowerCase())) : [];
}

/**
 * Admin titles are always shown until their release date passes; they replace a District entry with the same title.
 * District titles need a matching language, a release date from today to `windowDays` ahead, and must not be hidden.
 * Sorted by release date, undated titles last. Titles already bookable at a cinema are removed per cinema by the page.
 */
export function buildComingSoon({curated = [], district = [], settings = defaultUpcomingSettings, today}: {curated?: UpcomingMovie[]; district?: DistrictFilm[]; settings?: UpcomingSettings; today: string}): ComingSoon[] {
  const list: ComingSoon[] = [];
  const seen = new Set<string>();
  const districtByTitle = new Map(district.map(film => [key(film.title), film]));
  for (const item of curated) {
    if (item.releaseDate && item.releaseDate < today) continue;
    const match = districtByTitle.get(key(item.title));
    seen.add(key(item.title));
    list.push({id: item.id, title: item.title, poster: item.poster || match?.poster || '', releaseDate: item.releaseDate || match?.releaseDate || undefined,
      language: item.language || match?.languages.join(', ') || undefined, description: match?.description || undefined, url: match?.url || undefined,
      censor: match?.censor || undefined, duration: match?.duration, genres: match?.genres, source: 'curated'});
  }
  const hidden = new Set(settings.hidden), horizon = addDays(today, settings.windowDays);
  for (const film of district) {
    const languages = languageMatch(film, settings.languages);
    if (!languages.length || hidden.has(film.id) || seen.has(key(film.title))) continue;
    // Dated releases within the window only: undated and far-off announcements appear automatically later.
    if (!film.releaseDate || film.releaseDate < today || film.releaseDate > horizon) continue;
    seen.add(key(film.title));
    list.push({id: film.id, title: film.title, poster: film.poster, releaseDate: film.releaseDate, language: languages.join(', '),
      description: film.description || undefined, url: film.url || undefined, censor: film.censor || undefined, duration: film.duration, genres: film.genres, source: 'district'});
  }
  return list.sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'));
}
