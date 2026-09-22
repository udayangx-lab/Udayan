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

The `out/` directory is a portable static export. `npm start` serves it locally through Python 3. Static hosting should resolve extensionless paths to the matching `.html` file and use `404.html` for missing pages. No application server, secrets, or database is required.

## Pages

Home, movies, experience, story, gallery, DPD Café, contact/directions, Hooghly River, advertising, careers, and patron feedback. The homepage movie section is a swipeable carousel with previous/next buttons, keyboard navigation, and all current/upcoming cards. Movie language filters and upcoming tabs work; the cinema selector changes booking destinations. Photo galleries support a native modal, arrow-key navigation, Escape, and touch controls. Mobile navigation, keyboard focus, reduced-motion preferences, and per-page metadata are included.

## Content and source accuracy

- Source: https://udayancinema.com/, collected 22 September 2026.
- `research/scraped-content.json` contains page text, links, image origins, and extracted CSS colors. Raw HTML and site styles are retained in `research/`.
- `lib/data.ts` contains editable movie and cinema records. Movie listings are a curated snapshot, not a live BookMyShow feed.
- The source lists conflicting movie categories and some old date-specific booking URLs. The redesign preserves the principal Now Showing and Coming Soon categories and uses permanent venue booking URLs. Movie availability must be verified on BookMyShow.
- Showtimes, ticket prices, ratings, runtimes, and upcoming release dates were not supplied reliably by the source and have not been invented.
- Careers and feedback use the original working forms on udayancinema.com; email links open the visitor’s mail application. No fake submission handler is present. If replacing the original domain, migrate those form backends before switching DNS.
- Photos and posters are local copies of the original site’s assets. Ownership remains with their respective owners.
- Fonts: DM Sans and Barlow Condensed, loaded from Google Fonts, with local system fallbacks.

## Branding

Exact source values retained in CSS: main red `#BB0504`, accent `#E7000B`, burgundy `#68062c`, text `#2C2C2C`, and white. The original multicolor cinema logo is preserved. Additional neutral surfaces support the new layout.

## Refreshing research

`npm run scrape` fetches the source pages and assets into `research/` and `public/images/`. Review the results and update `lib/data.ts`; scraping deliberately does not silently overwrite curated application content.

## Motion

`components/cinema-preloader.tsx` provides a cinema countdown and opening curtains on initial visits and internal page changes. The initial intro can be skipped; subsequent transitions are shorter. It waits briefly for visible images and fonts, with a maximum timeout, and disables background interaction while loading. `components/site-motion.tsx` provides page entry transitions and staggered IntersectionObserver reveals across all pages, prepared before paint and starting as the curtains open. `components/year-counter.tsx` counts to the original historical year when it enters view, while preserving the accessible final value. Each visual group reveals once; nested opacity animations are avoided, and scrollbar space stays stable during loading. Mobile navigation and gallery dialogs animate open and closed. Motion respects `prefers-reduced-motion`; content stays visible without JavaScript, and a navigation timeout prevents a failed transition from hiding the page.
