'use client';

import {useState} from 'react';
import {ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Plus, Trash2} from 'lucide-react';
import type {UpcomingMovie} from '@/lib/data';
import {SubmitButton} from './controls';
import {limited, uploadImage} from './upload';

type Row = UpcomingMovie & {busy?: boolean; error?: string};

export default function UpcomingEditor({movies, action}: {movies: UpcomingMovie[]; action: (formData: FormData) => Promise<void>}) {
  const [rows, setRows] = useState<Row[]>(movies);
  const update = (id: string, changes: Partial<Row>) => setRows(list => list.map(item => item.id === id ? {...item, ...changes} : item));
  const move = (index: number, offset: number) => setRows(list => {
    const next = [...list];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    return next;
  });
  const uploading = rows.some(row => row.busy);
  return <form action={action} className="admin-panel admin-form">
    <div className="admin-panel-head"><h2>{rows.length} {rows.length === 1 ? 'movie' : 'movies'}</h2>
      <button type="button" className="admin-button small" onClick={() => setRows(list => [...list, {id: crypto.randomUUID(), title: '', poster: ''}])}><Plus size={15}/>Add movie</button></div>
    <ol className="admin-posters">{rows.map((row, index) => <li key={row.id}>
      <input type="hidden" name="id" value={row.id}/><input type="hidden" name="poster" value={row.poster}/>
      <label className="admin-poster">{row.poster ? <img src={row.poster} alt=""/> : <span><ImagePlus size={22}/>Poster</span>}
        {row.busy && <span className="admin-image-busy"><LoaderCircle size={20}/></span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" required={!row.poster} aria-label={`Poster for movie ${index + 1}`}
          onChange={event => {
            const file = event.target.files?.[0];
            if (!file) return;
            update(row.id, {busy: true, error: undefined});
            limited(() => uploadImage(file)).then(poster => update(row.id, {poster, busy: false}), (error: Error) => update(row.id, {busy: false, error: error.message}));
          }}/></label>
      <div className="admin-poster-fields">
        <label>Title<input name="title" defaultValue={row.title} required maxLength={120}/></label>
        {row.error ? <small className="admin-field-error" role="alert">{row.error}</small>
          : <small>{row.busy ? 'Uploading…' : row.poster ? 'Click the poster to replace it. JPG, PNG, or WebP up to 3 MB.' : 'Click the box to add a poster. JPG, PNG, or WebP up to 3 MB.'}</small>}
      </div>
      <div className="admin-row-tools">
        <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp size={16}/></button>
        <button type="button" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown size={16}/></button>
        <button type="button" onClick={() => setRows(list => list.filter(item => item.id !== row.id))} aria-label={`Remove ${row.title || 'movie'}`}><Trash2 size={16}/></button>
      </div>
    </li>)}</ol>
    <div className="admin-actions">{uploading
      ? <button type="button" className="admin-button primary" disabled>Uploading posters…</button>
      : <SubmitButton pending="Saving…">Save coming soon list</SubmitButton>}</div>
  </form>;
}
