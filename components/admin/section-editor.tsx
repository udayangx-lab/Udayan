'use client';

import {createContext, startTransition, useActionState, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowUp, ExternalLink, ImagePlus, Images, LoaderCircle, Plus, Trash2} from 'lucide-react';
import {iconOptions, type ListField, type SchemaField, type Section} from '@/lib/content-schema';
import type {SectionState} from '@/app/admin/content-actions';

type Row = Record<string, string>;

import {limited, uploadImage as upload} from './upload';

const Uploads = createContext<(delta: number) => void>(() => {});

export default function SectionEditor({section, values, action}: {section: Section; values: Record<string, unknown>; action: (previous: SectionState, formData: FormData) => Promise<SectionState>}) {
  const [state, save, pending] = useActionState(action, {});
  const [uploading, setUploading] = useState(0);
  const track = useCallback((delta: number) => setUploading(count => count + delta), []);
  // Submitting manually skips React's automatic form reset, so a failed save keeps every edit.
  return <Uploads.Provider value={track}><form className="admin-panel admin-form admin-section-form" onSubmit={event => {
    event.preventDefault();
    if (uploading) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => save(data));
  }}>
    {state.error && <p className="admin-notice error" role="alert">{state.error}</p>}
    {!state.error && state.saved && <p className="admin-notice" role="status">Changes saved. The website has been updated.</p>}
    {/* Remount with the stored values after each successful save. */}
    <div key={JSON.stringify(values)} className="admin-form">
      {section.fields.map(field => field.kind === 'list'
        ? <ListEditor key={field.name} field={field} rows={Array.isArray(values[field.name]) ? values[field.name] as Row[] : []}/>
        : <FieldInput key={field.name} field={field} name={field.name} value={String(values[field.name] ?? '')}/>)}
    </div>
    <div className="admin-actions admin-sticky-actions">
      <button type="submit" className="admin-button primary" disabled={pending || uploading > 0}>
        {uploading ? `Uploading ${uploading} ${uploading === 1 ? 'photo' : 'photos'}…` : pending ? 'Saving…' : 'Save changes'}</button>
      <a className="admin-button" href={section.preview} target="_blank" rel="noreferrer">View page<ExternalLink size={14}/></a>
    </div>
  </form></Uploads.Provider>;
}

