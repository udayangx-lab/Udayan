// Describes every editable content section once. The admin editor renders it, the server validates
// against it, and the content lives at `path` inside SiteContent. Keep free of runtime imports.
import type {PageSlug} from './data';

export const iconOptions: Record<string, string> = {
  projector: 'Projector', sound: 'Sound waves', seat: 'Armchair', coffee: 'Coffee cup', ticket: 'Ticket', popcorn: 'Popcorn',
  film: 'Film', car: 'Car', star: 'Star', heart: 'Heart', sparkles: 'Sparkles', 'map-pin': 'Map pin', users: 'People', clock: 'Clock', external: 'Arrow out',
};
export type FieldKind = 'text' | 'textarea' | 'heading' | 'image' | 'icon' | 'year' | 'ratio';
export type SchemaField = {name: string; label: string; kind: FieldKind; max?: number; hint?: string; optional?: boolean; rows?: number};
export type ListField = {name: string; label: string; kind: 'list'; itemLabel: string; fields: SchemaField[]; min?: number; max: number; hint?: string};
export type Section = {id: string; group: string; title: string; description: string; path: string[]; preview: string; fields: (SchemaField | ListField)[]};

const headingHint = 'Start a new line for a line break. Wrap words in *asterisks* to show them in red.';
const paragraphsHint = 'Leave an empty line between paragraphs.';
const text = (name: string, label: string, extra: Partial<SchemaField> = {}): SchemaField => ({name, label, kind: 'text', ...extra});
const area = (name: string, label: string, extra: Partial<SchemaField> = {}): SchemaField => ({name, label, kind: 'textarea', max: 1200, ...extra});
const heading = (name: string, label: string): SchemaField => ({name, label, kind: 'heading', max: 160, hint: headingHint, rows: 3});
const image = (name: string, label: string, hint?: string): SchemaField => ({name, label, kind: 'image', hint});
const photos = (max: number): ListField => ({name: 'photos', label: 'Photos', kind: 'list', itemLabel: 'Photo', min: 1, max,
  fields: [image('src', 'Photo'), text('alt', 'Caption', {max: 120, hint: 'Shown on the photo and read aloud by screen readers.'})]});

function documentSection(id: string, title: string, key: string, preview: string, max: number): Section {
  return {id, group: 'Page content', title, description: `The page-turning viewer on ${preview}. Upload pages as images, in order.`, path: ['documents', key], preview, fields: [
    text('eyebrow', 'Small heading', {max: 80}), text('heading', 'Heading', {max: 100}),
    area('intro', 'Introduction', {max: 400, rows: 3, hint: 'Write {pages} to show the current number of pages.'}),
    text('title', 'Viewer title', {max: 80, hint: 'Shown above the pages.'}),
    {name: 'aspectRatio', label: 'Page shape (width / height)', kind: 'ratio', hint: 'The pixel size of the page images, e.g. 1790 / 1276. All pages should share it.'},
    text('credit', 'Credit line', {max: 120, optional: true}),
    {name: 'pages', label: 'Pages', kind: 'list', itemLabel: 'Page', min: 1, max, hint: 'Use “Add several pages” to upload many images at once. They are added in file-name order.',
      fields: [image('src', 'Page image'), text('alt', 'Page description', {max: 160, hint: 'Read aloud by screen readers.'})]},
  ]};
}
const choiceList = (name: string, label: string, hint: string): ListField => ({name, label, kind: 'list', itemLabel: 'Choice', min: 1, max: 20, hint, fields: [text('label', 'Choice', {max: 80})]});

const pageLabels: Record<PageSlug, string> = {
  movies: 'Movies', experience: 'The experience', about: 'Our story', gallery: 'Gallery', 'dpd-cafe': 'DPD Café', contact: 'Visit us (contact)',
  'hooghly-river': 'Hooghly River', advertisement: 'Advertise with us', career: 'Careers', 'patron-feedback': 'Patron feedback',
};

