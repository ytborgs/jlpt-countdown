/** Local study progress / known / catalog UI state. No DOM. */

export const STORAGE_KEY = 'jlpt-study-progress-v1';
export const KNOWN_KEY = 'jlpt-study-known-v1';
export const CATALOG_STATE_KEY = 'jlpt-study-catalog-v1';
/** Per-list UI (catalog + pack folders): scroll/search keyed by route. */
export const LIST_STATE_KEY = 'jlpt-study-list-v1';

export const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Stable key for list routes; empty for topic/invalid. */
export function listRouteKey(route) {
  if (!route || typeof route !== 'object') return '';
  if (route.kind === 'catalog') return 'catalog';
  if (route.kind === 'collection' && route.collectionId) return `pack/${route.collectionId}`;
  if (route.kind === 'folder' && route.collectionId && route.folderId) {
    return `pack/${route.collectionId}/${route.folderId}`;
  }
  return '';
}

const normalizeListState = saved => {
  if (!saved || typeof saved !== 'object') return null;
  return {
    scrollY: Number(saved.scrollY) || 0,
    groupFilter: typeof saved.groupFilter === 'string' ? saved.groupFilter : 'all',
    search: typeof saved.search === 'string' ? saved.search : '',
  };
};

export function loadListState(key) {
  if (!key) return null;
  try {
    const all = record(JSON.parse(sessionStorage.getItem(LIST_STATE_KEY) || '{}'));
    return normalizeListState(all[key]);
  } catch {
    return null;
  }
}

export function saveListState(key, state) {
  if (!key) return;
  try {
    const all = record(JSON.parse(sessionStorage.getItem(LIST_STATE_KEY) || '{}'));
    all[key] = {
      scrollY: Number(state.scrollY) || 0,
      groupFilter: state.groupFilter || 'all',
      search: state.search || '',
    };
    sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify(all));
  } catch { /* Session storage may be unavailable. */ }
}

