import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {requireAdmin} from '@/lib/server/auth';
import {readContent} from '@/lib/server/content';
import {findSection, sectionValues} from '@/lib/content-schema';
import Notice from '@/components/admin/notice';
import SectionEditor from '@/components/admin/section-editor';
import {saveSection} from '../../../content-actions';

type Props = {params: Promise<{section: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>};
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const section = findSection((await params).section);
  return {title: section ? `${section.group} · ${section.title}` : 'Content'};
}

export default async function EditSection({params, searchParams}: Props) {
  await requireAdmin('content');
  const section = findSection((await params).section);
  if (!section) notFound();
  const values = sectionValues(section, readContent());
  return <>
    <Link href="/admin/content" className="admin-link back"><ArrowLeft size={15}/>Pages & photos</Link>
    <header className="admin-header"><div><span className="admin-eyebrow">{section.group.toUpperCase()}</span><h1>{section.title}</h1>
      <p className="admin-subtitle">{section.description}</p></div></header>
    <Notice searchParams={searchParams}/>
    <SectionEditor section={section} values={values} action={saveSection.bind(null, section.id)}/>
  </>;
}
