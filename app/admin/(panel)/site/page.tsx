import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/server/auth';
import {readContent} from '@/lib/server/content';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import {saveSiteDetails} from '../../actions';

export const metadata: Metadata = {title: 'Site details'};

export default async function SiteDetails({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await requireAdmin('content');
  const content = await readContent();
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">WEBSITE</span><h1>Site details</h1>
      <p className="admin-subtitle">Shown in the header, footer, and contact page.</p></div></header>
    <Notice searchParams={searchParams}/>
    <form action={saveSiteDetails} className="admin-panel admin-form wide">
      <label>Announcement bar<input name="announcement" defaultValue={content.announcement} maxLength={90} required/>
        <small>The red strip above the header. Keep it short. It is shown in capitals.</small></label>
      <label>Public contact email<input type="email" name="contactEmail" defaultValue={content.contactEmail} required/>
        <small>Shown in the footer, contact page, and feedback page.</small></label>
      <label>Facebook page<input type="url" name="facebook" defaultValue={content.facebook} placeholder="https://www.facebook.com/…"/></label>
      <div className="admin-actions"><SubmitButton>Save site details</SubmitButton></div>
    </form>
  </>;
}
