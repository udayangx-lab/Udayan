import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSubmission, normalizePhone, displayValue, formDefinitions, submissionSummary} from '../lib/forms.ts';

const cinemas = ['sheoraphuli', 'tarakeswar'];
const input = values => ({get: key => Array.isArray(values[key]) ? values[key][0] : values[key] ?? null, getAll: key => [].concat(values[key] ?? [])});

test('Indian mobile numbers are normalised to 10 digits', () => {
  assert.equal(normalizePhone('+91 70036 97009'), '7003697009');
  assert.equal(normalizePhone('917003697009'), '7003697009');
  assert.equal(normalizePhone('07003697009'), '7003697009');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('5003697009'), null);
});
test('career applications match the original form: name, mobile, and qualification are required', () => {
  const {errors} = validateSubmission('career', input({}), cinemas);
  assert.deepEqual(Object.keys(errors).sort(), ['name', 'phone', 'qualification']);
  const ok = validateSubmission('career', input({name: ' Asha ', phone: '7003697009', qualification: 'B.Com', cinema: 'all'}), cinemas);
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.values.name, 'Asha');
  assert.equal(displayValue(formDefinitions.career.fields.find(f => f.name === 'cinema'), ok.values.cinema, {}), 'Either location');
});
test('patron feedback needs a location, a mobile number, and at least one rating or remark', () => {
  const empty = validateSubmission('feedback', input({cinema: 'tarakeswar', phone: '7679088942'}), cinemas);
  assert.match(empty.errors.remarks, /at least one/);
  const rated = validateSubmission('feedback', input({cinema: 'tarakeswar', phone: '7679088942', sound: '5', staff: '3'}), cinemas);
  assert.deepEqual(rated.errors, {});
  assert.equal(submissionSummary('feedback', rated.values), 'Average 4.0/5');
  assert.equal(validateSubmission('feedback', input({cinema: 'x', phone: '7679088942', sound: '9'}), cinemas).errors.sound, 'Choose a rating from 1 to 5.');
});
test('select, checkbox, email, and cinema values are checked against their options', () => {
  const {values, errors} = validateSubmission('advertising', input({name: 'A', company: 'B', phone: '9876543210', email: 'X@Y.COM', cinema: 'elsewhere',
    formats: ['Standees', 'Hacked', 'Standees']}), cinemas);
  assert.equal(errors.cinema, 'Please choose a cinema.');
  assert.deepEqual(values.formats, ['Standees']);
  assert.equal(values.email, 'x@y.com');
  assert.equal(validateSubmission('contact', input({topic: 'Refund please'}), cinemas).errors.topic, 'Please choose an option.');
  assert.equal(validateSubmission('cafe', input({guests: '0'}), cinemas).errors.guests, 'Enter a number from 1 to 200.');
});
