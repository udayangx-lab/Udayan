'use client';

import {useActionState, useEffect, useId, useRef, useState} from 'react';
import {ArrowUpRight, CircleCheck} from 'lucide-react';
import {submitForm} from '@/lib/actions/submit-form';
import {documentTypes, fieldOptions, formDefinitions, ratingLabels, allCinemasValue, type FormField, type FormOptions, type FormState, type FormType} from '@/lib/forms';
import type {Cinema} from '@/lib/data';
import {useSiteContent} from './site-content';

const initial: FormState = {status: 'idle'};

export default function SiteForm({type}: {type: FormType}) {
  const [attempt, setAttempt] = useState(0);
  return <FormBody key={attempt} type={type} onReset={() => setAttempt(value => value + 1)}/>;
}

function FormBody({type, onReset}: {type: FormType; onReset: () => void}) {
  const definition = formDefinitions[type];
  const {cinemas, formOptions} = useSiteContent();
  const [state, action, pending] = useActionState(submitForm.bind(null, type), initial);
  // Remount the fields after each response so they pick up the echoed values instead of React's form reset.
  const [seen, setSeen] = useState(state);
  const [version, setVersion] = useState(0);
  if (seen !== state) {setSeen(state); setVersion(value => value + 1);}
  const [startedAt, setStartedAt] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLDivElement>(null);
  const id = useId();
  // Measured from first load, not from each retry, so quick corrections are never mistaken for a bot.
  useEffect(() => setStartedAt(String(Date.now())), []);
  useEffect(() => {
    if (state.status === 'success') success.current?.focus();
    if (state.status === 'error') (form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') || form.current?.querySelector<HTMLElement>('.form-alert'))?.focus();
  }, [state]);

  if (state.status === 'success') return <div className="form-success" ref={success} tabIndex={-1} role="status">
    <CircleCheck size={34} aria-hidden="true"/>
    <h3>{definition.successTitle}</h3>
    <p>{definition.successMessage}</p>
    {state.reference && <p className="form-reference">Your reference: <strong>{state.reference}</strong></p>}
    <button type="button" className="text-link" onClick={onReset}>Send another response<ArrowUpRight size={16}/></button>
  </div>;

  return <form key={version} ref={form} className="site-form" action={action} noValidate>
    {state.status === 'error' && state.message && <p className="form-alert" role="alert" tabIndex={-1}>{state.message}</p>}
    <div className="form-grid">
      {definition.fields.map(field => <Field key={field.name} field={field} id={`${id}-${field.name}`} cinemas={cinemas} options={formOptions}
        error={state.errors?.[field.name]} value={state.values?.[field.name]}/>)}
    </div>
    {/* Spam checks: a field people never see, and the time the form was opened. */}
    <div className="form-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
    <input type="hidden" name="startedAt" value={startedAt}/>
    <div className="form-submit">
      <button type="submit" className="button red" disabled={pending}>{pending ? 'Sending…' : definition.submitLabel}<ArrowUpRight size={18}/></button>
      <p>Fields marked <span aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required. Your details are only used to respond to this request.</p>
    </div>
  </form>;
}

function Field({field, id, error, value, cinemas, options: edited}: {field: FormField; id: string; error?: string; value?: string | string[]; cinemas: Cinema[]; options: FormOptions}) {
  const choices = fieldOptions(field, edited);
  const describedBy = [field.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const common = {id, name: field.name, required: field.required, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy};
  const single = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const label = <>{field.label}{field.required && <span className="form-required" aria-hidden="true"> *</span>}</>;
  const help = <>
    {field.hint && <span className="form-hint" id={`${id}-hint`}>{field.hint}</span>}
    {error && <span className="form-error" id={`${id}-error`}>{error}</span>}
  </>;

  if (field.type === 'checkboxes' || field.type === 'rating') {
    const options = field.type === 'rating' ? ratingLabels.map((text, index) => ({value: String(index + 1), text})) : choices.map(text => ({value: text, text}));
    return <fieldset className={`form-field ${field.type === 'rating' ? 'form-rating' : 'form-checkboxes'}${field.wide ? ' wide' : ''}`} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend>{label}</legend>
      <div>{options.map(option => <label key={option.value}>
        <input type={field.type === 'rating' ? 'radio' : 'checkbox'} name={field.name} value={option.value} defaultChecked={list.includes(option.value)}/>
        <span>{field.type === 'rating' && <b>{option.value}</b>}{option.text}</span>
      </label>)}</div>
      {help}
    </fieldset>;
  }

  let control;
  if (field.type === 'textarea') control = <textarea {...common} rows={5} maxLength={3000} placeholder={field.placeholder} defaultValue={single}/>;
  else if (field.type === 'select' || field.type === 'cinema') {
    const options = field.type === 'cinema'
      ? [...cinemas.map(cinema => ({value: cinema.id, text: cinema.name})), ...(field.allCinemas ? [{value: allCinemasValue, text: field.allCinemas}] : [])]
      : choices.map(text => ({value: text, text}));
    control = <select {...common} defaultValue={single}><option value="">Choose…</option>{options.map(option => <option key={option.value} value={option.value}>{option.text}</option>)}</select>;
  } else if (field.type === 'file') control = <input {...common} type="file" accept={documentTypes}/>;
  else control = <input {...common} type={field.type} defaultValue={single} placeholder={field.placeholder} autoComplete={field.autoComplete}
    inputMode={field.type === 'tel' ? 'tel' : field.type === 'number' ? 'numeric' : undefined} maxLength={field.type === 'number' || field.type === 'date' ? undefined : 160}
    min={field.min} max={field.max}/>;
  return <div className={`form-field${field.wide ? ' wide' : ''}`}><label htmlFor={id}>{label}</label>{control}{help}</div>;
}
