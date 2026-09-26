import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/server/auth';
import {readContent} from '@/lib/server/content';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import {saveCinema} from '../../actions';

export const metadata: Metadata = {title: 'Cinemas'};

export default async function Cinemas({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await requireAdmin('content');
  const {cinemas} = await readContent();
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">WEBSITE</span><h1>Cinemas</h1>
      <p className="admin-subtitle">Used across the site: the cinema picker, contact cards, footer, booking links, and nearest-cinema detection.</p></div></header>
    <Notice searchParams={searchParams}/>
    {cinemas.map(cinema => <form key={cinema.id} id={cinema.id} action={saveCinema} className="admin-panel admin-form admin-grid-form">
      <input type="hidden" name="id" value={cinema.id}/>
      <h2 className="span">Udayan {cinema.name}</h2>
      <div className="admin-image-field span"><img src={cinema.image} alt=""/><label>Photo on the home page<input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp"/><small>Optional. Upload a JPG, PNG, or WebP up to 3 MB to replace it.</small></label></div>
      <label>Name<input name="name" defaultValue={cinema.name} required maxLength={60}/></label>
      <label>Short location line<input name="tagline" defaultValue={cinema.tagline} maxLength={60}/><small>Shown in the cinema picker, e.g. “Silvision Mall”.</small></label>
      <label>Phone<input type="tel" name="phone" defaultValue={cinema.phone} required/></label>
      <label>Entertaining since<input name="since" defaultValue={cinema.since} required inputMode="numeric" pattern="\d{4}" maxLength={4}/></label>
      <label className="span">Address<textarea name="address" defaultValue={cinema.address} rows={2} required maxLength={300}/></label>
      <label className="span">Parking<input name="parking" defaultValue={cinema.parking} maxLength={80}/></label>
      <label className="span">Google Maps link<input type="url" name="maps" defaultValue={cinema.maps} required/></label>
      <label className="span">BookMyShow link<input type="url" name="booking" defaultValue={cinema.booking} required/><small>The venue page. The selected date is appended automatically.</small></label>
      <label className="span">District link<input type="url" name="district" defaultValue={cinema.district} required/><small>Changing this does not change where live showtimes are read from.</small></label>
      <label>Latitude<input name="latitude" defaultValue={cinema.coordinates.latitude} required inputMode="decimal"/></label>
      <label>Longitude<input name="longitude" defaultValue={cinema.coordinates.longitude} required inputMode="decimal"/></label>
      <div className="admin-actions span"><SubmitButton>Save {cinema.name}</SubmitButton></div>
    </form>)}
  </>;
}
