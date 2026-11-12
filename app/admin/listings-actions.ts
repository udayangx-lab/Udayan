'use server';

import {requireAdmin} from '@/lib/server/auth';
import {describeRefresh, readOverrides, readUpcomingSettings, recordRun, refreshListings, saveOverrides, saveSyncSettings, saveUpcomingSettings} from '@/lib/server/listings';
import {saveImage} from '@/lib/server/uploads';
import {logActivity} from '@/lib/server/activity';
import {back, isUpload} from '@/lib/server/admin-helpers';

async function refreshFrom(page: string) {
  const admin = await requireAdmin('content');
  const result = await refreshListings();
  if (!result) back(page, {error: 'A refresh is already running. Try again in a minute.'});
  const detail = describeRefresh(result);
  await recordRun({trigger: 'admin', status: 'completed', at: new Date().toISOString(), detail});
  const failed = Object.entries(result.venues).filter(([, venue]) => venue.error);
  await logActivity(admin, `Refreshed listings from District (${failed.length || result.upcoming.error ? 'with errors' : 'succeeded'})`);
  if (failed.length) back(page, {error: 'District could not be refreshed for ' + failed.map(([id, venue]) => `${id} (${venue.error})`).join(', ') + '. The last saved listings are still shown.'});
  if (result.upcoming.error) back(page, {error: `District’s upcoming list could not be read (${result.upcoming.error}). The last saved list is still shown.`});
  back(page, {notice: 'refreshed'});
}
export async function refreshNowShowing() {await refreshFrom('/admin/now-showing');}
export async function refreshComingSoon() {await refreshFrom('/admin/coming-soon');}

export async function setAutomaticSync(formData: FormData) {
  const admin = await requireAdmin('content');
  const automatic = formData.get('automatic') === 'on';
  await saveSyncSettings(automatic);
  await logActivity(admin, `Turned automatic District fetching ${automatic ? 'on' : 'off'}`);
  back('/admin/now-showing');
}

export async function saveMovieOverride(formData: FormData) {
  const admin = await requireAdmin('content');
  const id = String(formData.get('movie') ?? '');
  if (!/^[\w.\- ]{1,120}$/.test(id)) back('/admin/now-showing', {error: 'Unknown movie.'});
  const overrides = await readOverrides();
  const original = String(formData.get('original') ?? '');
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const hidden = formData.get('hidden') === 'on';
  overrides.hidden = overrides.hidden.filter(item => item !== id);
  if (hidden) overrides.hidden.push(id);
  if (title && title !== original) overrides.titles[id] = title; else delete overrides.titles[id];
  const poster = formData.get('posterFile');
  if (formData.get('resetPoster') === 'on') delete overrides.posters[id];
  else if (isUpload(poster)) {
    const saved = await saveImage(poster);
    if ('error' in saved) back(`/admin/now-showing#${encodeURIComponent(id)}`, {error: saved.error});
    overrides.posters[id] = saved.path;
  }
  await saveOverrides(overrides);
  await logActivity(admin, `Updated now-showing listing “${title || original}”${hidden ? ' (hidden)' : ''}`);
  back(`/admin/now-showing#${encodeURIComponent(id)}`);
}

/** Which of District's upcoming releases are shown: languages and how far ahead. */
export async function saveComingSoonRules(formData: FormData) {
  const admin = await requireAdmin('content');
  const languages = [...new Set(formData.getAll('language').map(String).filter(value => /^[\p{L} ]{2,30}$/u.test(value)))];
  const windowDays = Number(formData.get('windowDays'));
  if (!languages.length) back('/admin/coming-soon#rules', {error: 'Choose at least one language.'});
  if (!Number.isInteger(windowDays) || windowDays < 7 || windowDays > 180) back('/admin/coming-soon#rules', {error: 'Show releases from 7 to 180 days ahead.'});
  await saveUpcomingSettings({...await readUpcomingSettings(), languages, windowDays});
  await logActivity(admin, `Updated Coming soon rules (${languages.join(', ')}; ${windowDays} days)`);
  back('/admin/coming-soon#rules');
}

/** Hides or shows District titles. Only the titles on the form change; other hidden titles stay hidden. */
export async function saveComingSoonVisibility(formData: FormData) {
  const admin = await requireAdmin('content');
  const listed = formData.getAll('film').map(String).filter(id => /^\d{1,12}$/.test(id));
  const hidden = new Set(formData.getAll('hidden').map(String).filter(id => listed.includes(id)));
  const settings = await readUpcomingSettings();
  const next = [...settings.hidden.filter(id => !listed.includes(id)), ...hidden];
  await saveUpcomingSettings({...settings, hidden: next});
  await logActivity(admin, `Updated hidden District titles (${hidden.size} hidden on this list)`);
  back('/admin/coming-soon#district');
}
