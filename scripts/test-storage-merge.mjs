#!/usr/bin/env node
/** Smoke test for multi-tab progress merge (no DOM). */
import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: key => { store.delete(key); },
};

const { saveStudyProgress, loadStudyProgress } = await import('../study-storage.js');

saveStudyProgress('near-synonyms', new Map([['a', '1']]), new Map([['a', 'ok']]));
saveStudyProgress('near-synonyms', new Map([['b', '2']]), new Map([['b', 'wrong']]));
const merged = loadStudyProgress()['near-synonyms'];
assert.equal(merged.selections.a, '1');
assert.equal(merged.selections.b, '2');
assert.equal(merged.results.a, 'ok');
assert.equal(merged.results.b, 'wrong');

saveStudyProgress('near-synonyms', new Map(), new Map(), { replace: true });
assert.deepEqual(loadStudyProgress()['near-synonyms'].selections, {});
console.log('test-storage-merge PASS');
