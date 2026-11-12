import type {Metadata} from 'next';
import {CircleAlert, CircleCheck, RefreshCw} from 'lucide-react';
import {requireAdmin} from '@/lib/server/auth';
import {readContent} from '@/lib/server/content';
import {readUpcoming, readUpcomingSettings} from '@/lib/server/listings';
import {buildComingSoon, languageMatch} from '@/lib/coming-soon';
import {dateLabel, indiaDate} from '@/lib/listings';
import {formatDate} from '@/components/admin/submission-table';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import UpcomingEditor from '@/components/admin/upcoming-editor';
import {saveUpcoming} from '../../actions';
import {refreshComingSoon, saveComingSoonRules, saveComingSoonVisibility} from '../../listings-actions';

export const metadata: Metadata = {title: 'Coming soon'};

export default async function ComingSoon({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await requireAdmin('content');
  const [{upcoming}, district, settings] = await Promise.all([readContent(), readUpcoming(), readUpcomingSettings()]);
  const today = indiaDate();
  const films = district?.films || [];
  const shown = buildComingSoon({curated: upcoming, district: films, settings, today});
  const horizon = new Date(Date.parse(today + 'T00:00:00Z') + settings.windowDays * 864e5).toISOString().slice(0, 10);
  // The titles an admin may want to hide: District releases that pass the language and date rules, plus hidden ones.
  const candidates = films.filter(film => film.releaseDate && film.releaseDate >= today && film.releaseDate <= horizon && (languageMatch(film, settings.languages).length || settings.hidden.includes(film.id)))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  const languages = [...new Set([...settings.languages, ...films.flatMap(film => film.languages)])].sort();
  const healthy = district?.status === 'success';
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">WEBSITE</span><h1>Coming soon</h1>
      <p className="admin-subtitle">The “Coming soon” tab combines District’s upcoming releases for Kolkata with titles you add yourself. A title leaves the list on its release date, and disappears from a cinema’s list as soon as that cinema opens bookings for it.</p></div>
      <form action={refreshComingSoon}><SubmitButton pending="Refreshing from District…"><RefreshCw size={15}/>Refresh now</SubmitButton></form></header>
    <Notice searchParams={searchParams}/>
    <div className={`admin-callout${healthy ? '' : ' warning'}`}>{healthy ? <CircleCheck size={20}/> : <CircleAlert size={20}/>}<div>
      <strong>{shown.length} titles on the website · {films.length} upcoming releases on District</strong>
      <p>{district?.lastSuccessAt ? `Last read from District ${formatDate(district.lastSuccessAt)} IST.` : 'Not read from District yet. Use Refresh now.'}
        {district?.error ? ` The last attempt failed (${district.error}); the previous list is still used.` : ''} District’s list covers all of India, so only the languages and dates below are shown.</p></div></div>

    <form action={saveComingSoonRules} className="admin-panel admin-form" id="rules">
      <div className="admin-panel-head"><h2>Which releases to show</h2></div>
      <p className="admin-footnote">A film is shown when its original language (listed first on District) is one you choose, so Hindi dubs of South Indian films stay out. Any film with a Bengali or English version is shown when that language is chosen.</p>
      <fieldset className="admin-languages"><legend className="sr-only">Languages</legend>{languages.map(language => <label key={language} className="admin-check"><input type="checkbox" name="language" value={language} defaultChecked={settings.languages.includes(language)}/>{language}</label>)}</fieldset>
      <label>Show releases up to this many days ahead<input type="number" name="windowDays" min={7} max={180} defaultValue={settings.windowDays} required/></label>
      <div className="admin-actions"><SubmitButton>Save rules</SubmitButton></div>
    </form>

    <form action={saveComingSoonVisibility} className="admin-panel admin-form" id="district">
      <div className="admin-panel-head"><h2>District releases ({candidates.length})</h2></div>
      <p className="admin-footnote">Releasing between {dateLabel(today)} and {dateLabel(horizon)} in the chosen languages. Tick a title to hide it, for example a dub District lists under the wrong language.</p>
      {!candidates.length && <p className="admin-empty">No District releases match these rules yet.</p>}
      <div className="admin-district">{candidates.map(film => {
        const hidden = settings.hidden.includes(film.id);
        return <div key={film.id} className={`admin-district-film${hidden ? ' hidden' : ''}`}>
          <input type="hidden" name="film" value={film.id}/>
          {film.poster ? <img src={film.poster} alt="" loading="lazy"/> : <span/>}
          <div><strong>{film.title}</strong><small>{dateLabel(film.releaseDate)} · {film.languages.join(', ')}{film.censor ? ` · ${film.censor}` : ''}</small></div>
          <label className="admin-check"><input type="checkbox" name="hidden" value={film.id} defaultChecked={hidden}/>Hide</label>
        </div>;
      })}</div>
      {candidates.length > 0 && <div className="admin-actions"><SubmitButton>Save hidden titles</SubmitButton></div>}
    </form>

    <section id="curated">
      <div className="admin-panel-head"><h2>Your own titles</h2></div>
      <p className="admin-footnote">Add titles District doesn’t list yet, or a special screening. They are always shown (and replace a District entry with the same title) until their release date has passed. Without a poster, District’s poster for the same title is used when available.</p>
      <UpcomingEditor key={JSON.stringify(upcoming)} movies={upcoming} action={saveUpcoming}/>
    </section>
  </>;
}
