// One definition per form drives the public form, server validation, emails, and the admin panel.
// Keep this module free of runtime imports so Node's test runner can load it directly.
export type FormType = 'contact' | 'advertising' | 'cafe' | 'career' | 'feedback';
export type FieldType = 'text' | 'tel' | 'email' | 'textarea' | 'select' | 'cinema' | 'date' | 'number' | 'checkboxes' | 'rating' | 'file';
export type FormField = {
  name: string; label: string; type: FieldType; required?: boolean; placeholder?: string; hint?: string;
  options?: string[]; wide?: boolean; autoComplete?: string; allCinemas?: string; min?: number; max?: number;
  /** Choices editable in the admin panel, stored under content.formOptions[optionsKey]. `options` is the fallback. */
  optionsKey?: 'contactTopic' | 'advertisingFormats' | 'cafeEnquiry';
};
export type FormOptions = Partial<Record<NonNullable<FormField['optionsKey']>, {label: string}[]>>;
/** The choices currently offered for a select or checkbox field. */
export function fieldOptions(field: FormField, options: FormOptions = {}) {
  const edited = field.optionsKey && options[field.optionsKey]?.map(choice => choice.label).filter(Boolean);
  return edited?.length ? edited : field.options || [];
}
export type FormDefinition = {
  type: FormType; label: string; noun: string; page: string; submitLabel: string; successTitle: string; successMessage: string; fields: FormField[];
};
export type SubmissionValues = Record<string, string | string[]>;
export type FormState = {
  status: 'idle' | 'error' | 'success'; message?: string; errors?: Record<string, string>; values?: SubmissionValues; reference?: string;
};

export const ratingLabels = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
export const allCinemasValue = 'all';
export const documentTypes = '.pdf,.doc,.docx';
export const maxDocumentBytes = 5 * 1024 * 1024;

const name: FormField = {name: 'name', label: 'Your name', type: 'text', required: true, autoComplete: 'name', placeholder: 'Full name'};
const phone: FormField = {name: 'phone', label: 'Mobile number', type: 'tel', required: true, autoComplete: 'tel-national', placeholder: '10-digit mobile number'};
const email: FormField = {name: 'email', label: 'Email address', type: 'email', autoComplete: 'email', placeholder: 'you@example.com'};

export const formDefinitions: Record<FormType, FormDefinition> = {
  contact: {
    type: 'contact', label: 'Contact enquiries', noun: 'message', page: '/contact', submitLabel: 'Send message',
    successTitle: 'Message received.', successMessage: 'Thank you for getting in touch. Our team will reply as soon as possible.',
    fields: [name, phone, email,
      {name: 'cinema', label: 'Cinema', type: 'cinema', required: true, allCinemas: 'Either cinema'},
      {name: 'topic', label: 'How can we help?', type: 'select', required: true, optionsKey: 'contactTopic', options: ['General enquiry', 'Help with a booking', 'Group visit', 'Something else']},
      {name: 'message', label: 'Message', type: 'textarea', required: true, wide: true, placeholder: 'Tell us a little more'},
    ],
  },
  advertising: {
    type: 'advertising', label: 'Advertising enquiries', noun: 'advertising enquiry', page: '/advertisement', submitLabel: 'Send enquiry',
    successTitle: 'Enquiry received.', successMessage: 'Thank you for your interest in advertising at Udayan. Our team will contact you to discuss formats, availability, and rates.',
    fields: [name,
      {name: 'company', label: 'Company or brand', type: 'text', required: true, autoComplete: 'organization'},
      phone, {...email, required: true},
      {name: 'cinema', label: 'Preferred cinema', type: 'cinema', required: true, allCinemas: 'Both cinemas'},
      {name: 'campaign', label: 'Campaign dates', type: 'text', placeholder: 'e.g. November–December 2026'},
      {name: 'formats', label: 'Formats you’re interested in', type: 'checkboxes', wide: true, optionsKey: 'advertisingFormats',
        options: ['On-screen advertising', 'Seat branding', 'Entrance branding', 'Standees', 'Backlit posters', 'Digital displays', 'Pamphlet distribution']},
      {name: 'message', label: 'Campaign details', type: 'textarea', wide: true, placeholder: 'Objectives, budget range, or anything we should know'},
    ],
  },
  cafe: {
    type: 'cafe', label: 'DPD Café enquiries', noun: 'DPD Café enquiry', page: '/dpd-cafe', submitLabel: 'Send enquiry',
    successTitle: 'Enquiry received.', successMessage: 'Thank you. The DPD team will contact you to confirm the details.',
    fields: [name, phone,
      {name: 'cinema', label: 'DPD location', type: 'cinema', required: true},
      {name: 'enquiry', label: 'Enquiry type', type: 'select', required: true, optionsKey: 'cafeEnquiry', options: ['Menu and offers', 'Plan a get-together', 'Celebrate an occasion', 'Something else']},
      {name: 'date', label: 'Preferred date', type: 'date'},
      {name: 'guests', label: 'Number of guests', type: 'number', min: 1, max: 200},
      {name: 'message', label: 'Message', type: 'textarea', wide: true, placeholder: 'Timing, preferences, or questions'},
    ],
  },
  career: {
    type: 'career', label: 'Career applications', noun: 'job application', page: '/career', submitLabel: 'Submit application',
    successTitle: 'Application received.', successMessage: 'Thank you for your interest in joining Udayan. Our team will review your CV and contact you if there is a suitable opening.',
    fields: [name, phone,
      {name: 'altPhone', label: 'Alternate mobile number', type: 'tel', autoComplete: 'tel-national', placeholder: 'Optional'},
      email,
      {name: 'qualification', label: 'Qualification', type: 'text', required: true, placeholder: 'Highest qualification'},
      {name: 'role', label: 'Role you’re interested in', type: 'text', placeholder: 'e.g. Front desk, projection, café'},
      {name: 'cinema', label: 'Preferred location', type: 'cinema', allCinemas: 'Either location'},
      {name: 'message', label: 'Your message', type: 'textarea', wide: true, placeholder: 'Experience, availability, or anything else (optional)'},
      {name: 'cv', label: 'Upload CV', type: 'file', required: true, wide: true, hint: 'PDF or Word document, up to 5 MB.'},
    ],
  },
  feedback: {
    type: 'feedback', label: 'Patron feedback', noun: 'feedback', page: '/patron-feedback', submitLabel: 'Submit your feedback',
    successTitle: 'Thank you for your feedback.', successMessage: 'Every response is read by the Udayan team and helps us make your next visit better.',
    fields: [
      {...name, required: false},
      {name: 'cinema', label: 'Location', type: 'cinema', required: true},
      phone,
      {name: 'visitDate', label: 'Date of visit', type: 'date'},
      {name: 'cleanliness', label: 'Cleanliness', type: 'rating'},
      {name: 'picture', label: 'Picture quality', type: 'rating'},
      {name: 'sound', label: 'Sound quality', type: 'rating'},
      {name: 'food', label: 'F&B experience', type: 'rating'},
      {name: 'staff', label: 'Staff behaviour', type: 'rating'},
      {name: 'remarks', label: 'Remarks', type: 'textarea', wide: true, placeholder: 'What did you enjoy, and what can we do better?'},
    ],
  },
};
export const formTypes = Object.keys(formDefinitions) as FormType[];
export const isFormType = (value: unknown): value is FormType => typeof value === 'string' && Object.hasOwn(formDefinitions, value);

