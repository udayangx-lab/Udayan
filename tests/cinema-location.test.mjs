import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCinemaSelection, nearestCinema, cinemaPreferenceKey} from '../lib/cinema-location.ts';
import {cinemas} from '../lib/data.ts';

function fixture(saved) {
  const values = new Map(saved ? [[cinemaPreferenceKey, saved]] : []);
  const requests = [];
  const changes = [];
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
  const geolocation = {getCurrentPosition: (success, error, options) => requests.push({success, error, options})};
  const controller = createCinemaSelection({venues: cinemas, storage, geolocation, onChange: selection => changes.push(selection)});
  return {controller, requests, changes, values};
}
const position = (latitude, longitude) => ({coords: {latitude, longitude}});

test('selects the nearest cinema in both towns and their nearby areas', () => {
  assert.equal(nearestCinema(22.774846, 88.326738, cinemas), 0);
  assert.equal(nearestCinema(22.874893, 88.012038, cinemas), 1);
  assert.equal(nearestCinema(22.8, 88.32, cinemas), 0); // Baidyabati area
  assert.equal(nearestCinema(22.88, 88.03, cinemas), 1); // Tarakeswar area
  assert.equal(nearestCinema(NaN, 88, cinemas), null);
  assert.equal(nearestCinema(92, 88, cinemas), null);
});
test('first visit detects location without storing visitor coordinates', () => {
  const f = fixture();
  f.controller.start();
  assert.equal(f.changes.at(-1).status, 'locating');
  f.requests[0].success(position(22.88, 88.03));
  assert.deepEqual(f.changes.at(-1), {index: 1, status: 'nearest'});
  assert.equal(f.values.size, 0);
  assert.equal(f.requests[0].options.timeout, 10000);
});
test('manual choice survives reload and wins over a late location result', () => {
  const f = fixture();
  f.controller.start();
  f.controller.select(1);
  f.requests[0].success(position(22.774846, 88.326738));
  assert.deepEqual(f.changes.at(-1), {index: 1, status: 'manual'});
  assert.equal(f.values.get(cinemaPreferenceKey), 'tarakeswar');
  const restored = fixture(f.values.get(cinemaPreferenceKey));
  restored.controller.start();
  assert.equal(restored.requests.length, 0);
  assert.deepEqual(restored.changes.at(-1), {index: 1, status: 'manual'});
});
test('denied or timed-out location keeps a usable selection and supports retry', () => {
  const f = fixture('tarakeswar');
  f.controller.start();
  f.controller.locate();
  f.requests[0].error({code: 1});
  assert.deepEqual(f.changes.at(-1), {index: 1, status: 'denied'});
  assert.equal(f.values.get(cinemaPreferenceKey), 'tarakeswar');
  f.controller.locate();
  f.requests[1].error({code: 3});
  assert.deepEqual(f.changes.at(-1), {index: 1, status: 'unavailable'});
  f.controller.locate();
  f.requests[2].success(position(22.774846, 88.326738));
  assert.deepEqual(f.changes.at(-1), {index: 0, status: 'nearest'});
  assert.equal(f.values.size, 0);
});
test('unavailable APIs and blocked storage do not break manual selection', () => {
  const changes = [];
  const controller = createCinemaSelection({venues: cinemas,
    storage: {getItem() {throw Error();}, setItem() {throw Error();}, removeItem() {throw Error();}},
    onChange: selection => changes.push(selection)});
  controller.start();
  assert.equal(changes.at(-1).status, 'unavailable');
  controller.select(1);
  assert.deepEqual(changes.at(-1), {index: 1, status: 'manual'});
});
test('old requests and unmounted controllers cannot overwrite newer state', () => {
  const f = fixture();
  f.controller.start();
  f.controller.locate();
  f.requests[1].success(position(22.88, 88.03));
  f.requests[0].success(position(22.774846, 88.326738));
  assert.equal(f.changes.at(-1).index, 1);
  f.controller.locate();
  const count = f.changes.length;
  f.controller.dispose();
  f.requests[2].success(position(22.774846, 88.326738));
  assert.equal(f.changes.length, count);
});
