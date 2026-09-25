import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findSection, readSection, sectionValues, sections} from '../lib/content-schema.ts';
import {hashPassword, verifyPassword, passwordProblem} from '../lib/server/passwords.ts';
import {defaultContent} from '../lib/data.ts';

const form = entries => ({get: key => entries.find(([name]) => name === key)?.[1] ?? null, getAll: key => entries.filter(([name]) => name === key).map(([, value]) => value)});
const file = name => new File([new Uint8Array([0xff, 0xd8, 0xff, 1])], name, {type: 'image/jpeg'});

test('every section path resolves to existing default content', () => {
  for (const section of sections) {
    const values = sectionValues(section, defaultContent);
    for (const field of section.fields) assert.ok(field.name in values, `${section.id}.${field.name} has no default`);
  }
});
test('list rows are read in order, validated, and keep their ids', () => {
  const section = findSection('contact');
  const {values, errors} = readSection(section, form([
    ['faqEyebrow', 'FAQ'], ['faqHeading', 'Questions'],
    ['faq.__id', 'faq-2'], ['faq.question', 'Second?'], ['faq.answer', 'Yes.'],
    ['faq.__id', 'new-row'], ['faq.question', '  First?  '], ['faq.answer', ''],
  ]));
  assert.deepEqual(values.faq.map(row => row.id), ['faq-2', 'new-row']);
  assert.equal(values.faq[1].question, 'First?');
  assert.deepEqual(errors, ['Question 2 · Answer is required.']);
});
test('images keep their current path, accept uploads, and reject unknown paths', () => {
  const section = findSection('gallery');
  const {values, errors, uploads} = readSection(section, form([
    ['photos.__id', 'a'], ['photos.src', '/images/gallery-2.jpg'], ['photos.alt', 'One'], ['photos.src.__file', new File([], '')],
    ['photos.__id', 'b'], ['photos.src', ''], ['photos.alt', 'Two'], ['photos.src.__file', file('new.jpg')],
    ['photos.__id', 'c'], ['photos.src', 'https://evil.example/x.jpg'], ['photos.alt', 'Three'], ['photos.src.__file', new File([], '')],
  ]));
  assert.equal(values.photos[0].src, '/images/gallery-2.jpg');
  assert.equal(uploads.length, 1);
  uploads[0].assign('/media/abc.jpg');
  assert.equal(values.photos[1].src, '/media/abc.jpg');
  assert.deepEqual(errors, ['Photo 3 · Photo: add a photo.']);
});
test('icons, years, lengths, and list limits are enforced', () => {
  const section = findSection('home-strip');
  assert.match(readSection(section, form([])).errors[0], /add at least 1/);
  assert.match(readSection(section, form([['strip.__id', 'x'], ['strip.icon', 'rocket'], ['strip.text', 'Hi']])).errors[0], /choose an icon/);
  const heritage = readSection(findSection('home-cafe'), form([['heritageYear', '46']]));
  assert.ok(heritage.errors.includes('Heritage · year must be a four-digit year.'));
});
test('passwords are salted, verified, and checked for length', () => {
  const hash = hashPassword('correct horse battery');
  assert.notEqual(hash, hashPassword('correct horse battery'));
  assert.ok(verifyPassword('correct horse battery', hash));
  assert.ok(!verifyPassword('wrong password here', hash));
  assert.match(passwordProblem('short'), /at least 10/);
  assert.equal(passwordProblem('long enough pass'), null);
});
test('page shapes are normalised and malformed ones rejected', () => {
  const section = findSection('hooghly-book');
  const base = [['eyebrow', 'E'], ['heading', 'H'], ['intro', 'I'], ['title', 'T'], ['pages.__id', 'p1'], ['pages.src', '/media/a.jpg'], ['pages.alt', 'Cover']];
  assert.equal(readSection(section, form([...base, ['aspectRatio', '1790x1276']])).values.aspectRatio, '1790 / 1276');
  assert.match(readSection(section, form([...base, ['aspectRatio', 'wide']])).errors[0], /width \/ height/);
});
test('edited form choices replace the built-in ones for validation', async () => {
  const {validateSubmission, fieldOptions, formDefinitions} = await import('../lib/forms.ts');
  const options = {contactTopic: [{label: 'Birthday screening'}]};
  const input = {get: key => ({name: 'A', phone: '9876543210', cinema: 'sheoraphuli', topic: 'Birthday screening', message: 'Hi'})[key] ?? null, getAll: () => []};
  assert.deepEqual(validateSubmission('contact', input, ['sheoraphuli'], options).errors, {});
  assert.equal(validateSubmission('contact', input, ['sheoraphuli']).errors.topic, 'Please choose an option.');
  assert.ok(fieldOptions(formDefinitions.contact.fields.find(f => f.name === 'topic'), {}).includes('Group visit'));
});
