import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/server/auth';
import {readContent} from '@/lib/server/content';
import Notice from '@/components/admin/notice';
import UpcomingEditor from '@/components/admin/upcoming-editor';
import {saveUpcoming} from '../../actions';

export const metadata: Metadata = {title: 'Coming soon'};

export default async function ComingSoon({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await requireAdmin('content');
  const {upcoming} = readContent();
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">WEBSITE</span><h1>Coming soon</h1>
      <p className="admin-subtitle">The “Coming soon” tab on the home and movies pages. Now-showing titles and showtimes update automatically from District.</p></div></header>
    <Notice searchParams={searchParams}/>
    <UpcomingEditor key={JSON.stringify(upcoming)} movies={upcoming} action={saveUpcoming}/>
  </>;
}
