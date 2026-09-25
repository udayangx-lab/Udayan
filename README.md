# Udayan Cinema

A complete responsive Next.js App Router redesign using the original cinema’s logo, brand colors, posters, and venue photography.

## Run

Node.js 22.13+ is required (the site uses Node's built-in SQLite). Dependencies are installed and locked in `package-lock.json`.

```sh
npm install
cp .env.example .env.local   # then set ADMIN_PASSWORD and the Resend values
npm run dev
```

Open http://localhost:3000. Stop any existing preview on port 3000 before starting development.

## Production

```sh
npm run typecheck
npm test
npm run build
npm start
```

The site is a Node.js server (`next start`), not a static export: forms, the admin panel, and editable content all need it. `npm start` runs the server and the listings worker together. Host it anywhere that runs a long-lived Node.js process with a persistent disk (a VPS, Railway, Render, Fly.io, or similar). Serverless hosts without a persistent filesystem are not suitable unless `lib/server/db.ts` and `lib/server/uploads.ts` are moved to hosted storage.

Everything the site writes lives in `DATA_DIR` (default `storage/`, ignored by Git): `udayan.db` (submissions and edited content), `uploads/` (CVs), `media/` (posters uploaded in the admin panel), and `live-listings.json`. Back this directory up.

## Pages

Home, movies, experience, story, gallery, DPD Café, contact/directions, Hooghly River, advertising, careers, and patron feedback. The homepage movie section is a swipeable carousel with previous/next buttons, keyboard navigation, and all current/upcoming cards. Contact, advertising, DPD Café, careers, and patron feedback each have a dedicated form. Movie language filters and upcoming tabs work; the cinema selector changes live listings and booking destinations. Every booking button, movie card, and showtime opens a District/BookMyShow platform chooser. Photo galleries support a native modal, arrow-key navigation, Escape, and touch controls. Mobile navigation, keyboard focus, reduced-motion preferences, and per-page metadata are included.

## Content and source accuracy

- Source: https://udayancinema.com/, collected 22 September 2026.
- `research/scraped-content.json` contains page text, links, image origins, and extracted CSS colors. Raw HTML and site styles are retained in `research/`.
- Now Showing and showtimes refresh from the two public District cinema pages. This is public page extraction, not an official API or a live BookMyShow feed.
- `lib/data.ts` contains cinema records and the curated Coming Soon snapshot from the original website; upcoming titles are labelled separately from live show listings.
- The chooser links to the selected venue/date on District and BookMyShow. Movie/time selections are shown for reference; visitors select the matching show and seats on the provider. No invented movie IDs or seat-booking links are used.
- Ticket prices, available seats, ratings, runtimes, and upcoming release dates are not invented or represented as live on this site.
- Careers and patron feedback reproduce the original site’s form fields (the feedback categories are now 1–5 ratings instead of free text). Submissions are handled by this site; nothing redirects to the old WordPress forms.
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
- The generated cache is `storage/live-listings.json` (inside `DATA_DIR`, ignored by Git). Writes are atomic and overlapping runs are locked. The route `/data/live-listings.json` serves the latest file with `Cache-Control: no-store`, so rebuilds are unnecessary.
- Each cinema records its own successful-update time. Failed refreshes preserve its last good data and expose an update warning. Expired shows are hidden; caches older than 24 hours are not displayed as bookable shows. Missing listings offer the platform chooser rather than silently falling back to the old movie snapshot.
- District’s page structure can change. Parser failures are logged by the worker and covered by the stale-data UI; maintain the extractor if the source changes.
- As of 25 September 2026, District's dated pages (`?fromdate=`) are rendered in the browser and carry no show data. The worker keeps the main page's shows (usually today's) and records the skipped dates, which the admin Now showing page reports, instead of failing the whole cinema.
- This work remains local; no website has been deployed.

## Nearby cinema selection

On a first visit without a saved manual preference, the site requests browser location permission and chooses the nearest cinema using the venue coordinates published by District (Sheoraphuli: 22.774846, 88.326738; Tarakeswar: 22.874893, 88.012038). Coordinates are used only in browser memory and are not sent to our server or stored. This uses browser geolocation, not IP geolocation, and requires HTTPS in production (localhost works for development).

A manual cinema choice is remembered on that browser. It takes priority over automatic detection, including a pending location request. “Use my location” in the header picker allows visitors to opt back into automatic selection. Denied permission, timeouts, and unavailable location services leave manual selection usable; the initial fallback is Sheoraphuli. Listings and booking destinations share the selected cinema. The browser tab and Apple touch icon use the original Udayan logo.

Run `npm test` to verify nearest-venue calculations, saved preferences, permission failures, and in-flight request handling.

## Collections and header navigation

The header’s More menu links to Hooghly River, Advertise with Us, Careers, Gallery, and Patron Feedback. All links also appear directly in the mobile menu.

`components/document-book.tsx` presents the complete original collections with a page-turn effect, swipe/keyboard navigation, page selection, optional thumbnails, and an enlarged reading dialog. Reduced-motion preferences disable the turn animation. All 59 Hooghly slides and all 19 advertising brochure pages are local assets; `research/collections.json` records their original URLs, checked on 25 September 2026. Advertising rates are reproduced within the original brochure and must be confirmed with the cinema. The career page has its own application form with CV upload (see Forms and email).

## Forms and email

Every form is defined once in `lib/forms.ts` (fields, validation, labels) and rendered by `components/site-form.tsx`. Submissions go to the server action in `lib/actions/submit-form.ts`, which:

1. Validates every field on the server: Indian mobile numbers, email, allowed options, ratings 1–5, dates, and lengths.
2. Checks the CV's actual file contents (PDF, DOC, or DOCX, up to 5 MB). CVs are stored privately in `storage/uploads/` and are only downloadable by a signed-in admin.
3. Saves the submission to the database, then shows the visitor a reference number such as `UC-00012`.
4. After responding, emails the admins through Resend's API, with the CV attached and reply-to set to the visitor's email. Delivery success or failure is recorded on the submission, and it can be resent from the admin panel.

Spam protection: a hidden honeypot field, a minimum fill time, and 5 submissions per 10 minutes per IP address. Forms still submit without JavaScript.

| Page | Form | Required |
| --- | --- | --- |
| Contact | General enquiry | Name, mobile, cinema, topic, message |
| Advertise with us | Advertising enquiry | Name, company, mobile, email, cinema |
| DPD Café | Café enquiry | Name, mobile, location, enquiry type |
| Careers | Job application with CV | Name, mobile, qualification, CV |
| Patron feedback | Ratings for cleanliness, picture, sound, F&B, and staff, plus remarks | Location, mobile, and at least one rating or remark |

Home, Movies, Experience, Our story, Gallery, and Hooghly River are browsing pages. Their calls to action lead to booking or to the pages above.

Resend setup: verify your sending domain in Resend, then set `RESEND_API_KEY` and `RESEND_FROM` (see `.env.example`). Without them, submissions are still saved and the admin panel shows a warning.

## Admin panel

Visit `/admin`. The server owner signs in with the login **admin** and `ADMIN_PASSWORD`. That account always exists, so access can't be lost. Staff sign in with their own email and password. Sessions last 12 hours in a signed, httpOnly cookie. Deactivating an account, changing its role, or resetting its password signs that person out immediately. `proxy.ts` redirects signed-out visitors, and every admin page, action, and file route checks the session and role itself. Sign-in attempts are rate-limited.

| Role | Access |
| --- | --- |
| Owner | Everything: staff accounts, email settings, activity log, and backups |
| Editor | Website content, cinemas, now showing, coming soon, and all submissions |
| Front desk | Submissions only: read, set status, add notes, resend emails, export (no delete) |

- **Dashboard**: open and new counts per form, the latest submissions, and email setup warnings for owners.
- **Submissions**: filter, search, bulk-mark, and export to CSV. Each record has call, WhatsApp, and reply shortcuts, a status, an internal note, the CV download, notification and auto-reply delivery status, a resend option, and (owners and editors only) delete.
- **Pages & photos** (`lib/content-schema.ts`): every page heading and search description, the home page (hero, highlights strip, section headings, café banner, heritage, search listing), the Experience amenities, the Our story text and timeline, the Contact FAQ, the DPD Café story and photos, the Gallery, the Advertise with us introduction and formats, the **advertising brochure** and **Hooghly River book** (pages, order, titles, page shape, and credit), and the **form choices** (contact topics, advertising formats, café enquiry types). Lists can be added to, reordered, and removed. Photos upload as soon as they are chosen, through `/admin/upload` (signed-in editors and owners only, same-origin only), three at a time with progress; image lists also have **Add several**, which adds one row per file in file-name order. Saving waits for uploads to finish and sends only the file paths. In a book's introduction, `{pages}` is replaced by the current page count. In headings, a new line is a line break and `*words*` are shown in red.
- **Now showing**: sync status per cinema, **Refresh now**, and per-listing hide, title correction, and poster replacement. Corrections are applied when `/data/live-listings.json` is served, so they survive every refresh.
- **Coming soon**, **Cinemas** (including each cinema's home-page photo), and **Site details** as before.
- **Email**: notification recipients (default and per form), test emails, and an **automatic reply** to visitors who leave an email address. The reply has `{name}`, `{reference}`, and `{form}` placeholders, can be turned on per form, and is sent with reply-to set to the public contact email.
- **Staff accounts**: add people with a role and temporary password, rename them, change their role, deactivate, reset passwords, or delete. There must always be an active owner. Each person can change their own password under **My account**.
- **Activity & backup**: a log of every sign-in and change (who, what, when), and a **Download backup** button that streams a `.tar` of the database, CVs, and uploaded photos.

Edits appear on the public site on the next page load. Anything not yet edited uses the defaults in `lib/data.ts`. Book pages must be uploaded as JPG, PNG, or WebP images (up to 3 MB each); convert a PDF to page images before uploading. Edited form choices apply immediately to new submissions, and past submissions keep the wording they were sent with.
