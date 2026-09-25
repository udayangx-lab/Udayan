'use server';

import {after} from 'next/server';
import {formDefinitions, isFormType, validateSubmission, type FormState, type SubmissionValues} from '@/lib/forms';
import {readContent} from '@/lib/server/content';
import {createSubmission} from '@/lib/server/submissions';
import {notifyAdmins, sendAutoReply} from '@/lib/server/email';
import {saveDocument, type Attachment} from '@/lib/server/uploads';
import {allow, clientAddress} from '@/lib/server/rate-limit';

// Values echoed back after a failed submission so the visitor does not retype them.
function echo(formData: FormData): SubmissionValues {
  const values: SubmissionValues = {};
  for (const [key, value] of formData) {
    if (typeof value !== 'string' || key.startsWith('$') || key === 'website' || key === 'startedAt') continue;
    const previous = values[key];
    values[key] = previous === undefined ? value : ([] as string[]).concat(previous, value);
  }
  return values;
}

export async function submitForm(type: string, _previous: FormState, formData: FormData): Promise<FormState> {
  if (!isFormType(type)) return {status: 'error', message: 'This form is not available.'};
  const definition = formDefinitions[type];
  // Bots fill the hidden field or submit instantly. Pretend success so they do not retry.
  const started = Number(formData.get('startedAt'));
  if (formData.get('website') || (started && Date.now() - started < 2000)) return {status: 'success', reference: ''};
  if (!allow(`form:${type}:${await clientAddress()}`, 5, 10 * 60 * 1000)) {
    return {status: 'error', message: 'Too many submissions from this connection. Please try again in a few minutes.', values: echo(formData)};
  }

  const content = readContent();
  const {values, errors} = validateSubmission(type, formData, content.cinemas.map(cinema => cinema.id), content.formOptions);
  const fileField = definition.fields.find(field => field.type === 'file');
  const file = fileField ? formData.get(fileField.name) : null;
  const hasFile = file instanceof File && file.size > 0;
  if (fileField?.required && !hasFile) errors[fileField.name] = 'Please attach your CV.';
  if (Object.keys(errors).length) return {status: 'error', message: 'Please check the highlighted fields.', errors, values: echo(formData)};

  let attachment: Attachment | null = null;
  if (fileField && hasFile) {
    const saved = await saveDocument(file);
    if ('error' in saved) return {status: 'error', message: 'Please check the highlighted fields.', errors: {[fileField.name]: saved.error}, values: echo(formData)};
    attachment = saved;
  }
  const submission = createSubmission(type, values, attachment);
  // The record is safe in the admin panel; email delivery happens after the visitor sees confirmation.
  after(async () => {await notifyAdmins(submission); await sendAutoReply(submission);});
  return {status: 'success', reference: submission.reference};
}
