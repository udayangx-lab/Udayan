'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowUp, ImagePlus, Plus, Trash2} from 'lucide-react';
import type {UpcomingMovie} from '@/lib/data';
import {SubmitButton} from './controls';

type Row = UpcomingMovie & {preview?: string};

export default function UpcomingEditor({movies, action}: {movies: UpcomingMovie[]; action: (formData: FormData) => Promise<void>}) {
  const [rows, setRows] = useState<Row[]>(movies);
  const previews = useRef(new Set<string>());
  useEffect(() => () => previews.current.forEach(url => URL.revokeObjectURL(url)), []);
  const move = (index: number, offset: number) => setRows(list => {
    const next = [...list];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    return next;
  });
  return <form action={action} className="admin-panel admin-form">
    <div className="admin-panel-head"><h2>{rows.length} {rows.length === 1 ? 'movie' : 'movies'}</h2>
      <button type="button" className="admin-button small" onClick={() => setRows(list => [...list, {id: crypto.randomUUID(), title: '', poster: ''}])}><Plus size={15}/>Add movie</button></div>
    <ol className="admin-posters">{rows.map((row, index) => <li key={row.id}>
      <input type="hidden" name="id" value={row.id}/><input type="hidden" name="poster" value={row.poster}/>
      <label className="admin-poster">{row.preview || row.poster ? <img src={row.preview || row.poster} alt=""/> : <span><ImagePlus size={22}/>Poster</span>}
        <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required={!row.poster} aria-label={`Poster for movie ${index + 1}`}
          onChange={event => {const file = event.target.files?.[0]; const preview = file ? URL.createObjectURL(file) : undefined; if (preview) previews.current.add(preview); setRows(list => list.map(item => item.id === row.id ? {...item, preview} : item));}}/></label>
      <div className="admin-poster-fields">
        <label>Title<input name="title" defaultValue={row.title} required maxLength={120}/></label>
        <small>{row.poster || row.preview ? 'Click the poster to replace it. JPG, PNG, or WebP up to 3 MB.' : 'Click the box to add a poster. JPG, PNG, or WebP up to 3 MB.'}</small>
      </div>
      <div className="admin-row-tools">
        <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp size={16}/></button>
        <button type="button" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown size={16}/></button>
        <button type="button" onClick={() => setRows(list => list.filter(item => item.id !== row.id))} aria-label={`Remove ${row.title || 'movie'}`}><Trash2 size={16}/></button>
      </div>
    </li>)}</ol>
    <div className="admin-actions"><SubmitButton pending="Saving and uploading…">Save coming soon list</SubmitButton></div>
  </form>;
}