export function normalizePhone(value: string) {
  let digits = value.replace(/[\s().-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

type Input = {get(name: string): unknown; getAll(name: string): unknown[]};
const text = (value: unknown) => typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';

/** Validates every non-file field. File fields are checked by the server, which can read their bytes. */
export function validateSubmission(type: FormType, input: Input, cinemaIds: string[], options: FormOptions = {}) {
  const values: SubmissionValues = {};
  const errors: Record<string, string> = {};
  for (const field of formDefinitions[type].fields) {
    if (field.type === 'file') continue;
    if (field.type === 'checkboxes') {
      const allowed = fieldOptions(field, options);
      const selected = input.getAll(field.name).map(text).filter(option => allowed.includes(option));
      if (selected.length) values[field.name] = [...new Set(selected)];
      else if (field.required) errors[field.name] = 'Choose at least one option.';
      continue;
    }
    let value = text(input.get(field.name));
    if (!value) {
      if (field.required) errors[field.name] = field.type === 'cinema' || field.type === 'select' ? 'Please choose an option.' : 'This field is required.';
      continue;
    }
    const limit = field.type === 'textarea' ? 3000 : 160;
    if (value.length > limit) {errors[field.name] = `Please keep this under ${limit} characters.`; continue;}
    if (field.type === 'tel') {
      const phone = normalizePhone(value);
      if (!phone) {errors[field.name] = 'Enter a valid 10-digit Indian mobile number.'; continue;}
      value = phone;
    } else if (field.type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {errors[field.name] = 'Enter a valid email address.'; continue;}
      value = value.toLowerCase();
    } else if (field.type === 'cinema') {
      if (!cinemaIds.includes(value) && !(field.allCinemas && value === allCinemasValue)) {errors[field.name] = 'Please choose a cinema.'; continue;}
    } else if (field.type === 'select') {
      if (!fieldOptions(field, options).includes(value)) {errors[field.name] = 'Please choose an option.'; continue;}
    } else if (field.type === 'rating') {
      if (!/^[1-5]$/.test(value)) {errors[field.name] = 'Choose a rating from 1 to 5.'; continue;}
    } else if (field.type === 'number') {
      const number = Number(value);
      if (!Number.isInteger(number) || number < (field.min ?? 0) || number > (field.max ?? Infinity)) {errors[field.name] = `Enter a number from ${field.min ?? 0} to ${field.max}.`; continue;}
    } else if (field.type === 'date') {
      const date = new Date(value + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {errors[field.name] = 'Enter a valid date.'; continue;}
    }
    values[field.name] = value;
  }
  if (type === 'feedback' && !errors.remarks) {
    const rated = formDefinitions.feedback.fields.some(field => field.type === 'rating' && values[field.name]);
    if (!rated && !values.remarks) errors.remarks = 'Rate at least one part of your visit or add a remark.';
  }
  return {values, errors};
}

/** Human-readable value for emails, exports, and the admin panel. */
export function displayValue(field: FormField, value: string | string[] | undefined, cinemaNames: Record<string, string>) {
  if (value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  if (field.type === 'cinema') return value === allCinemasValue ? field.allCinemas || 'All cinemas' : cinemaNames[value] || value;
  if (field.type === 'rating') return `${value}/5 · ${ratingLabels[Number(value) - 1]}`;
  if (field.type === 'tel') return '+91 ' + value;
  return value;
}

/** A short line describing the submission in lists. */
export function submissionSummary(type: FormType, values: SubmissionValues) {
  const value = (key: string) => typeof values[key] === 'string' ? values[key] as string : '';
  switch (type) {
    case 'contact': return value('topic');
    case 'advertising': return value('company');
    case 'cafe': return value('enquiry');
    case 'career': return [value('qualification'), value('role')].filter(Boolean).join(' · ');
    case 'feedback': {
      const ratings = formDefinitions.feedback.fields.filter(field => field.type === 'rating').map(field => Number(value(field.name))).filter(Boolean);
      return ratings.length ? `Average ${(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)}/5` : 'Remarks only';
    }
  }
}
