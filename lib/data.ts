// Default site content. The admin panel stores edits in the database; these values seed it
// and fill any field that has not been saved yet. Keep this module free of runtime imports.
export type Cinema = {
  id: string; name: string; tagline: string; since: string; address: string; phone: string; parking: string;
  district: string; maps: string; image: string; coordinates: {latitude: number; longitude: number};
};
/** An admin-added Coming soon title. It stays listed until its release date (if given) has passed. */
export type UpcomingMovie = {id: string; title: string; poster: string; releaseDate?: string; language?: string};
export type Photo = {id: string; src: string; alt: string};
export type IconItem = {id: string; icon: string; text: string};
export type Feature = {id: string; icon: string; label: string; title: string; text: string};
export type Milestone = {id: string; year: string; title: string; text: string};
export type Faq = {id: string; question: string; answer: string};
export type Choice = {id: string; label: string};
export type DocumentContent = {eyebrow: string; heading: string; intro: string; title: string; aspectRatio: string; credit: string; pages: Photo[]};
export type PageCopy = {title: string; eyebrow: string; heading: string; description: string; seoDescription: string};
export const pageSlugs = ['movies', 'experience', 'about', 'gallery', 'dpd-cafe', 'contact', 'hooghly-river', 'advertisement', 'career', 'patron-feedback'] as const;
export type PageSlug = typeof pageSlugs[number];

export type HomeContent = {
  seoTitle: string; seoDescription: string;
  heroEyebrow: string; heroHeading: string; heroText: string; heroImage: string; heroImageAlt: string;
  heroButton: string; heroLink: string; heroTagline: string; heroSideLabel: string;
  strip: IconItem[];
  moviesEyebrow: string; moviesHeading: string;
  featureEyebrow: string; featureHeading: string; featureText: string; featureImage: string; featureImageAlt: string; featureNote: string; featureButton: string;
  venuesEyebrow: string; venuesHeading: string;
  cafeEyebrow: string; cafeHeading: string; cafeText: string; cafeImage: string; cafeButton: string;
  heritageYear: string; heritageCaption: string; heritageEyebrow: string; heritageHeading: string; heritageText: string; heritageLink: string;
};
export type SiteContent = {
  announcement: string; contactEmail: string; facebook: string; cinemas: Cinema[]; upcoming: UpcomingMovie[];
  home: HomeContent; pages: Record<PageSlug, PageCopy>;
  experience: {image: string; imageAlt: string; features: Feature[]; ctaHeading: string; ctaText: string};
  about: {image: string; imageAlt: string; heading: string; text: string; timeline: Milestone[]; ctaHeading: string; ctaText: string};
  contact: {faqEyebrow: string; faqHeading: string; faq: Faq[]};
  cafe: {image: string; imageAlt: string; eyebrow: string; heading: string; text: string; galleryEyebrow: string; galleryHeading: string; photos: Photo[]};
  gallery: {photos: Photo[]};
  advertising: {eyebrow: string; heading: string; text: string; image: string; imageAlt: string; formats: Feature[]};
  documents: {advertising: DocumentContent; hooghly: DocumentContent};
  formOptions: {contactTopic: Choice[]; advertisingFormats: Choice[]; cafeEnquiry: Choice[]};
};

/** The part of the content the browser needs for the header, footer, picker, booking, and listings. */
export type PublicContent = Pick<SiteContent, 'announcement' | 'contactEmail' | 'cinemas' | 'upcoming' | 'formOptions'>;
export const publicContent = ({announcement, contactEmail, cinemas, upcoming, formOptions}: SiteContent): PublicContent => ({announcement, contactEmail, cinemas, upcoming, formOptions});

const withIds = <T extends object>(prefix: string, items: T[]) => items.map((item, index) => ({id: `${prefix}-${index + 1}`, ...item}));