export function loadCatalogState() {
  const fromList = loadListState('catalog');
  if (fromList) return fromList;
  try {
    return normalizeListState(JSON.parse(sessionStorage.getItem(CATALOG_STATE_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function saveCatalogState(state) {
  saveListState('catalog', state);
  try {
    sessionStorage.setItem(CATALOG_STATE_KEY, JSON.stringify({
      scrollY: Number(state.scrollY) || 0,
      groupFilter: state.groupFilter || 'all',
      search: state.search || '',
    }));
  } catch { /* Session storage may be unavailable. */ }
}

export function loadStudyProgress() {
  try { return record(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return {}; }
}

export function saveStudyProgress(topicId, selections, results, { replace = false } = {}) {
  try {
    const all = loadStudyProgress();
    const prev = record(all[topicId]);
    const nextSelections = replace
      ? Object.fromEntries(selections)
      : { ...record(prev.selections), ...Object.fromEntries(selections) };
    const nextResults = replace
      ? Object.fromEntries(results)
      : { ...record(prev.results), ...Object.fromEntries(results) };
    all[topicId] = {
      selections: nextSelections,
      results: nextResults,
      updatedAt: new Date().toISOString(),
      ...(replace ? { resetAt: new Date().toISOString() } : {}),
    };
    if (!replace && prev.resetAt) all[topicId].resetAt = prev.resetAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* Storage may be unavailable or full; in-memory practice still works. */ }
}

export function hydrateStudyProgress(items, saved) {
  const selections = new Map(), results = new Map();
  const stored = record(record(saved).selections);
  for (const item of items) {
    if (item.type !== 'practice' || !Object.hasOwn(stored, item.id)) continue;
    const key = String(stored[item.id]);
    if (!item.choices.some(choice => String(choice.key) === key)) continue;
    selections.set(item.id, key);
    // Recompute from current answers instead of trusting stale stored grades.
    if (item.correct_answer != null && item.choices.some(choice => String(choice.key) === String(item.correct_answer))) {
      results.set(item.id, key === String(item.correct_answer) ? 'ok' : 'wrong');
    }
  }
  return { selections, results };
}

export function loadStudyKnown() {
  try { return record(JSON.parse(localStorage.getItem(KNOWN_KEY) || '{}')); }
  catch { return {}; }
}

export function hydrateStudyKnown(items, saved) {
  const stored = record(saved);
  return new Set(items.filter(item => Object.hasOwn(stored, item.id) && stored[item.id] === true).map(item => item.id));
}

export function saveStudyKnown(topicId, known, { replace = false } = {}) {
  try {
    const all = loadStudyKnown();
    if (replace) {
      all[topicId] = Object.fromEntries([...known].map(id => [id, true]));
    } else {
      const prev = { ...record(all[topicId]) };
      for (const id of known) prev[id] = true;
      all[topicId] = prev;
    }
    localStorage.setItem(KNOWN_KEY, JSON.stringify(all));
  } catch { /* Keep the current session usable if local storage is unavailable. */ }
}

export function patchStudyKnown(topicId, itemId, value) {
  try {
    const all = loadStudyKnown();
    const topic = { ...record(all[topicId]) };
    if (value) topic[itemId] = true;
    else delete topic[itemId];
    all[topicId] = topic;
    localStorage.setItem(KNOWN_KEY, JSON.stringify(all));
  } catch { /* Keep the current session usable if local storage is unavailable. */ }
}

export function pruneStudyProgress(topicId, items) {
  const valid = new Set(items.map(item => item.id));
  const saved = record(loadStudyProgress()[topicId]);
  const selections = record(saved.selections);
  const results = record(saved.results);
  let changed = false;
  for (const id of Object.keys(selections)) {
    if (!valid.has(id)) { delete selections[id]; changed = true; }
  }
  for (const id of Object.keys(results)) {
    if (!valid.has(id)) { delete results[id]; changed = true; }
  }
  if (!changed) return;
  try {
    const all = loadStudyProgress();
    all[topicId] = { ...saved, selections, results, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function pruneStudyKnown(topicId, items) {
  const valid = new Set(items.map(item => item.id));
  const saved = { ...record(loadStudyKnown()[topicId]) };
  let changed = false;
  for (const id of Object.keys(saved)) {
    if (!valid.has(id)) { delete saved[id]; changed = true; }
  }
  if (!changed) return;
  try {
    const all = loadStudyKnown();
    all[topicId] = saved;
    localStorage.setItem(KNOWN_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/** Catalog chip — localStorage only (no topic JSON). */
export function topicCatalogProgress(topic) {
  if (topic.group === 'practice') {
    const saved = record(loadStudyProgress()[topic.id]);
    const results = record(saved.results);
    const selections = record(saved.selections);
    const ok = Object.values(results).filter(value => value === 'ok').length;
    const wrong = Object.values(results).filter(value => value === 'wrong').length;
    const selected = Math.min(Object.keys(selections).length, topic.count);
    const okCount = Math.min(ok, topic.count);
    const wrongCount = Math.min(wrong, Math.max(0, topic.count - okCount));
    if (topic.gradable === false) {
      if (!selected) return { kind: 'idle', text: 'Chưa chọn', ratio: 0 };
      return { kind: selected >= topic.count ? 'done' : 'partial', text: `Đã chọn ${selected} / ${topic.count}`, ratio: selected / topic.count };
    }
    const done = Math.min(okCount + wrongCount, topic.count);
    if (!done) return { kind: 'idle', text: 'Chưa làm', ratio: 0 };
    return {
      kind: done >= topic.count ? 'done' : 'partial',
      text: `Đúng ${okCount} · Sai ${wrongCount} · Còn ${Math.max(0, topic.count - done)}`,
      ratio: done / topic.count,
    };
  }
  const knownMap = record(loadStudyKnown()[topic.id]);
  const done = Math.min(Object.values(knownMap).filter(Boolean).length, topic.count);
  if (!done) return { kind: 'idle', text: 'Chưa đánh dấu', ratio: 0 };
  return {
    kind: done >= topic.count ? 'done' : 'partial',
    text: `Đã thuộc ${done} / ${topic.count}`,
    ratio: done / topic.count,
  };
}
