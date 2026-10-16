#!/usr/bin/env node
/** Smoke test for multi-tab progress merge (no DOM). */
import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: key => { store.delete(key); },
};

const STORAGE_KEY = 'jlpt-study-progress-v1';
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const load = () => {
  try { return record(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return {}; }
};
const save = (topicId, selections, results, { replace = false } = {}) => {
  const all = load();
  const prev = record(all[topicId]);
  all[topicId] = {
    selections: replace ? Object.fromEntries(selections) : { ...record(prev.selections), ...Object.fromEntries(selections) },
    results: replace ? Object.fromEntries(results) : { ...record(prev.results), ...Object.fromEntries(results) },
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

save('near-synonyms', new Map([['a', '1']]), new Map([['a', 'ok']]));
save('near-synonyms', new Map([['b', '2']]), new Map([['b', 'wrong']]));
const merged = load()['near-synonyms'];
assert.equal(merged.selections.a, '1');
assert.equal(merged.selections.b, '2');
assert.equal(merged.results.a, 'ok');
assert.equal(merged.results.b, 'wrong');

save('near-synonyms', new Map(), new Map(), { replace: true });
assert.deepEqual(load()['near-synonyms'].selections, {});
console.log('test-storage-merge PASS');