export const cinemas: Cinema[] = [
  { id: 'sheoraphuli', coordinates: {latitude: 22.774846, longitude: 88.326738}, district: 'https://www.district.in/movies/udayan-cinema-sheoraphuli-in-howrah-CD1102426', name: 'Sheoraphuli', tagline: 'Grand Trunk Road', since: '1946', address: '35, Grand Trunk Road, Sheoraphuli, Hooghly, West Bengal 712223', phone: '7003697009', parking: 'Two-wheeler parking', maps: 'https://www.google.com/maps/search/?api=1&query=Udayan+Cinema+Sheoraphuli', image: '/images/gallery-2.jpg' },
  { id: 'tarakeswar', coordinates: {latitude: 22.874893, longitude: 88.012038}, district: 'https://www.district.in/movies/udayan-cinema-tarakeswar-in-hoogly-CD1102427', name: 'Tarakeswar', tagline: 'Silvision Mall', since: '2025', address: '2nd Floor, Silvision Mall, Gure, Tarakeswar, West Bengal 712410', phone: '7679088942', parking: 'Two & four-wheeler parking', maps: 'https://www.google.com/maps/search/?api=1&query=Udayan+Cinema+Tarakeswar', image: '/images/WhatsApp-Image-2025-11-03-at-9.45.01-AM.jpeg' },
];
// Titles the cinema adds itself in Admin → Coming soon. District's upcoming releases are added automatically.
export const upcoming: UpcomingMovie[] = [];

const choices = (prefix: string, labels: string[]): Choice[] => labels.map((label, index) => ({id: `${prefix}-${index + 1}`, label}));
const pageImages = (count: number, src: (index: number) => string, alt: (index: number) => string): Photo[] =>
  Array.from({length: count}, (_, index) => ({id: `page-${index + 1}`, src: src(index), alt: alt(index)}));

const page = (title: string, eyebrow: string, heading: string, description: string): PageCopy => ({title, eyebrow, heading, description, seoDescription: ''});

