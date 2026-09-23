# Udayan Cinema

A complete responsive Next.js App Router redesign using the original cinema’s logo, brand colors, posters, and venue photography.

## Run

Node.js 20.9+ is required. Dependencies are installed and locked in `package-lock.json`.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Stop any existing preview on port 3000 before starting development.

## Production

```sh
npm run typecheck
npm run build
node scripts/check-export.mjs
npm start
```

The pages in `out/` are a static export. `npm start` runs the Python 3 preview server and a Node.js listings worker together. Keep that process running for automatic updates. A deployed site needs the same worker/server arrangement, or an external scheduler publishing the generated JSON to `/data/live-listings.json`; uploading `out/` alone does not keep listings live. No API keys or database are needed.

## Pages

Home, movies, experience, story, gallery, DPD Café, contact/directions, Hooghly River, advertising, careers, and patron feedback. The homepage movie section is a swipeable carousel with previous/next buttons, keyboard navigation, and all current/upcoming cards. Movie language filters and upcoming tabs work; the cinema selector changes live listings and booking destinations. Every booking button, movie card, and showtime opens a District/BookMyShow platform chooser. Photo galleries support a native modal, arrow-key navigation, Escape, and touch controls. Mobile navigation, keyboard focus, reduced-motion preferences, and per-page metadata are included.

## Content and source accuracy

- Source: https://udayancinema.com/, collected 22 September 2026.
- `research/scraped-content.json` contains page text, links, image origins, and extracted CSS colors. Raw HTML and site styles are retained in `research/`.
- Now Showing and showtimes refresh from the two public District cinema pages. This is public page extraction, not an official API or a live BookMyShow feed.
- `lib/data.ts` contains cinema records and the curated Coming Soon snapshot from the original website; upcoming titles are labelled separately from live show listings.
- The chooser links to the selected venue/date on District and BookMyShow. Movie/time selections are shown for reference; visitors select the matching show and seats on the provider. No invented movie IDs or seat-booking links are used.
- Ticket prices, available seats, ratings, runtimes, and upcoming release dates are not invented or represented as live on this site.
- Careers and feedback use the original working forms on udayancinema.com; email links open the visitor’s mail application. No fake submission handler is present. If replacing the original domain, migrate those form backends before switching DNS.
- Venue photos and upcoming posters are local copies of the original site’s assets; current posters come from District’s public CDN. Platform logos retain their original artwork: BookMyShow from the original cinema site, and District from its public Organization metadata (`https://b.zmtcdn.com/data/edition_assets/1731516000703.png`). Ownership remains with their respective owners.
- Fonts: DM Sans and Barlow Condensed, loaded from Google Fonts, with local system fallbacks.

## Branding

Exact source values retained in CSS: main red `#BB0504`, accent `#E7000B`, burgundy `#68062c`, text `#2C2C2C`, and white. The original multicolor cinema logo is preserved. Additional neutral surfaces support the new layout.

## Refreshing research

`npm run scrape` fetches the source pages and assets into `research/` and `public/images/`. Review the results and update `lib/data.ts`; scraping deliberately does not silently overwrite curated application content.

## Motion

`components/cinema-preloader.tsx` provides a cinema countdown and opening curtains on initial visits and internal page changes. The initial intro can be skipped; subsequent transitions are shorter. It waits briefly for visible images and fonts, with a maximum timeout, and disables background interaction while loading. `components/site-motion.tsx` provides page entry transitions and staggered IntersectionObserver reveals across all pages, prepared before paint and starting as the curtains open. `components/year-counter.tsx` counts to the original historical year when it enters view, while preserving the accessible final value. Each visual group reveals once; nested opacity animations are avoided, and scrollbar space stays stable during loading. Mobile navigation and gallery dialogs animate open and closed. Motion respects `prefers-reduced-motion`; content stays visible without JavaScript, and a navigation timeout prevents a failed transition from hiding the page.

## Automatic listings updates

Both `npm start` and `npm run dev` refresh District at startup and every 30 minutes. The browser rechecks the local JSON once a minute and when the tab becomes visible. Run `npm run sync:listings` for a manual refresh and `npm run test:listings` for parser/cache regression checks.

- Sources: Sheoraphuli `CD1102426`; Tarakeswar `CD1102427`. Configuration lives in `scripts/lib/listings.mjs`.
- The worker reads `__NEXT_DATA__` from public HTML without credentials, validates the cinema identity, and gathers up to seven available dates. Unzoned District timestamps are interpreted as UTC and displayed in Asia/Kolkata.
- The generated cache is `public/data/live-listings.json` (ignored by Git). Writes are atomic and overlapping runs are locked. The preview serves this file directly with `Cache-Control: no-store` so rebuilds are unnecessary.
- Each cinema records its own successful-update time. Failed refreshes preserve its last good data and expose an update warning. Expired shows are hidden; caches older than 24 hours are not displayed as bookable shows. Missing listings offer the platform chooser rather than silently falling back to the old movie snapshot.
- District’s page structure can change. Parser failures are logged by the worker and covered by the stale-data UI; maintain the extractor if the source changes.
- This work remains local; no website has been deployed.

## Nearby cinema selection

On a first visit without a saved manual preference, the site requests browser location permission and chooses the nearest cinema using the venue coordinates published by District (Sheoraphuli: 22.774846, 88.326738; Tarakeswar: 22.874893, 88.012038). Coordinates are used only in browser memory and are not sent to our server or stored. This uses browser geolocation, not IP geolocation, and requires HTTPS in production (localhost works for development).

A manual cinema choice is remembered on that browser. It takes priority over automatic detection, including a pending location request. “Use my location” in the header picker allows visitors to opt back into automatic selection. Denied permission, timeouts, and unavailable location services leave manual selection usable; the initial fallback is Sheoraphuli. Listings and booking destinations share the selected cinema. The browser tab and Apple touch icon use the original Udayan logo.

Run `node --experimental-strip-types --test tests/cinema-location.test.mjs` with Node.js 22.6+ to verify nearest-venue calculations, saved preferences, permission failures, and in-flight request handling.