export const sections: Section[] = [
  {id: 'home-hero', group: 'Home page', title: 'Hero', description: 'The large photo banner at the top of the home page.', path: ['home'], preview: '/', fields: [
    text('heroEyebrow', 'Small heading', {max: 80}), heading('heroHeading', 'Main heading'), area('heroText', 'Introduction', {max: 300, rows: 2, hint: 'Start a new line for a line break.'}),
    image('heroImage', 'Background photo', 'A wide landscape photo works best. The left side is darkened for the text.'), text('heroImageAlt', 'Photo description', {max: 160}),
    text('heroButton', 'Main button', {max: 40, hint: 'Opens the booking platform chooser.'}), text('heroLink', 'Secondary link', {max: 40, hint: 'Links to The experience.'}),
    text('heroTagline', 'Bottom line', {max: 80}), text('heroSideLabel', 'Vertical side label', {max: 60}),
  ]},
  {id: 'home-strip', group: 'Home page', title: 'Highlights strip', description: 'The row of icons below the hero.', path: ['home'], preview: '/', fields: [
    {name: 'strip', label: 'Highlights', kind: 'list', itemLabel: 'Highlight', min: 1, max: 6, fields: [{name: 'icon', label: 'Icon', kind: 'icon'}, text('text', 'Text', {max: 60})]},
  ]},
  {id: 'home-sections', group: 'Home page', title: 'Movies, experience & cinemas', description: 'Headings for the movie carousel, the experience feature, and the cinema cards. Cinema photos are edited under Cinemas.', path: ['home'], preview: '/', fields: [
    text('moviesEyebrow', 'Movies · small heading', {max: 80}), text('moviesHeading', 'Movies · heading', {max: 100}),
    text('featureEyebrow', 'Experience · small heading', {max: 80}), heading('featureHeading', 'Experience · heading'), area('featureText', 'Experience · text', {max: 400, rows: 3}),
    image('featureImage', 'Experience · photo'), text('featureImageAlt', 'Experience · photo description', {max: 160}), text('featureNote', 'Experience · photo caption', {max: 80, optional: true}),
    text('featureButton', 'Experience · button', {max: 40}),
    text('venuesEyebrow', 'Cinemas · small heading', {max: 80}), text('venuesHeading', 'Cinemas · heading', {max: 100}),
  ]},
  {id: 'home-cafe', group: 'Home page', title: 'Café banner & heritage', description: 'The DPD Café banner and the “since 1946” section at the bottom of the home page.', path: ['home'], preview: '/', fields: [
    text('cafeEyebrow', 'Café · small heading', {max: 80}), heading('cafeHeading', 'Café · heading'), area('cafeText', 'Café · text', {max: 300, rows: 2, hint: 'Start a new line for a line break.'}),
    image('cafeImage', 'Café · background photo'), text('cafeButton', 'Café · button', {max: 40}),
    {name: 'heritageYear', label: 'Heritage · year', kind: 'year'}, text('heritageCaption', 'Heritage · caption under the year', {max: 80}),
    text('heritageEyebrow', 'Heritage · small heading', {max: 80}), heading('heritageHeading', 'Heritage · heading'), area('heritageText', 'Heritage · text', {max: 400, rows: 3}),
    text('heritageLink', 'Heritage · link text', {max: 40}),
  ]},
  {id: 'home-seo', group: 'Home page', title: 'Search listing', description: 'How the home page appears in Google and when shared.', path: ['home'], preview: '/', fields: [
    text('seoTitle', 'Page title', {max: 70, hint: 'Shown in the browser tab and search results. About 50–60 characters is ideal.'}),
    area('seoDescription', 'Description', {max: 170, rows: 3, hint: 'About 120–160 characters is ideal.'}),
  ]},
  ...(Object.keys(pageLabels) as PageSlug[]).map((slug): Section => ({
    id: `page-${slug}`, group: 'Page headings', title: pageLabels[slug], description: `The heading block at the top of /${slug} and its search listing.`,
    path: ['pages', slug], preview: `/${slug}`, fields: [
      text('title', 'Page title', {max: 60, hint: 'Used in the browser tab, search results, and breadcrumb.'}), text('eyebrow', 'Small heading', {max: 80}),
      text('heading', 'Main heading', {max: 100}), area('description', 'Introduction', {max: 300, rows: 3}),
      area('seoDescription', 'Search description', {max: 170, rows: 2, optional: true, hint: 'Optional. If empty, the introduction is used.'}),
    ],
  })),
  {id: 'experience', group: 'Page content', title: 'The experience', description: 'The photo, amenity cards, and closing call to action.', path: ['experience'], preview: '/experience', fields: [
    image('image', 'Wide photo'), text('imageAlt', 'Photo description', {max: 160}),
    {name: 'features', label: 'Amenities', kind: 'list', itemLabel: 'Amenity', min: 1, max: 8, fields: [
      {name: 'icon', label: 'Icon', kind: 'icon'}, text('label', 'Label', {max: 40}), text('title', 'Title', {max: 80}), area('text', 'Text', {max: 240, rows: 2})]},
    text('ctaHeading', 'Closing heading', {max: 80}), text('ctaText', 'Closing text', {max: 160}),
  ]},
  {id: 'about', group: 'Page content', title: 'Our story', description: 'The story, timeline, and closing call to action.', path: ['about'], preview: '/about', fields: [
    image('image', 'Photo'), text('imageAlt', 'Photo description', {max: 160}), heading('heading', 'Story heading'),
    area('text', 'Story', {max: 3000, rows: 8, hint: paragraphsHint}),
    {name: 'timeline', label: 'Timeline', kind: 'list', itemLabel: 'Milestone', min: 1, max: 12, fields: [
      {name: 'year', label: 'Year', kind: 'year'}, text('title', 'Title', {max: 80}), area('text', 'Text', {max: 240, rows: 2})]},
    text('ctaHeading', 'Closing heading', {max: 80}), text('ctaText', 'Closing text', {max: 160}),
  ]},
  {id: 'contact', group: 'Page content', title: 'Contact FAQ', description: 'The questions and answers at the bottom of Visit us.', path: ['contact'], preview: '/contact', fields: [
    text('faqEyebrow', 'Small heading', {max: 80}), text('faqHeading', 'Heading', {max: 100}),
    {name: 'faq', label: 'Questions', kind: 'list', itemLabel: 'Question', min: 1, max: 20, fields: [text('question', 'Question', {max: 160}), area('answer', 'Answer', {max: 800, rows: 3})]},
  ]},
  {id: 'cafe', group: 'Page content', title: 'DPD Café', description: 'The café story and its photos.', path: ['cafe'], preview: '/dpd-cafe', fields: [
    image('image', 'Main photo'), text('imageAlt', 'Photo description', {max: 160}), text('eyebrow', 'Small heading', {max: 80}), heading('heading', 'Heading'),
    area('text', 'Text', {max: 1500, rows: 5, hint: paragraphsHint}), text('galleryEyebrow', 'Photos · small heading', {max: 80}), text('galleryHeading', 'Photos · heading', {max: 100}),
    photos(24),
  ]},
  {id: 'advertising', group: 'Page content', title: 'Advertise with us', description: 'The introduction and advertising formats above the brochure.', path: ['advertising'], preview: '/advertisement', fields: [
    text('eyebrow', 'Small heading', {max: 80}), heading('heading', 'Heading'), area('text', 'Text', {max: 600, rows: 3}),
    image('image', 'Photo'), text('imageAlt', 'Photo description', {max: 160}),
    {name: 'formats', label: 'Advertising formats', kind: 'list', itemLabel: 'Format', min: 1, max: 6, fields: [
      {name: 'icon', label: 'Icon', kind: 'icon'}, text('title', 'Title', {max: 60}), area('text', 'Text', {max: 240, rows: 2})]},
  ]},
  documentSection('advertising-brochure', 'Advertising brochure', 'advertising', '/advertisement', 60),
  documentSection('hooghly-book', 'Hooghly River book', 'hooghly', '/hooghly-river', 150),
  {id: 'gallery', group: 'Page content', title: 'Gallery', description: 'The photos on the Gallery page.', path: ['gallery'], preview: '/gallery', fields: [photos(60)]},
  {id: 'form-options', group: 'Forms', title: 'Form choices', description: 'The options visitors pick from in the enquiry forms. Past submissions keep the wording they were sent with.', path: ['formOptions'], preview: '/contact', fields: [
    choiceList('contactTopic', 'Contact form · “How can we help?”', 'Shown on the Visit us page.'),
    choiceList('advertisingFormats', 'Advertising form · formats', 'Shown as tick boxes on Advertise with us.'),
    choiceList('cafeEnquiry', 'DPD Café form · enquiry type', 'Shown on the DPD Café page.'),
  ]},
];
export const findSection = (id: string) => sections.find(section => section.id === id);

