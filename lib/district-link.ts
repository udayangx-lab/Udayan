// District's own app link (AppsFlyer OneLink, the format District uses when someone shares a show) for one showtime.
//
// A seat link such as
//   https://www.district.in/movies/seat-layout/rtb7dmwvuo?encsessionid=1102426-25877-obe015-rtb7dmwvuo&contentid=176276
// carries everything the District app needs to open that show's seat page:
//   cinema 1102426 · session 25877 · variant OBE015 · format rtb7dmwvuo · film 176276 (+ the show's date in India).
// On phones the District app claims www.district.in links but cannot open seat-layout pages (it lands on its home
// screen). With the app installed this link opens the seat page in the app; without it, District's link server opens
// the same seat page on the website, never an app store.
const oneLink = 'https://link.district.in/DSTRKT';

export function districtAppLink(seatUrl: string, startsAt: string): string | null {
  let url: URL;
  try { url = new URL(seatUrl); } catch { return null; }
  if (url.hostname !== 'www.district.in' || !url.pathname.startsWith('/movies/seat-layout/')) return null;
  const format = url.pathname.split('/').filter(Boolean)[2];
  const parts = (url.searchParams.get('encsessionid') || '').split('-');
  const movie = url.searchParams.get('contentid');
  if (parts.length < 4 || !format || !movie || !/^\d+$/.test(parts[0]) || !parts[1] || !parts[2]) return null;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  const params = JSON.stringify({
    movie_id: movie, cinema_id: parts[0], session_id: parts[1], show_date: date.toLocaleDateString('en-CA', {timeZone: 'Asia/Kolkata'}),
    format_id: format, movie_variant: parts[2].toUpperCase(), is_free_seating: url.searchParams.get('freeseating') === 'true' ? 'true' : 'false',
    // CINEMAS makes the app load the show from this cinema's sessions, whatever city the app is set to.
    parent_caller_type: 'CINEMAS', is_tuesday99: 'false',
  });
  const query = new URLSearchParams({
    pid: 'udayancinema', c: 'showtimes', link_type: 'open_movie_seat_page', link_params: params,
    deep_link_value: 'edition://resolve-onelink?link_type=open_movie_seat_page&link_params=' + encodeURIComponent(params),
    af_dp: 'edition://resolve-onelink', af_force_deeplink: 'true',
    // No app, or a desktop: the same seat page on District's website.
    af_web_dp: seatUrl, af_android_url: seatUrl, af_ios_url: seatUrl,
  });
  return `${oneLink}?${query}`;
}

/** Phones and tablets, where the District app may be installed. */
export const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
