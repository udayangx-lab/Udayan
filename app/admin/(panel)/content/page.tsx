import type {Metadata} from 'next';
import Link from 'next/link';
import {ChevronRight} from 'lucide-react';
import {requireAdmin} from '@/lib/server/auth';
import {sections} from '@/lib/content-schema';
import Notice from '@/components/admin/notice';

export const metadata: Metadata = {title: 'Pages & photos'};

export default async function ContentHub({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await requireAdmin('content');
  const groups = [...new Set(sections.map(section => section.group))];
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">WEBSITE</span><h1>Pages & photos</h1>
      <p className="admin-subtitle">Edit the text and photos across the website. Changes appear as soon as you save.</p></div></header>
    <Notice searchParams={searchParams}/>
    {groups.map(group => <section key={group} className="admin-panel">
      <div className="admin-panel-head"><h2>{group}</h2></div>
      <ul className="admin-section-list">{sections.filter(section => section.group === group).map(section =>
        <li key={section.id}><Link href={`/admin/content/${section.id}`}><span><strong>{section.title}</strong><small>{section.description}</small></span><ChevronRight size={18}/></Link></li>)}</ul>
    </section>)}
    <p className="admin-footnote">The advertising brochure and the Hooghly River book are fixed page images from the original collections. Replacing them requires new page files.</p>
  </>;
}