// Form encoding: a field posts under its name, an image also posts `name.__file`, and each list
// row posts `list.__id` plus `list.field` (and `list.field.__file`) so rows can be read by index.
type Input = {get(name: string): unknown; getAll(name: string): unknown[]};
export type Upload = {file: File; assign: (path: string) => void};
export const imagePath = /^\/(images|media)\/[\w.\-()%]+$/;
const isFile = (value: unknown): value is File => typeof value === 'object' && value !== null && 'size' in value && 'arrayBuffer' in value && (value as File).size > 0;
const clean = (value: unknown) => typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';

function readField(field: SchemaField, raw: unknown, file: unknown, label: string, errors: string[], uploads: Upload[], target: Record<string, string>) {
  let value = clean(raw);
  const max = field.max ?? (field.kind === 'textarea' ? 1200 : field.kind === 'heading' ? 160 : 120);
  if (field.kind === 'image') {
    if (isFile(file)) uploads.push({file, assign: path => {target[field.name] = path;}});
    else if (!imagePath.test(value)) errors.push(`${label}: add a photo.`);
  } else if (!value && !field.optional) errors.push(`${label} is required.`);
  else if (value.length > max) errors.push(`${label}: keep it under ${max} characters.`);
  else if (field.kind === 'icon' && !(value in iconOptions)) errors.push(`${label}: choose an icon.`);
  else if (field.kind === 'year' && !/^\d{4}$/.test(value)) errors.push(`${label} must be a four-digit year.`);
  else if (field.kind === 'ratio') {
    const match = /^(\d{1,5}(?:\.\d+)?)\s*[/:x×]\s*(\d{1,5}(?:\.\d+)?)$/.exec(value);
    if (!match || !Number(match[1]) || !Number(match[2])) errors.push(`${label}: write it as width / height, e.g. 1790 / 1276.`);
    else value = `${Number(match[1])} / ${Number(match[2])}`;
  }
  if (field.kind === 'heading' || field.kind === 'text') value = value.replace(/[ \t]+/g, ' ');
  target[field.name] = value;
}

