'use server';

import {requireAdmin} from '@/lib/server/auth';
import {saveContentAt} from '@/lib/server/content';
import {saveImage} from '@/lib/server/uploads';
import {logActivity} from '@/lib/server/activity';
import {refreshSite} from '@/lib/server/admin-helpers';
import {findSection, readSection} from '@/lib/content-schema';

export type SectionState = {error?: string; saved?: number};

// Returns errors instead of redirecting, so the editor keeps everything the admin typed.
export async function saveSection(sectionId: string, _previous: SectionState, formData: FormData): Promise<SectionState> {
  const admin = await requireAdmin('content');
  const section = findSection(sectionId);
  if (!section) return {error: 'That section does not exist.'};
  const {values, errors, uploads} = readSection(section, formData);
  if (errors.length) return {error: errors.slice(0, 4).join(' ')};
  for (const upload of uploads) {
    const saved = await saveImage(upload.file);
    if ('error' in saved) return {error: `${upload.file.name}: ${saved.error}`};
    upload.assign(saved.path);
  }
  saveContentAt(section.path, values);
  logActivity(admin, `Edited ${section.group} · ${section.title}`);
  refreshSite();
  return {saved: Date.now()};
}
