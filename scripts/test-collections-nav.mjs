#!/usr/bin/env node
/** Collection navigation contracts for Study L1. */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const store = new Map();
globalThis.sessionStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: key => { store.delete(key); },
};

const {
  parseStudyHash,
  listRouteKey,
  writePackReturn,
  readPackReturn,
  resolvePackReturn,
  clearPackReturn,
  PACK_RETURN_KEY,
} = await import('../study.js');

const {
  saveListState,
  loadListState,
  LIST_STATE_KEY,
} = await import('../study-storage.js');

assert.deepEqual(parseStudyHash(''), { kind: 'catalog', id: '', collectionId: '', folderId: '', flash: false });
assert.deepEqual(parseStudyHash('#'), { kind: 'catalog', id: '', collectionId: '', folderId: '', flash: false });
assert.equal(parseStudyHash('#grammar').kind, 'topic');
assert.equal(parseStudyHash('#grammar').id, 'grammar');
assert.equal(parseStudyHash('#grammar?mode=flash').flash, true);
assert.equal(parseStudyHash('#pack/tong-hop').kind, 'collection');
assert.equal(parseStudyHash('#pack/tong-hop').collectionId, 'tong-hop');
assert.equal(parseStudyHash('#pack/tong-hop/ngu-phap').kind, 'folder');
assert.equal(parseStudyHash('#pack/tong-hop/ngu-phap').folderId, 'ngu-phap');
assert.equal(parseStudyHash('#pack').kind, 'invalid');
assert.equal(listRouteKey(parseStudyHash('')), 'catalog');
assert.equal(listRouteKey(parseStudyHash('#pack/tong-hop')), 'pack/tong-hop');
assert.equal(listRouteKey(parseStudyHash('#pack/tong-hop/ngu-phap')), 'pack/tong-hop/ngu-phap');
assert.equal(listRouteKey(parseStudyHash('#grammar')), '');

saveListState('pack/tong-hop/ngu-phap', { scrollY: 420, search: 'sao' });
assert.deepEqual(loadListState('pack/tong-hop/ngu-phap'), {
  scrollY: 420,
  groupFilter: 'all',
  search: 'sao',
});
assert.ok(sessionStorage.getItem(LIST_STATE_KEY));

const topics = JSON.parse(fs.readFileSync(path.join(ROOT, 'study-data/topics.json'), 'utf8'));
const topicIds = new Set(topics.map(topic => topic.id));
const collectionsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'study-data/collections.json'), 'utf8'));
assert.equal(collectionsDoc.collections.length, 1);
const pack = collectionsDoc.collections[0];
assert.equal(pack.id, 'tong-hop');
assert.equal(pack.folders.length, 6);
assert.deepEqual(
  pack.folders.map(folder => folder.id),
  ['chuyen-tu-vung', 'han-tu', 'nghe-hieu', 'ngu-phap', 'tu-vung', 'doc-hieu'],
);

const allowed = new Set(['grammar', 'star-rearrange', 'usage-quiz', 'near-synonyms']);
const seen = [];
for (const folder of pack.folders) {
  for (const topicId of folder.topicIds) {
    assert.ok(topicIds.has(topicId), `missing topic ${topicId}`);
    assert.ok(allowed.has(topicId), `unexpected L1 topic ${topicId}`);
    seen.push(topicId);
  }
}
assert.deepEqual([...seen].sort(), [...allowed].sort());

const collections = collectionsDoc.collections;
writePackReturn('grammar', '#pack/tong-hop/ngu-phap');
assert.deepEqual(readPackReturn(), { topicId: 'grammar', returnHash: '#pack/tong-hop/ngu-phap' });
assert.equal(resolvePackReturn('grammar', collections), '#pack/tong-hop/ngu-phap');
// Different topic must not reuse another topic's folder context.
assert.equal(resolvePackReturn('usage-quiz', collections), '');
assert.equal(readPackReturn(), null);
writePackReturn('grammar', '#pack/tong-hop/ngu-phap');
assert.equal(resolvePackReturn('kanji', collections), '');
assert.equal(readPackReturn(), null);
// Legacy bare hash is ignored.
store.set(PACK_RETURN_KEY, '#pack/tong-hop/ngu-phap');
assert.equal(resolvePackReturn('grammar', collections), '');
assert.equal(readPackReturn(), null);
writePackReturn('usage-quiz', '#pack/tong-hop/tu-vung');
assert.equal(resolvePackReturn('usage-quiz', collections), '#pack/tong-hop/tu-vung');
clearPackReturn();
assert.equal(resolvePackReturn('usage-quiz', collections), '');

const study = fs.readFileSync(path.join(ROOT, 'study.js'), 'utf8');
assert.match(study, /collections\.json/);
assert.match(study, /createCollectionCard/);
assert.match(study, /Nội dung đang được chuẩn bị/);
assert.match(study, /jlpt-study-pack-return/);
assert.match(study, /resolvePackReturn/);
assert.doesNotMatch(study, /localStorage\.clear/);
// Pack views must not wipe return context (Forward after Back to folder).
assert.doesNotMatch(
  study,
  /route\.kind === 'collection'[\s\S]{0,400}clearPackReturn\(\)/,
);

const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
assert.match(sw, /collections\.json\?v=\$\{RELEASE\}/);

console.log('test-collections-nav PASS');