/** Reads a section's posted values. Image uploads are returned for the server to store, then assign. */
export function readSection(section: Section, input: Input) {
  const values: Record<string, unknown> = {};
  const errors: string[] = [];
  const uploads: Upload[] = [];
  for (const field of section.fields) {
    if (field.kind !== 'list') {
      readField(field, input.get(field.name), input.get(`${field.name}.__file`), field.label, errors, uploads, values as Record<string, string>);
      continue;
    }
    const ids = input.getAll(`${field.name}.__id`).map(clean);
    const columns = Object.fromEntries(field.fields.map(item => [item.name, input.getAll(`${field.name}.${item.name}`)]));
    const files = Object.fromEntries(field.fields.filter(item => item.kind === 'image').map(item => [item.name, input.getAll(`${field.name}.${item.name}.__file`)]));
    if (ids.length < (field.min ?? 0)) errors.push(`${field.label}: add at least ${field.min}.`);
    if (ids.length > field.max) errors.push(`${field.label}: keep it to ${field.max} or fewer.`);
    values[field.name] = ids.slice(0, field.max).map((id, index) => {
      const row: Record<string, string> = {id: /^[\w-]{1,80}$/.test(id) ? id : `item-${Date.now().toString(36)}-${index}`};
      for (const item of field.fields) readField(item, columns[item.name][index], files[item.name]?.[index], `${field.itemLabel} ${index + 1} · ${item.label}`, errors, uploads, row);
      return row;
    });
  }
  return {values, errors, uploads};
}

/** Current values for a section, read from content by its path. */
export function sectionValues(section: Section, content: object) {
  return section.path.reduce<Record<string, unknown>>((node, key) => (node?.[key] ?? {}) as Record<string, unknown>, content as Record<string, unknown>);
}
