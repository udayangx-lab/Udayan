export type Show = {id: string; startsAt: string; date: string; time: string; screen: string; districtUrl: string};
export type LiveMovie = {id: string; title: string; language: string; format: string; poster: string; sessions: Show[]};
export type VenueListings = {source: string; sourceUrl: string; lastSuccessAt?: string; lastAttemptAt: string; error: string | null; movies: LiveMovie[]};
export type LiveListings = {version: number; refreshIntervalMinutes: number; lastAttemptAt: string; venues: Record<string, VenueListings>};
export function indiaDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(value);
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short'}).format(new Date(date + 'T12:00:00+05:30'));
}
