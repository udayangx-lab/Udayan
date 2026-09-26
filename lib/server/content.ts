import {connection} from 'next/server';
import {query} from './db';
import {defaultContent, type Cinema, type SiteContent} from '@/lib/data';
import {formTypes, type FormType} from '@/lib/forms';

export type AutoReply = {enabled: boolean; forms: FormType[]; subject: string; message: string};
export type Notifications = {recipients: string[]; overrides: Partial<Record<FormType, string[]>>; autoReply: AutoReply};
export const defaultAutoReply: AutoReply = {
  enabled: false, forms: [...formTypes],
  subject: 'We’ve received your {form} · {reference}',
  message: 'Dear {name},\n\nThank you for contacting Udayan Cinema. We have received your {form} (reference {reference}), and our team will get back to you soon.\n\nWarm regards,\nUdayan Cinema\nEntertaining since 1946',
};

export async function readSetting<T>(key: string): Promise<T | null> {
  const [row] = await query<{value: T}>('SELECT value FROM settings WHERE key = $1', [key]);
  return row ? row.value : null;
}
export async function writeSetting(key: string, value: unknown) {
  await query('INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, JSON.stringify(value)]);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Saved values win where they have the right shape; defaults fill everything else, including fields added later. */
function merge<T>(defaults: T, saved: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(saved) ? saved : defaults) as T;
  if (isObject(defaults)) {
    const source = isObject(saved) ? saved : {};
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, merge(value, source[key])])) as T;
  }
  return (typeof saved === typeof defaults ? saved : defaults) as T;
}

export async function readContent(): Promise<SiteContent> {
  const saved = await readSetting<Partial<SiteContent>>('content') || {};
  const content = merge(defaultContent, saved);
  // Cinema IDs are fixed: live listings and saved visitor preferences depend on them.
  const savedCinemas = Array.isArray(saved.cinemas) ? saved.cinemas : [];
  content.cinemas = defaultContent.cinemas.map(cinema => merge<Cinema>(cinema, savedCinemas.find(item => item?.id === cinema.id)));
  return content;
}

/** For pages: waits for a request so edits appear immediately instead of being baked in at build time. */
export async function getSiteContent() {
  await connection();
  return readContent();
}

export async function saveContent(update: Partial<SiteContent>) {
  await writeSetting('content', {...await readContent(), ...update});
}

/** Merges values into the object at `path`, e.g. ['pages', 'about']. */
export async function saveContentAt(path: string[], values: Record<string, unknown>) {
  const content = await readContent() as unknown as Record<string, unknown>;
  let node = content;
  for (const key of path) node = (node[key] ??= {}) as Record<string, unknown>;
  Object.assign(node, values);
  await writeSetting('content', content);
}

export const envRecipients = () => (process.env.ADMIN_EMAIL || '').split(',').map(value => value.trim()).filter(Boolean);

export async function readNotifications(): Promise<Notifications> {
  const saved = await readSetting<Partial<Notifications>>('notifications') || {};
  const overrides: Notifications['overrides'] = {};
  for (const type of formTypes) if (saved.overrides?.[type]?.length) overrides[type] = saved.overrides[type];
  const autoReply = merge(defaultAutoReply, saved.autoReply);
  autoReply.forms = autoReply.forms.filter(type => formTypes.includes(type));
  return {recipients: Array.isArray(saved.recipients) ? saved.recipients : [], overrides, autoReply};
}
export async function saveNotifications(value: Partial<Notifications>) {await writeSetting('notifications', {...await readNotifications(), ...value});}

/** Who receives a form's notification: its own list, else the default list, else ADMIN_EMAIL. */
export async function recipientsFor(type: FormType) {
  const settings = await readNotifications();
  return settings.overrides[type]?.length ? settings.overrides[type]! : settings.recipients.length ? settings.recipients : envRecipients();
}
