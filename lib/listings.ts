// `seat`: districtUrl opens District's seat selection for this exact show (otherwise the cinema's page for that date).
export type Show = {id: string; startsAt: string; date: string; time: string; language: string; format: string; screen: string; label?: string; price?: number; seat?: boolean; districtUrl: string};
/** One film at one cinema. Its shows may be in several formats (2D, 3D) and languages. */
export type LiveMovie = {
  id: string; title: string; languages: string[]; formats: string[]; poster: string; sessions: Show[];
  contentId?: string; censor?: string; duration?: number; genres?: string[]; releaseDate?: string; filmUrl?: string;
};
export type VenueListings = {
  source: string; sourceUrl: string; lastSuccessAt?: string; lastAttemptAt: string; error: string | null;
  dates?: string[]; failedDates?: string[]; movies: LiveMovie[];
};
export type LiveListings = {version: number; refreshIntervalMinutes: number; lastAttemptAt: string; venues: Record<string, VenueListings>};

export type DistrictFilm = {id: string; title: string; poster: string; releaseDate: string; languages: string[]; description: string; url: string; censor?: string; duration?: number; genres?: string[]};
export type DistrictUpcoming = {source: string; status: 'success' | 'unavailable'; checkedAt: string; lastSuccessAt: string | null; error: string | null; films: DistrictFilm[]};
export type ComingSoon = {id: string; title: string; poster: string; releaseDate?: string; language?: string; description?: string; url?: string; censor?: string; duration?: number; genres?: string[]; source: 'district' | 'curated'};
/** What /data/live-listings.json serves: showtimes per cinema plus the assembled Coming soon list. */
export type ListingsFeed = LiveListings & {upcoming?: ComingSoon[]};

export function indiaDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(value);
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short'}).format(new Date(date + 'T12:00:00+05:30'));
}
/** "Today", "Tomorrow", or "Sat, 14 Nov" in India. */
export function dayLabel(date: string, now = Date.now()) {
  const today = indiaDate(new Date(now));
  if (date === today) return 'Today';
  if (date === indiaDate(new Date(Date.parse(today + 'T12:00:00+05:30') + 864e5))) return 'Tomorrow';
  return dateLabel(date);
}
export const runtime = (minutes?: number) => minutes ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : '';
/** Matches the same film across District's showtimes, its upcoming list, and admin-entered titles. */
export const titleKey = (title: string) => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