export const defaultContent: SiteContent = {
  announcement: 'ENTERTAINING GENERATIONS. SINCE 1946.',
  contactEmail: 'contact@udayancinema.com',
  facebook: 'https://www.facebook.com/udayancinema',
  cinemas, upcoming,
  home: {
    seoTitle: 'Udayan Cinema | A little closer to the movies',
    seoDescription: 'Experience cinema at Udayan, entertaining since 1946. Explore movies, Dolby 7.1 sound, luxury seating and DPD Café in Sheoraphuli and Tarakeswar.',
    heroEyebrow: 'THE BIG SCREEN. THE REAL EXPERIENCE.', heroHeading: 'Some stories\ndeserve a\n*bigger screen.*',
    heroText: 'Feel every moment. Share every emotion.\nMake it a movie day at Udayan.',
    heroImage: '/images/WhatsApp-Image-2025-11-03-at-9.44.57-AM.jpeg', heroImageAlt: 'Red cinema seats inside Udayan Cinema’s auditorium',
    heroButton: 'Find your next movie', heroLink: 'Explore Udayan', heroTagline: 'YOUR NEIGHBOURHOOD. YOUR CINEMA.', heroSideLabel: 'SHEORAPHULI & TARAKESWAR',
    strip: withIds('strip', [{icon: 'projector', text: '2K laser projection'}, {icon: 'sound', text: 'Dolby 7.1 surround'}, {icon: 'seat', text: 'Sit back in luxury'}, {icon: 'coffee', text: 'Good food. Great films.'}]),
    moviesEyebrow: 'LIGHTS DOWN. EXCITEMENT UP.', moviesHeading: 'Your next big-screen escape.',
    featureEyebrow: 'MORE THAN A MOVIE', featureHeading: 'Settle in.\nSwitch off.\n*Feel everything.*',
    featureText: 'Immersive sound. Crystal-clear projection. A seat you’ll love sinking into. We make the little things count, so you can get lost in the big picture.',
    featureImage: '/images/WhatsApp-Image-2025-11-03-at-9.45.02-AM.jpeg', featureImageAlt: 'Plush reclining seats at Udayan Cinema',
    featureNote: 'A little more comfort. A lot more cinema.', featureButton: 'The Udayan experience',
    venuesEyebrow: 'TWO CINEMAS. ONE LOVE FOR FILM.', venuesHeading: 'There’s an Udayan near you.',
    cafeEyebrow: 'THE DPD LOUNGE & CAFÉ', cafeHeading: 'Come for the film.\nStay for a little more.',
    cafeText: 'A catch-up over coffee. A bite before the show.\nMake room for the other good part of movie day.',
    cafeImage: '/images/WhatsApp-Image-2026-07-30-at-7.09.17-PM.jpeg', cafeButton: 'Discover DPD Café',
    heritageYear: '1946', heritageCaption: 'THE BEGINNING OF SOMETHING SPECIAL', heritageEyebrow: 'A PART OF HOOGHLY. A PART OF YOUR STORY.',
    heritageHeading: 'Times change.\nThe magic stays.', heritageText: 'From first dates to family Sundays, we’ve been bringing people together through cinema for generations.',
    heritageLink: 'Get to know our story',
  },
  pages: {
    movies: page('Movies & showtimes', 'YOUR NEXT MOVIE STARTS HERE', 'Meet you at the movies.', 'Find a story you’ll love. Choose your cinema above, then browse the latest shows and book your seats on District.'),
    experience: page('The Udayan experience', 'BUILT AROUND THE BIG SCREEN', 'Cinema. With all the feels.', 'From the first frame to the final credits, settle into an experience made for movie lovers.'),
    about: page('Our story', 'ENTERTAINING SINCE 27 DECEMBER 1946', 'Generations of movie magic.', 'A family’s vision. A neighbourhood landmark. A love for cinema that keeps growing.'),
    gallery: page('Gallery', 'TAKE A LOOK AROUND', 'Step inside Udayan.', 'The spaces, the seats, and the shared moments that make a trip to the movies special.'),
    'dpd-cafe': page('DPD Lounge & Café', 'THE DPD LOUNGE & CAFÉ', 'Good films. Great company.', 'Before the show, after the credits, or just because. There’s always a reason to stop by.'),
    contact: page('Contact & directions', 'WE’LL SAVE YOU A WARM WELCOME', 'Your next outing starts here.', 'Find your cinema, get directions, or talk to our team. We’re happy to help.'),
    'hooghly-river': page('Hooghly River', 'ROOTED IN OUR COMMUNITY', 'Along the Hooghly.', 'Explore Udayan’s visual collection dedicated to the river and the region we call home.'),
    advertisement: page('Advertise with us', 'YOUR BRAND. OUR BIG SCREEN.', 'Be part of the picture.', 'Connect with Udayan Cinema to explore advertising opportunities in Sheoraphuli and Tarakeswar.'),
    career: page('Careers', 'MAKE A CAREER WITH US', 'Behind every great experience.', 'Join a team that values talent, creativity, and dedication. Your next chapter could start at Udayan.'),
    'patron-feedback': page('Patron feedback', 'EVERY VISIT MATTERS', 'We’re listening.', 'Tell us about your visit. The moments you loved, and the things we can do better.'),
  },
  experience: {
    image: '/images/WhatsApp-Image-2025-11-03-at-9.44.56-AM.jpeg', imageAlt: 'Udayan auditorium with red seats and a cinema screen',
    features: withIds('feature', [
      {icon: 'projector', title: 'Every detail, larger than life.', label: '2K LASER PROJECTION', text: 'Clear, vivid images that bring you closer to the story.'},
      {icon: 'sound', title: 'Sound that surrounds you.', label: 'DOLBY 7.1 SURROUND', text: 'Feel the atmosphere, the action, and every quiet moment.'},
      {icon: 'seat', title: 'Your comfort comes first.', label: 'LUXURY SEATING', text: 'Relax with spacious seating and premium recliner options.'},
      {icon: 'coffee', title: 'The perfect supporting cast.', label: 'FOOD & BEVERAGES', text: 'Fresh snacks, meals, and time together at DPD Café.'},
    ]),
    ctaHeading: 'Ready for the real thing?', ctaText: 'Choose your show, pick your seat, and let the story begin.',
  },
  about: {
    image: '/images/gallery-5.jpg', imageAlt: 'Historic Udayan Cinema exterior in Sheoraphuli', heading: 'A vision that became\na local landmark.',
    text: 'On 27 December 1946, Late Deb Prosad Daw opened Udayan Cinema in Sheoraphuli with a simple ambition: to bring quality entertainment to the people of Hooghly.\n\nToday, the third generation of the Daw family of Rishra carries that vision forward. Through changing times, Udayan has kept the warmth of a neighbourhood cinema while embracing a new way to experience the movies.\n\nOur story belongs as much to the people in our seats as it does to the films on our screens.',
    timeline: withIds('milestone', [
      {year: '1946', title: 'The first curtain rises.', text: 'Udayan opens in Sheoraphuli on 27 December.'},
      {year: '2016', title: 'A new chapter in cinema.', text: 'On its 70th anniversary, Udayan becomes a modern two-screen multiplex.'},
      {year: '2025', title: 'The family grows.', text: 'The Tarakeswar branch opens in August, bringing the Udayan experience to a new community.'},
    ]),
    ctaHeading: 'Still making memories.', ctaText: 'Discover your next Udayan experience.',
  },
  contact: {
    faqEyebrow: 'BEFORE YOUR VISIT', faqHeading: 'A few helpful details.',
    faq: withIds('faq', [
      {question: 'How do I book tickets?', answer: 'Select your cinema in the header, open a movie, and tap a showtime. District opens seat selection for that exact show, where you pay and receive your tickets.'},
      {question: 'Where can I find ticket prices and showtimes?', answer: 'Showtimes here refresh from District every 15 minutes. Final ticket prices and seat availability are confirmed on District. They can vary by movie, show, and seat type.'},
      {question: 'Is parking available?', answer: 'Sheoraphuli has two-wheeler parking. Tarakeswar has parking for both two-wheelers and four-wheelers.'},
      {question: 'Can I visit DPD Café without a movie ticket?', answer: 'Yes. DPD welcomes visitors with or without a cinema ticket. Contact your chosen venue for the current café menu and offers.'},
    ]),
  },
  cafe: {
    image: '/images/WhatsApp-Image-2026-07-30-at-7.09.17-PM.jpeg', imageAlt: 'DPD Café’s inviting seating area',
    eyebrow: 'NO MOVIE TICKET? NO PROBLEM.', heading: 'A place to pause.\nAnd stay a little.',
    text: 'Make time for coffee, food, and conversation at The DPD Lounge & Café. Come with your movie plans, or simply come for the company.\n\nFind DPD at Udayan Cinema in Sheoraphuli and at Silvision Mall in Tarakeswar.',
    galleryEyebrow: 'A TABLE FOR YOUR KIND OF DAY', galleryHeading: 'Make yourself at home.',
    photos: withIds('cafe', [
      {src: '/images/WhatsApp-Image-2026-06-28-at-7.31.35-PM.jpeg', alt: 'Relax at The DPD Lounge'},
      {src: '/images/WhatsApp-Image-2026-06-28-at-7.31.38-PM.jpeg', alt: 'A table for good company'},
      {src: '/images/WhatsApp-Image-2026-06-28-at-7.31.41-PM.jpeg', alt: 'Step inside DPD Café'},
    ]),
  },
  gallery: {
    photos: withIds('gallery', [
      {src: '/images/gallery-2.jpg', alt: 'Udayan Cinema, Sheoraphuli'},
      {src: '/images/WhatsApp-Image-2025-11-03-at-9.44.57-AM.jpeg', alt: 'The big-screen experience'},
      {src: '/images/WhatsApp-Image-2025-11-03-at-9.45.02-AM.jpeg', alt: 'Room to recline'},
      {src: '/images/WhatsApp-Image-2026-07-30-at-6.44.33-PM.jpeg', alt: 'A brighter kind of movie day'},
      {src: '/images/WhatsApp-Image-2026-07-30-at-7.09.17-PM.jpeg', alt: 'The DPD Lounge & Café'},
      {src: '/images/WhatsApp-Image-2025-11-03-at-9.45.01-AM.jpeg', alt: 'Udayan at Silvision Mall, Tarakeswar'},
      {src: '/images/gallery-8.jpg', alt: 'Welcome to the cinema'},
      {src: '/images/gallery-3.jpg', alt: 'Comfort in every row'},
      {src: '/images/WhatsApp-Image-2025-11-03-at-9.44.24-AM.jpeg', alt: 'Stories are better together'},
    ]),
  },
  advertising: {
    eyebrow: 'MAKE YOUR BRAND PART OF MOVIE DAY', heading: 'Make an impression.\nOn a bigger screen.',
    text: 'From the cinema screen to the spaces around it, explore ways to put your brand in front of Udayan’s audience.',
    image: '/images/Layer-1.jpg', imageAlt: 'Udayan Cinema advertising opportunities brochure cover',
    formats: withIds('format', [
      {icon: 'projector', label: '', title: 'On the screen', text: 'Explore on-screen advertising opportunities in our cinema auditoriums.'},
      {icon: 'seat', label: '', title: 'Across the cinema', text: 'Seat branding, entrance branding, standees, and backlit posters.'},
      {icon: 'external', label: '', title: 'Beyond the screening', text: 'Digital displays and pamphlet distribution help extend your campaign.'},
    ]),
  },
  documents: {
    advertising: {
      eyebrow: 'THE COMPLETE ADVERTISING BROCHURE', heading: 'Find your place in the picture.',
      intro: 'Browse all {pages} pages, including cinema details, advertising placements, and the published rate card. Confirm current rates and availability with our team.',
      title: 'Udayan · Advertising Opportunities', aspectRatio: '1094 / 624', credit: '',
      pages: pageImages(19, index => `/images/Layer-${index + 1}.jpg`, index => `Udayan advertising brochure — ${index === 0 ? 'cover' : index === 17 ? 'advertising rate card' : `page ${index + 1}`}`),
    },
    hooghly: {
      eyebrow: 'A RIVER · A DISTRICT · A MEMORY', heading: 'The river that built Bengal.',
      intro: 'An illustrated heritage journal curated by Rudra Prosad Daw. Turn through all {pages} pages of Udayan Cinema’s original collection.',
      title: 'Hooghly · The River That Built Bengal', aspectRatio: '1790 / 1276', credit: 'Curated by Rudra Prosad Daw · Udayan Cinema Pvt. Ltd.',
      pages: pageImages(59, index => `/images/DOC-20260612-WA0000._page-${String(index + 1).padStart(4, '0')}.jpg`, index => `Hooghly: The River That Built Bengal — ${index === 0 ? 'cover' : `page ${index + 1}`}`),
    },
  },
  // The same choices are the fallback in lib/forms.ts, which must stay free of imports.
  formOptions: {
    contactTopic: choices('topic', ['General enquiry', 'Help with a booking', 'Group visit', 'Something else']),
    advertisingFormats: choices('ad-format', ['On-screen advertising', 'Seat branding', 'Entrance branding', 'Standees', 'Backlit posters', 'Digital displays', 'Pamphlet distribution']),
    cafeEnquiry: choices('cafe-enquiry', ['Menu and offers', 'Plan a get-together', 'Celebrate an occasion', 'Something else']),
  },
};
export const nav = [{href:'/movies',label:'Movies'},{href:'/experience',label:'The experience'},{href:'/dpd-cafe',label:'DPD Café'},{href:'/about',label:'Our story'},{href:'/contact',label:'Visit us'}];

export const moreNav = [{href:'/hooghly-river',label:'Hooghly River'},{href:'/advertisement',label:'Advertise with us'},{href:'/career',label:'Careers'},{href:'/gallery',label:'Gallery'},{href:'/patron-feedback',label:'Patron feedback'}];
