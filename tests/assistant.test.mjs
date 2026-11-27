import assert from 'node:assert/strict';
import {test} from 'node:test';
import {understand, detectLang} from '../lib/assistant/lang.ts';
import {fixHeard} from '../lib/assistant/heard.ts';

test('booking language preserves ticket count, date and time across scripts', () => {
  for (const text of ['kal sham 7 baje 2 ticket chahiye','कल शाम ७ बजे २ टिकट','কাল সন্ধ্যায় ৭টায় ২ টিকিট']) {
    const parsed = understand(text);
    assert.match(parsed,/tomorrow/);
    assert.match(parsed,/evening/);
    assert.match(parsed,/7/);
    assert.match(parsed,/2/);
  }
  assert.equal(detectLang('কাল সন্ধ্যায় কী চলছে?'),'bn');
  assert.equal(detectLang('कल शाम क्या चल रहा है?'),'hi');
});

test('voice corrections use Udayan venue and café names', () => {
  assert.equal(fixHeard('D P D at Tarkeshwar'),'DPD at Tarakeswar');
  assert.equal(fixHeard('Sheora Phuli'),'Sheoraphuli');
});
