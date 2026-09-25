'use server';

import {requireAdmin} from '@/lib/server/auth';
import {readOverrides, refreshListings, saveOverrides} from '@/lib/server/listings';
import {saveImage} from '@/lib/server/uploads';
import {logActivity} from '@/lib/server/activity';
import {back, isUpload} from '@/lib/server/admin-helpers';

export async function refreshNowShowing() {
  const admin = await requireAdmin('content');
  const result = await refreshListings();
  logActivity(admin, `Refreshed now-showing listings (${result.ok ? 'succeeded' : 'failed'})`);
  if (!result.ok) back('/admin/now-showing', {error: 'District could not be refreshed. Details: ' + (result.output.trim().split('\n').pop() || 'no output')});
  back('/admin/now-showing', {notice: 'refreshed'});
}

export async function saveMovieOverride(formData: FormData) {
  const admin = await requireAdmin('content');
  const id = String(formData.get('movie') ?? '');
  if (!/^[\w.\- ]{1,120}$/.test(id)) back('/admin/now-showing', {error: 'Unknown movie.'});
  const overrides = readOverrides();
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
  saveOverrides(overrides);
  logActivity(admin, `Updated now-showing listing “${title || original}”${hidden ? ' (hidden)' : ''}`);
  back(`/admin/now-showing#${encodeURIComponent(id)}`);
}