function FieldInput({field, name, value, file}: {field: SchemaField; name: string; value: string; file?: File}) {
  const hint = field.hint && <small>{field.hint}</small>;
  if (field.kind === 'image') return <ImageInput field={field} name={name} value={value} file={file}/>;
  if (field.kind === 'icon') return <label>{field.label}<select name={name} defaultValue={value} required>
    {Object.entries(iconOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{hint}</label>;
  if (field.kind === 'textarea' || field.kind === 'heading') return <label>{field.label}{field.optional && <em className="admin-optional">Optional</em>}
    <textarea name={name} defaultValue={value} rows={field.rows ?? 4} maxLength={field.max} required={!field.optional}/>{hint}</label>;
  return <label>{field.label}{field.optional && <em className="admin-optional">Optional</em>}
    <input name={name} defaultValue={value} maxLength={field.kind === 'year' ? 4 : field.max} required={!field.optional}
      inputMode={field.kind === 'year' ? 'numeric' : undefined} pattern={field.kind === 'year' ? '\\d{4}' : undefined}/>{hint}</label>;
}

function ImageInput({field, name, value, file}: {field: SchemaField; name: string; value: string; file?: File}) {
  const track = useContext(Uploads);
  const [path, setPath] = useState(value);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<{busy: boolean; error?: string}>({busy: false});
  useEffect(() => () => {if (preview) URL.revokeObjectURL(preview);}, [preview]);
  const choose = useCallback((chosen: File) => {
    setPreview(URL.createObjectURL(chosen));
    setStatus({busy: true});
    track(1);
    limited(() => upload(chosen))
      .then(saved => {setPath(saved); setStatus({busy: false});})
      .catch((error: Error) => {setPath(value); setPreview(null); setStatus({busy: false, error: error.message});})
      .finally(() => track(-1));
  }, [track, value]);
  // Rows created by “Add several” arrive with their file already chosen.
  const started = useRef(false);
  useEffect(() => {if (file && !started.current) {started.current = true; choose(file);}}, [file, choose]);
  return <div className={`admin-image-field${status.error ? ' failed' : ''}`}>
    <span className="admin-image-preview">
      {preview || path ? <img src={preview || path} alt=""/> : <span className="admin-image-empty"><ImagePlus size={20}/></span>}
      {status.busy && <span className="admin-image-busy"><LoaderCircle size={20}/></span>}
    </span>
    <label>{field.label}<input type="file" accept="image/jpeg,image/png,image/webp" required={!path && !field.optional && !status.busy}
      onChange={event => {const chosen = event.target.files?.[0]; if (chosen) choose(chosen);}}/>
      {status.error ? <small className="admin-field-error" role="alert">{status.error}</small>
        : <small>{status.busy ? 'Uploading…' : `${field.hint ? field.hint + ' ' : ''}${path ? 'Choose a file to replace it. ' : ''}JPG, PNG, or WebP up to 3 MB.`}</small>}</label>
    <input type="hidden" name={name} value={path}/>
  </div>;
}

function ListEditor({field, rows: initial}: {field: ListField; rows: Row[]}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(row => ({...row, id: row.id || crypto.randomUUID()})));
  const [files, setFiles] = useState<Record<string, File>>({});
  const imageField = field.fields.find(item => item.kind === 'image');
  const move = (index: number, offset: number) => setRows(list => {
    const next = [...list];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    return next;
  });
  const blank = (position: number): Row => Object.fromEntries([['id', crypto.randomUUID()], ...field.fields.map(item => [item.name,
    item.kind === 'icon' ? Object.keys(iconOptions)[0] : item.kind === 'image' ? '' : imageField && item.kind === 'text' ? `${field.itemLabel} ${position}` : ''])]);
  function addMany(chosen: File[]) {
    const room = field.max - rows.length;
    const sorted = [...chosen].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true})).slice(0, room);
    const created = sorted.map((file, index) => ({row: blank(rows.length + index + 1), file}));
    setRows(list => [...list, ...created.map(item => item.row)]);
    setFiles(map => ({...map, ...Object.fromEntries(created.map(item => [item.row.id, item.file]))}));
  }
  const plural = field.itemLabel.toLowerCase() + 's';
  return <fieldset className="admin-list">
    <legend>{field.label}<span>{rows.length} of up to {field.max}</span></legend>
    {field.hint && <small>{field.hint}</small>}
    <ol>{rows.map((row, index) => <li key={row.id}>
      <input type="hidden" name={`${field.name}.__id`} value={row.id}/>
      <div className="admin-list-head"><strong>{field.itemLabel} {index + 1}</strong>
        <div className="admin-row-tools">
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${field.itemLabel.toLowerCase()} ${index + 1} up`}><ArrowUp size={16}/></button>
          <button type="button" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${field.itemLabel.toLowerCase()} ${index + 1} down`}><ArrowDown size={16}/></button>
          <button type="button" disabled={rows.length <= (field.min ?? 0)} onClick={() => setRows(list => list.filter(item => item.id !== row.id))} aria-label={`Remove ${field.itemLabel.toLowerCase()} ${index + 1}`}><Trash2 size={16}/></button>
        </div>
      </div>
      <div className="admin-list-fields">{field.fields.map(item => <FieldInput key={item.name} field={item} name={`${field.name}.${item.name}`} value={row[item.name] ?? ''}
        file={item.kind === 'image' ? files[row.id] : undefined}/>)}</div>
    </li>)}</ol>
    {rows.length < field.max && <div className="admin-list-add">
      <button type="button" className="admin-button small" onClick={() => setRows(list => [...list, blank(list.length + 1)])}><Plus size={15}/>Add {field.itemLabel.toLowerCase()}</button>
      {imageField && <label className="admin-button small"><Images size={15}/>Add several {plural}
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only"
          onChange={event => {if (event.target.files?.length) addMany([...event.target.files]); event.target.value = '';}}/></label>}
    </div>}
  </fieldset>;
}
