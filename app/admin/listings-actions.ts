'use server';

import {requireAdmin} from '@/lib/server/auth';
import {readOverrides, refreshListings, saveOverrides} from '@/lib/server/listings';
import {saveImage} from '@/lib/server/uploads';
import {logActivity} from '@/lib/server/activity';
import {back, isUpload} from '@/lib/server/admin-helpers';

export async function refreshNowShowing() {
  const admin = await requireAdmin('content');
  const result = await refreshListings();
  if (!result) back('/admin/now-showing', {error: 'A refresh is already running. Try again in a minute.'});
  const failed = Object.entries(result.venues).filter(([, venue]) => venue.error);
  await logActivity(admin, `Refreshed now-showing listings (${failed.length ? 'with errors' : 'succeeded'})`);
  if (failed.length) back('/admin/now-showing', {error: 'District could not be refreshed for ' + failed.map(([id, venue]) => `${id} (${venue.error})`).join(', ') + '. The last saved listings are still shown.'});
  back('/admin/now-showing', {notice: 'refreshed'});
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
