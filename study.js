import { createGrammarCard, createRubyText } from './grammar.js';
const DATA_VERSION = new URL(import.meta.url).searchParams.get('v') || '35';
const SESSION_SHORT = 20;
const CATALOG_STATE_KEY = 'jlpt-study-catalog-v1';

export function loadCatalogState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CATALOG_STATE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return null;
    return {
      scrollY: Number(saved.scrollY) || 0,
      groupFilter: typeof saved.groupFilter === 'string' ? saved.groupFilter : 'all',
      search: typeof saved.search === 'string' ? saved.search : '',
    };
  } catch {
    return null;
  }
}

export function saveCatalogState(state) {
  try {
    sessionStorage.setItem(CATALOG_STATE_KEY, JSON.stringify({
      scrollY: Number(state.scrollY) || 0,
      groupFilter: state.groupFilter || 'all',
      search: state.search || '',
    }));
  } catch { /* Session storage may be unavailable. */ }
}

export const parseStudyHash = (hash = typeof location !== 'undefined' ? location.hash : '') => {
  const raw = String(hash || '').replace(/^#/, '');
  const q = raw.indexOf('?');
  const id = q < 0 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : raw.slice(q + 1));
  return { id, flash: params.get('mode') === 'flash' };
};

export const shuffleItems = items => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

export const flashHeadForItem = item => {
  const grammarTip = item.type === 'tips' && item.subtype === 'exam_tip_grammar' &&
    ['pattern', 'meaning', 'structure', 'usage', 'example_jp', 'example_vi'].every(key => typeof item[key] === 'string');
  if (item.type === 'grammar' || grammarTip) {
    return { text: item.pattern || '', ruby: item.pattern_ruby, className: 'study-flash-pattern', lang: 'ja' };
  }
  if (item.type === 'reading') {
    return { text: item.connector_jp || '', ruby: item.connector_ruby, className: 'study-connector', lang: 'ja' };
  }
  if (item.type === 'vocabulary') {
    return { text: item.lemma_jp || item.example_jp || '', ruby: item.lemma_ruby, className: 'study-word', lang: 'ja' };
  }
  if (item.type === 'kanji') {
    return { text: item.kanji || '', ruby: undefined, className: 'study-kanji', lang: 'ja' };
  }
  return { text: item.label || item.title || 'Ghi chú ôn tập', ruby: undefined, className: 'study-connector', lang: undefined };
};

export const flashMeaningForItem = item => {
  const grammarTip = item.type === 'tips' && item.subtype === 'exam_tip_grammar' && typeof item.meaning === 'string';
  if (item.type === 'grammar' || grammarTip) return item.meaning || '';
  if (item.type === 'kanji') return [item.han_viet, item.meaning_vi].filter(Boolean).join(' · ');
  if (item.type === 'tips' && typeof item.body === 'string') return item.body.trim();
  return item.meaning_vi || '';
};

export const flashExampleTarget = item => item.connector_jp || item.lemma_jp || item.pattern || '';

const el = (tag, value = '', className = '', lang) => {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  if (lang) node.lang = lang;
  return node;
};
const normalize = value => String(value).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const searchable = value => Array.isArray(value) ? value.map(searchable).join(' ') : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => !/^(source|content_source|verify_reason|id|knowledge_id|ai_extra|ruby_source|group|gradable|path)/.test(key)).map(([, v]) => searchable(v)).join(' ') : typeof value === 'string' ? value : '';
export const filterStudy = (items, query) => items.filter(item => normalize(searchable(item)).includes(normalize(query.trim())));
export const hasAnswer = item => item.correct_answer != null && item.choices.some(choice => String(choice.key) === String(item.correct_answer));
export const isPracticeAnswered = (item, selections, results) => {
  if (item.type !== 'practice') return false;
  return hasAnswer(item) ? results.has(item.id) : selections.has(item.id);
};
export function buildPracticeSessionQueue(items, selections, results, { query = '', filterMode = 'all', limit = null } = {}) {
  let pool = filterStudy(items.filter(item => item.type === 'practice'), query);
  pool = pool.filter(item => {
    if (filterMode === 'all') return true;
    const answered = isPracticeAnswered(item, selections, results);
    const result = results.get(item.id);
    if (filterMode === 'todo') return !answered;
    if (filterMode === 'wrong') return result === 'wrong';
    if (filterMode === 'ok') return result === 'ok';
    return true;
  });
  if (limit != null) pool = pool.slice(0, limit);
  return pool;
}
const topicNotice = topic => (topic.notice || '').replace(/(?:Cần )?UI type=reading(?: \(xem PROMPT\))?\.\s*/g, '');

export const STUDY_GROUPS = [
  { id: 'grammar', label: 'Ngữ pháp' },
  { id: 'vocab', label: 'Từ vựng & Hán tự' },
  { id: 'practice', label: 'Trắc nghiệm' },
  { id: 'tips', label: 'Mẹo & bí kíp' },
];
const topicGroupId = topic => STUDY_GROUPS.some(group => group.id === topic.group) ? topic.group : 'vocab';

const STORAGE_KEY = 'jlpt-study-progress-v1';
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function loadStudyProgress() {
  try { return record(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return {}; }
}
export function saveStudyProgress(topicId, selections, results) {
  try {
    const all = loadStudyProgress();
    all[topicId] = { selections: Object.fromEntries(selections), results: Object.fromEntries(results), updatedAt: new Date().toISOString() };
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
    if (hasAnswer(item)) results.set(item.id, key === String(item.correct_answer) ? 'ok' : 'wrong');
  }
  return { selections, results };
}

const KNOWN_KEY = 'jlpt-study-known-v1';
export function loadStudyKnown() {
  try { return record(JSON.parse(localStorage.getItem(KNOWN_KEY) || '{}')); }
  catch { return {}; }
}
export function hydrateStudyKnown(items, saved) {
  const stored = record(saved);
  return new Set(items.filter(item => Object.hasOwn(stored, item.id) && stored[item.id] === true).map(item => item.id));
}
export function saveStudyKnown(topicId, known) {
  try {
    const all = loadStudyKnown();
    all[topicId] = Object.fromEntries([...known].map(id => [id, true]));
    localStorage.setItem(KNOWN_KEY, JSON.stringify(all));
  } catch { /* Keep the current session usable if local storage is unavailable. */ }
}

/** Progress chip for catalog cards — reads localStorage only (no topic JSON load). */
export function topicCatalogProgress(topic) {
  if (topic.group === 'practice') {
    const saved = record(loadStudyProgress()[topic.id]);
    const results = record(saved.results);
    const selections = record(saved.selections);
    const ok = Object.values(results).filter(value => value === 'ok').length;
    const wrong = Object.values(results).filter(value => value === 'wrong').length;
    const selected = Object.keys(selections).length;
    if (topic.gradable === false) {
      if (!selected) return { kind: 'idle', text: 'Chưa chọn', ratio: 0 };
      return { kind: selected >= topic.count ? 'done' : 'partial', text: `Đã chọn ${selected} / ${topic.count}`, ratio: selected / topic.count };
    }
    const done = ok + wrong;
    if (!done) return { kind: 'idle', text: 'Chưa làm', ratio: 0 };
    return {
      kind: done >= topic.count ? 'done' : 'partial',
      text: `Đúng ${ok} · Sai ${wrong} · Còn ${Math.max(0, topic.count - done)}`,
      ratio: done / topic.count,
    };
  }
  const knownMap = record(loadStudyKnown()[topic.id]);
  const done = Object.values(knownMap).filter(Boolean).length;
  if (!done) return { kind: 'idle', text: 'Chưa đánh dấu', ratio: 0 };
  return {
    kind: done >= topic.count ? 'done' : 'partial',
    text: `Đã thuộc ${done} / ${topic.count}`,
    ratio: done / topic.count,
  };
}

export function createTopicCard(topic) {
  const link = el('a', '', 'grammar-card study-topic');
  link.href = '#' + topic.id;
  const progress = topicCatalogProgress(topic);
  const meta = el('div', '', 'study-topic-meta');
  meta.append(el('span', topic.count + ' ' + topic.unit, 'grammar-number'));
  const chip = el('span', progress.text, 'study-topic-progress study-topic-progress-' + progress.kind);
  chip.setAttribute('aria-label', 'Tiến độ: ' + progress.text);
  meta.append(chip);
  link.append(meta, el('h2', topic.title), el('p', topic.description));
  if (topicNotice(topic)) link.append(el('small', topicNotice(topic)));
  if (progress.kind !== 'idle') {
    const bar = el('div', '', 'study-topic-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(Math.round(progress.ratio * 100)));
    bar.setAttribute('aria-label', progress.text);
    const fill = el('span', '', 'study-topic-bar-fill');
    fill.style.width = Math.min(100, Math.round(progress.ratio * 100)) + '%';
    bar.append(fill);
    link.append(bar);
  }
  link.append(el('span', 'Mở tài liệu →', 'study-open'));
  return link;
}

const addKnownToggle = (card, item, state) => {
  if (!state || item.type === 'practice') return card;
  const button = el('button', 'Đã thuộc', 'study-known');
  button.type = 'button';
  const update = () => {
    const known = state.known.has(item.id);
    button.setAttribute('aria-pressed', String(known));
    button.title = known ? 'Đánh dấu chưa thuộc' : 'Đánh dấu đã thuộc';
    card.dataset.known = String(known);
  };
  button.addEventListener('click', () => {
    if (state.known.has(item.id)) state.known.delete(item.id);
    else state.known.add(item.id);
    update(); state.onChange();
  });
  update(); card.append(button);
  return card;
};

export function openStudyExplanation(detail, index, trigger) {
  const dialog = document.getElementById('study-explanation-dialog');
  if (!dialog || dialog.open) return;
  const title = document.getElementById('study-explanation-title');
  const content = document.getElementById('study-explanation-content');
  title.textContent = 'Giải thích đáp án · Câu ' + (index + 1);
  content.replaceChildren(...[...detail.childNodes].map(node => node.cloneNode(true)));
  dialog.addEventListener('close', () => {
    content.replaceChildren();
    if (trigger.isConnected) trigger.focus();
  }, { once: true });
  dialog.showModal();
  content.scrollTop = 0;
}

export const createPracticeStem = (value, segments, target, hideTargetReading = false) => {
  const start = target ? value.indexOf(target) : -1;
  // A reading question must not reveal the underlined answer. Work on a copy
  // and remove readings only from segments overlapping that target.
  if (hideTargetReading && start >= 0 && Array.isArray(segments) &&
      segments.every(segment => segment && typeof segment.text === 'string') &&
      segments.map(segment => segment.text).join('') === value) {
    let offset = 0;
    segments = segments.map(segment => {
      const from = offset;
      offset += segment.text.length;
      return from < start + target.length && offset > start ? { text: segment.text } : segment;
    });
  }
  return markRubyTarget(createRubyText('p', value, segments, 'study-stem'), value, target);
};

const markRubyTarget = (element, value, target, className = '') => {
  const start = target ? value.indexOf(target) : -1;
  if (start < 0) return element;
  const end = start + target.length;
  const textNodes = [];
  const collect = node => {
    if (node.nodeType === 3) { textNodes.push(node); return; }
    // Readings and ruby fallback punctuation are not part of the base sentence.
    if (node.localName === 'rt' || node.localName === 'rp') return;
    for (const child of node.childNodes) collect(child);
  };
  collect(element);
  let offset = 0;
  for (const node of textNodes) {
    const text = node.textContent;
    const from = Math.max(0, start - offset);
    const to = Math.min(text.length, end - offset);
    if (from < to) {
      const parts = [];
      if (from) parts.push(document.createTextNode(text.slice(0, from)));
      parts.push(el('mark', text.slice(from, to), className));
      if (to < text.length) parts.push(document.createTextNode(text.slice(to)));
      node.replaceWith(...parts);
    }
    offset += text.length;
  }
  return element;
};

export const highlightTargetInExample = (value, segments, target, type) => {
  const cleaned = String(target || '').replace(/（[^）]*）|\([^)]*\)/g, '').trim();
  const core = part => part.replace(/^[AＡ]\s*|\s*[BＢ]$/g, '').trim();
  const exact = core(cleaned.replace(/[～〜]/g, ''));
  const alternatives = cleaned.split(/[～〜・／/]/).map(core).filter(Boolean);
  const candidates = [exact, ...alternatives];
  if (type === 'vocabulary') {
    // Keep the kanji stem visible for inflected idioms, without inventing readings.
    for (const part of [...candidates]) {
      if (part.includes('が')) candidates.push(part.replace('が', 'の'));
      if (/[\p{Script=Han}々]/u.test(part)) {
        const stem = part.endsWith('する') ? part.slice(0, -2) + 'し' : /[うくぐすつぬぶむる]$/.test(part) ? part.slice(0, -1) : '';
        if (stem.length >= 3) candidates.push(stem);
      }
    }
  }
  const matched = candidates.find(candidate => candidate && value.includes(candidate));
  const example = createRubyText('p', value, segments, 'grammar-example study-example-jp');
  return markRubyTarget(example, value, matched, 'study-target');
};

export function createStudyCard(item, index, selections = new Map(), onSelect = () => {}, knownState) {
  // The answer edition retains type=tips but supplies the complete grammar schema.
  const grammarTip = item.type === 'tips' && item.subtype === 'exam_tip_grammar' &&
    ['pattern', 'meaning', 'structure', 'usage', 'example_jp', 'example_vi'].every(key => typeof item[key] === 'string');
  if (item.type === 'grammar' || grammarTip) {
    const card = createGrammarCard(item);
    card.querySelector('.grammar-number').textContent = 'MẪU ' + (index + 1);
    return addKnownToggle(card, item, knownState);
  }
  const card = el('article', '', 'grammar-card study-card');
  card.append(el('span', (item.type === 'practice' ? 'CÂU ' : 'MỤC ') + (index + 1), 'grammar-number'));
  if (item.type === 'kanji') {
    card.append(el('h2', item.kanji, 'study-kanji', 'ja'));
    const dl = el('dl');
    for (const [label, value, lang] of [['Hán Việt', item.han_viet], ['Ý nghĩa', item.meaning_vi], ['Âm On', item.on_yomi, 'ja'], ['Âm Kun', item.kun_yomi, 'ja'], ['Chữ dễ nhầm', item.confusable?.join(' · '), 'ja']]) {
      if (value) dl.append(el('dt', label), el('dd', value, '', lang));
    }
    card.append(dl);
  } else if (item.type === 'vocabulary') {
    const lemma = item.lemma_jp || item.example_jp || '';
    card.append(createRubyText('h2', lemma, item.lemma_ruby, 'study-word'));
    const hasRuby = Array.isArray(item.lemma_ruby) && item.lemma_ruby.map(segment => segment.text).join('') === lemma;
    if (!hasRuby && item.reading) card.append(el('p', item.reading, '', 'ja'));
    const voice = item.ai_extra?.voice_vi || ({ intransitive: 'tự động từ', transitive: 'tha động từ' })[item.voice] || item.voice;
    const verbInfo = [item.particle, voice].filter(Boolean).join(' / ');
    if (verbInfo) card.append(el('p', verbInfo, 'study-verb-info'));
    if (item.collocates_with) card.append(el('p', item.collocates_with, 'study-collocation', 'ja'));
    if (item.meaning_vi) card.append(el('p', item.meaning_vi));
    if (item.example_jp) card.append(highlightTargetInExample(item.example_jp, item.example_ruby, item.connector_jp || item.lemma_jp, item.type));
    if (item.example_vi) card.append(el('p', item.example_vi, 'study-example-vi'));
  } else if (item.type === 'reading') {
    card.append(createRubyText('h2', item.connector_jp || '', item.connector_ruby, 'study-connector'));
    if (item.section) card.append(el('small', item.section, 'study-section'));
    if (item.meaning_vi) card.append(el('p', item.meaning_vi));
    if (item.example_jp) card.append(highlightTargetInExample(item.example_jp, item.example_ruby, item.connector_jp || item.lemma_jp, item.type));
  } else if (item.type === 'tips') {
    card.append(el('h2', item.label || item.title || 'Ghi chú ôn tập', 'study-connector'));
    const hasBody = typeof item.body === 'string' && item.body.trim().length > 0;
    card.append(el('p', hasBody ? item.body : 'Nội dung đang đối chiếu từ PDF', 'study-tip-body'));
    if (!hasBody) card.append(el('span', 'Cần đối chiếu', 'study-badge'));
  } else if (item.type === 'practice') {
    const resultBadge = el('span', '', 'study-result');
    resultBadge.hidden = true;
    card.append(resultBadge);
    const stemText = item.stem_jp || item.lemma_jp || '';
    const stemRuby = item.stem_ruby || (!item.stem_jp ? item.lemma_ruby : undefined);
    card.append(createPracticeStem(stemText, stemRuby, item.target, item.subtype === 'kanji_reading_mcq'));
    const options = el('div', '', 'study-options');
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', 'Lựa chọn cho câu ' + (index + 1));
    const feedback = el('p', '', 'study-feedback');
    feedback.setAttribute('role', 'status');
    const detail = el('section', '', 'study-explain');
    detail.setAttribute('aria-label', 'Chi tiết giải thích đáp án');
    detail.hidden = true;
    const detailToggle = el('button', 'Xem giải thích', 'study-explain-toggle');
    detailToggle.type = 'button';
    detailToggle.hidden = true;
    detailToggle.setAttribute('aria-haspopup', 'dialog');
    detailToggle.setAttribute('aria-controls', 'study-explanation-dialog');
    detailToggle.addEventListener('click', () => openStudyExplanation(detail, index, detailToggle));
    const showExplanation = selectedKey => {
      const content = [el('h4', 'Chi tiết')];
      if (item.explanation) content.push(el('p', item.explanation, 'study-explain-summary'));
      const rows = Array.isArray(item.choice_analyses) ? [...item.choice_analyses] : [];
      rows.sort((a, b) => String(a.key).localeCompare(String(b.key), 'en', { numeric: true }));
      if (rows.length) {
        const list = el('ul', '', 'study-explain-list');
        for (const row of rows) {
          const statusClass = ['correct', 'wrong'].includes(row.status) ? ' study-explain-' + row.status : '';
          const selected = String(row.key) === selectedKey;
          const li = el('li', '', 'study-explain-item' + statusClass + (selected ? ' study-explain-selected' : ''));
          const heading = el('strong');
          heading.append(el('span', row.key + '. ' + row.text_jp, '', 'ja'));
          if (row.meaning_vi) heading.append(el('span', ' — ' + row.meaning_vi));
          li.append(heading);
          if (selected) li.append(el('small', 'Bạn chọn', 'study-explain-choice'));
          if (row.reason_vi) li.append(el('p', row.reason_vi));
          list.append(li);
        }
        content.push(list);
      }
      detail.replaceChildren(...content);
      detailToggle.hidden = !item.explanation && !rows.length;

    };
    const keyed = hasAnswer(item);
    if (!keyed) card.append(el('small', 'Chưa có đáp án · Chọn để tự ôn, không chấm điểm.'));
    let restoring = false;
    for (const choice of item.choices) {
      const button = el('button', choice.key + '. ' + choice.text_jp, 'study-option', 'ja');
      button.type = 'button';
      button.dataset.key = String(choice.key);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        selections.set(item.id, String(choice.key));
        for (const other of options.children) { other.setAttribute('aria-pressed', 'false'); delete other.dataset.result; }
        button.setAttribute('aria-pressed', 'true');
        if (!keyed) {
          feedback.dataset.state = 'neutral';
          feedback.textContent = 'Đã chọn ' + choice.key + '. Tài liệu chưa cung cấp đáp án để đối chiếu.';
          if (!restoring) onSelect(item, String(choice.key));
          return;
        }
        const answer = item.choices.find(option => String(option.key) === String(item.correct_answer));
        const correct = String(choice.key) === String(item.correct_answer);
        button.dataset.result = correct ? 'correct' : 'incorrect';
        if (!correct) {
          const answerButton = [...options.children].find(other => other.dataset.key === String(item.correct_answer));
          if (answerButton) answerButton.dataset.result = 'correct';
        }
        feedback.dataset.state = correct ? 'ok' : 'wrong';
        resultBadge.className = 'study-result ' + (correct ? 'study-result-ok' : 'study-result-bad');
        resultBadge.textContent = correct ? '✓ Đúng' : '✗ Sai';
        resultBadge.hidden = false;
        feedback.textContent = (correct ? 'Chính xác. ' : 'Chưa đúng. Đáp án: ' + answer.key + '. ' + answer.text_jp + '. ') + (item.meaning_vi || '');
        showExplanation(String(choice.key));
        if (!restoring) onSelect(item, String(choice.key));
      });
      options.append(button);
    }
    // Restore only after all options exist so the answer can be highlighted too.
    const selectedButton = [...options.children].find(button => button.dataset.key === selections.get(item.id));
    if (selectedButton) { restoring = true; selectedButton.click(); restoring = false; }
    card.append(options, feedback, detailToggle, detail);
    if (item.stem_gloss_vi) {
      const hint = el('details', '', 'grammar-details');
      hint.append(el('summary', 'Gợi ý nghĩa tiếng Việt'), el('p', item.stem_gloss_vi));
      card.append(hint);
    }
  }
  if (item.needs_verify && item.type !== 'practice' && !card.querySelector('.study-badge')) card.append(el('span', 'Cần đối chiếu', 'study-badge'));
  return addKnownToggle(card, item, knownState);
}

async function startStudy() {
  const list = document.getElementById('study-list');
  if (!list) return;
  const title = document.getElementById('study-title');
  const status = document.getElementById('study-status');
  const search = document.getElementById('study-search');
  const back = document.getElementById('study-back');
  const notice = document.getElementById('study-notice');
  const retry = document.getElementById('study-retry');
  const dialog = document.getElementById('study-explanation-dialog');
  document.getElementById('study-explanation-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  const cache = new Map();
  let selections = new Map(), results = new Map();
  const progress = document.getElementById('study-progress');
  const progressText = document.getElementById('study-progress-text');
  const progressBar = document.getElementById('study-progress-bar');
  const okFill = document.getElementById('study-progress-ok');
  const badFill = document.getElementById('study-progress-bad');
  const filters = document.getElementById('study-progress-filters');
  const progressMenu = document.getElementById('study-progress-menu');
  const retryWrong = document.getElementById('study-retry-wrong');
  const resetTopic = document.getElementById('study-reset-topic');
  const knownProgress = document.getElementById('study-known-progress');
  const knownText = document.getElementById('study-known-text');
  const knownBar = document.getElementById('study-known-bar');
  const knownFill = document.getElementById('study-known-fill');
  const knownFilters = document.getElementById('study-known-filters');
  const flashRoot = document.getElementById('study-flash');
  const flashFab = document.getElementById('study-flash-fab');
  const flashFabMenu = document.getElementById('study-flash-fab-menu');
  const flashStart = document.getElementById('study-flash-start');
  const flashFabUnknown = document.getElementById('study-flash-fab-unknown');
  const flashFabAll = document.getElementById('study-flash-fab-all');
  const flashCounter = document.getElementById('study-flash-counter');
  const flashShuffle = document.getElementById('study-flash-shuffle');
  const flashExit = document.getElementById('study-flash-exit');
  const flashCard = document.getElementById('study-flash-card');
  const flashHead = document.getElementById('study-flash-head');
  const flashAnswer = document.getElementById('study-flash-answer');
  const flashMeaning = document.getElementById('study-flash-meaning');
  const flashExample = document.getElementById('study-flash-example');
  const flashFrontActions = document.getElementById('study-flash-front-actions');
  const flashBackActions = document.getElementById('study-flash-back-actions');
  const flashReveal = document.getElementById('study-flash-reveal');
  const flashMarkKnown = document.getElementById('study-flash-mark-known');
  const flashMarkUnknown = document.getElementById('study-flash-mark-unknown');
  const flashNext = document.getElementById('study-flash-next');
  const flashDone = document.getElementById('study-flash-done');
  const flashDoneTitle = document.getElementById('study-flash-done-title');
  const flashDoneText = document.getElementById('study-flash-done-text');
  const flashRetryUnknown = document.getElementById('study-flash-retry-unknown');
  const flashRetryAll = document.getElementById('study-flash-retry-all');
  const flashBackList = document.getElementById('study-flash-back-list');
  let known = new Set(), knownMode = false, knownFilter = 'all';
  let flashActive = false, flashQueue = [], flashIndex = 0, flashRevealed = false, flashReviewed = 0, flashAllMode = false;
  const knownFilterButtons = [];
  const setFlashMenuOpen = open => {
    flashFabMenu.hidden = !open;
    flashStart.setAttribute('aria-expanded', String(open));
  };
  const setFlashHash = enabled => {
    if (!topic) return;
    const next = '#' + topic.id + (enabled ? '?mode=flash' : '');
    if (location.hash !== next) history.replaceState(null, '', next);
  };
  const updateKnownProgress = () => {
    knownProgress.hidden = !knownMode;
    const showFab = knownMode && items.length > 0 && !flashActive;
    flashFab.hidden = !showFab;
    if (!showFab) setFlashMenuOpen(false);
    const total = knownMode ? items.length : 0;
    const done = knownMode ? known.size : 0;
    knownText.textContent = total ? `Đã thuộc ${done}/${total}` : 'Đã thuộc 0/0';
    const percentage = total ? Math.round(done / total * 100) : 0;
    knownBar.setAttribute('aria-valuenow', String(percentage));
    knownBar.setAttribute('aria-valuetext', `Đã thuộc ${done}, còn ${Math.max(0, total - done)} trên ${total}`);
    knownFill.style.width = (total ? done / total * 100 : 0) + '%';
    for (const button of knownFilterButtons) button.setAttribute('aria-pressed', String(button.dataset.filter === knownFilter));
  };
  const onKnownChange = () => {
    saveStudyKnown(topic.id, known); updateKnownProgress();
    if (flashActive) return;
    if (knownFilter !== 'all') {
      render();
      knownFilterButtons.find(button => button.dataset.filter === knownFilter).focus({ preventScroll: true });
    }
  };
  const buildFlashQueue = ({ all = false } = {}) => {
    let queue = all ? [...items] : items.filter(item => !known.has(item.id));
    if (flashShuffle.checked) queue = shuffleItems(queue);
    return queue;
  };
  const showFlashDone = ({ emptyUnknown = false } = {}) => {
    flashCard.hidden = true;
    flashDone.hidden = false;
    const unknownLeft = items.filter(item => !known.has(item.id)).length;
    flashDoneTitle.textContent = emptyUnknown ? 'Đã ôn hết mục chưa thuộc' : 'Đã ôn hết';
    flashDoneText.textContent = `Đã ôn ${flashReviewed} mục · Đã thuộc tổng ${known.size} / ${items.length}`;
    flashRetryUnknown.disabled = unknownLeft === 0;
    flashRetryUnknown.focus();
  };
  const paintFlashCard = () => {
    const item = flashQueue[flashIndex];
    if (!item) { showFlashDone(); return; }
    flashCard.hidden = false;
    flashDone.hidden = true;
    flashRevealed = false;
    flashCounter.textContent = `${flashIndex + 1} / ${flashQueue.length} còn lại`;
    const head = flashHeadForItem(item);
    flashHead.replaceChildren();
    if (head.text) {
      const node = createRubyText('div', head.text, head.ruby, head.className);
      if (head.lang) node.lang = head.lang;
      flashHead.append(node);
    } else {
      flashHead.append(el('div', '—', head.className));
    }
    flashMeaning.replaceChildren();
    flashExample.replaceChildren();
    flashAnswer.hidden = true;
    flashFrontActions.hidden = false;
    flashBackActions.hidden = true;
    flashReveal.focus({ preventScroll: true });
  };
  const revealFlash = () => {
    const item = flashQueue[flashIndex];
    if (!item || flashRevealed) return;
    flashRevealed = true;
    const meaning = flashMeaningForItem(item);
    flashMeaning.replaceChildren(meaning ? el('p', meaning) : el('p', 'Chưa có nghĩa trong tài liệu.'));
    flashExample.replaceChildren();
    if (item.example_jp) {
      flashExample.append(highlightTargetInExample(item.example_jp, item.example_ruby, flashExampleTarget(item), item.type));
    }
    flashAnswer.hidden = false;
    flashFrontActions.hidden = true;
    flashBackActions.hidden = false;
    flashNext.focus({ preventScroll: true });
  };
  const advanceFlash = () => {
    flashReviewed += 1;
    if (flashIndex >= flashQueue.length - 1) {
      showFlashDone();
      return;
    }
    flashIndex += 1;
    paintFlashCard();
  };
  const enterFlashMode = ({ all = false } = {}) => {
    if (!knownMode || !items.length) return;
    setFlashMenuOpen(false);
    flashAllMode = all;
    flashQueue = buildFlashQueue({ all });
    flashIndex = 0;
    flashReviewed = 0;
    flashActive = true;
    flashRoot.hidden = false;
    document.body.classList.add('study-flash-active');
    setFlashHash(true);
    updateKnownProgress();
    if (!flashQueue.length) {
      showFlashDone({ emptyUnknown: !all });
      return;
    }
    paintFlashCard();
    window.scrollTo(0, 0);
  };
  const exitFlashMode = ({ renderList = true, updateHash = true } = {}) => {
    if (!flashActive && flashRoot.hidden) return;
    flashActive = false;
    flashQueue = [];
    flashIndex = 0;
    flashRevealed = false;
    flashRoot.hidden = true;
    flashCard.hidden = false;
    flashDone.hidden = true;
    document.body.classList.remove('study-flash-active');
    if (updateHash) setFlashHash(false);
    updateKnownProgress();
    if (renderList) render();
  };
  const matchesKnownFilter = item => !knownMode || knownFilter === 'all' || (knownFilter === 'known' ? known.has(item.id) : !known.has(item.id));
  for (const [mode, label] of [['all', 'Tất cả'], ['unknown', 'Chưa thuộc'], ['known', 'Đã thuộc']]) {
    const button = el('button', label);
    button.type = 'button'; button.dataset.filter = mode;
    button.addEventListener('click', () => { knownFilter = mode; render(); });
    knownFilters.append(button); knownFilterButtons.push(button);
  }
  flashStart.addEventListener('click', () => setFlashMenuOpen(flashFabMenu.hidden));
  flashFabUnknown.addEventListener('click', () => enterFlashMode({ all: false }));
  flashFabAll.addEventListener('click', () => enterFlashMode({ all: true }));
  document.addEventListener('click', event => {
    if (flashFabMenu.hidden || flashFab.contains(event.target)) return;
    setFlashMenuOpen(false);
  });
  flashExit.addEventListener('click', () => exitFlashMode());
  flashBackList.addEventListener('click', () => exitFlashMode());
  flashReveal.addEventListener('click', event => { event.stopPropagation(); revealFlash(); });
  flashCard.addEventListener('click', event => {
    if (event.target.closest('button, a, input, label')) return;
    if (flashDone.hidden === false) return;
    if (!flashRevealed) revealFlash();
  });
  flashCard.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') {
      if (flashRevealed || !flashDone.hidden) return;
      event.preventDefault();
      revealFlash();
    }
  });
  flashMarkKnown.addEventListener('click', event => {
    event.stopPropagation();
    const item = flashQueue[flashIndex];
    if (!item) return;
    known.add(item.id);
    onKnownChange();
    advanceFlash();
  });
  flashMarkUnknown.addEventListener('click', event => {
    event.stopPropagation();
    const item = flashQueue[flashIndex];
    if (!item) return;
    known.delete(item.id);
    onKnownChange();
    advanceFlash();
  });
  flashNext.addEventListener('click', event => {
    event.stopPropagation();
    advanceFlash();
  });
  flashRetryUnknown.addEventListener('click', () => enterFlashMode({ all: false }));
  flashRetryAll.addEventListener('click', () => enterFlashMode({ all: true }));
  let filterMode = 'all', gradable = [], practiceItems = [];
  let viewMode = 'list', sessionQueue = [], sessionIndex = 0, sessionLimit = null;
  const filterButtons = [];
  const viewModeNav = document.getElementById('study-view-mode');
  const sessionNav = document.getElementById('study-session-nav');
  const sessionText = document.getElementById('study-session-text');
  const sessionPrev = document.getElementById('study-session-prev');
  const sessionSkip = document.getElementById('study-session-skip');
  const sessionNext = document.getElementById('study-session-next');
  const session20 = document.getElementById('study-session-20');
  const filterDrawer = document.getElementById('study-filter-drawer');
  const viewModeButtons = [];
  const persist = () => { if (topic) saveStudyProgress(topic.id, selections, results); };
  const isPracticeTopic = () => practiceItems.length > 0;
  const wrongCount = () => practiceItems.filter(item => results.get(item.id) === 'wrong').length;
  const practiceAllDone = () => practiceItems.length > 0 && practiceItems.every(item => isPracticeAnswered(item, selections, results));
  const syncFilterDrawer = () => {
    if (!filterDrawer) return;
    filterDrawer.hidden = !isPracticeTopic();
    if (window.matchMedia('(min-width: 768px)').matches) filterDrawer.open = true;
  };
  const createPracticeCompleteBanner = () => {
    const panel = el('div', '', 'study-complete');
    const wrong = wrongCount();
    panel.append(el('h2', 'Đã làm hết bộ này'));
    panel.append(el('p', wrong
      ? `Hoàn thành ${practiceItems.length} câu · ${wrong} câu sai. Ôn lại phần sai trước khi chuyển bộ khác.`
      : `Hoàn thành ${practiceItems.length} câu. Tiến độ vẫn lưu trên thiết bị này.`));
    if (wrong) {
      const review = el('button', 'Ôn câu sai', 'study-complete-action');
      review.type = 'button';
      review.addEventListener('click', () => {
        filterMode = 'wrong';
        sessionLimit = null;
        viewMode = 'session';
        refreshSessionQueue({ preferTodo: true });
        render();
        window.scrollTo(0, 0);
      });
      panel.append(review);
    }
    const toListWrong = el('button', 'Xem danh sách câu sai', 'study-complete-action study-complete-secondary');
    toListWrong.type = 'button';
    toListWrong.hidden = !wrong;
    toListWrong.addEventListener('click', () => {
      filterMode = 'wrong';
      viewMode = 'list';
      sessionLimit = null;
      render();
    });
    const toSession = el('button', 'Làm lại kiểu phiên', 'study-complete-action study-complete-secondary');
    toSession.type = 'button';
    toSession.addEventListener('click', () => {
      filterMode = wrong ? 'wrong' : 'all';
      viewMode = 'session';
      sessionLimit = null;
      refreshSessionQueue({ preferTodo: false });
      sessionIndex = 0;
      render();
      window.scrollTo(0, 0);
    });
    panel.append(toListWrong, toSession);
    return panel;
  };
  const createPracticeEmptyState = () => {
    const panel = el('div', '', 'study-empty');
    const title = filterMode === 'wrong' ? 'Không còn câu sai'
      : filterMode === 'todo' ? 'Không còn câu chưa làm'
      : filterMode === 'ok' ? 'Chưa có câu đúng'
      : 'Không tìm thấy câu hỏi';
    panel.append(el('h2', title));
    panel.append(el('p', practiceAllDone()
      ? 'Bạn đã làm hết bộ này. Có thể ôn lại câu sai hoặc xem toàn bộ danh sách.'
      : 'Thử đổi bộ lọc, xóa từ khóa tìm kiếm, hoặc mở chế độ Phiên.'));
    if (wrongCount()) {
      const review = el('button', 'Ôn câu sai', 'study-complete-action');
      review.type = 'button';
      review.addEventListener('click', () => {
        filterMode = 'wrong';
        viewMode = 'session';
        sessionLimit = null;
        refreshSessionQueue({ preferTodo: true });
        render();
      });
      panel.append(review);
    }
    const showAll = el('button', 'Hiện tất cả', 'study-complete-action study-complete-secondary');
    showAll.type = 'button';
    showAll.addEventListener('click', () => {
      filterMode = 'all';
      search.value = '';
      sessionLimit = null;
      if (viewMode === 'session') refreshSessionQueue({ preferTodo: true });
      render();
    });
    panel.append(showAll);
    return panel;
  };
  const matchesFilter = item => {
    if (!isPracticeTopic() || item.type !== 'practice' || filterMode === 'all') return true;
    const answered = isPracticeAnswered(item, selections, results);
    const result = results.get(item.id);
    if (filterMode === 'todo') return !answered;
    if (filterMode === 'wrong') return result === 'wrong';
    if (filterMode === 'ok') return result === 'ok';
    return true;
  };
  const refreshSessionQueue = ({ keepIndex = false, preferTodo = true } = {}) => {
    const previousId = keepIndex ? sessionQueue[sessionIndex]?.id : null;
    sessionQueue = buildPracticeSessionQueue(items, selections, results, {
      query: search.value,
      filterMode,
      limit: sessionLimit,
    });
    if (!sessionQueue.length) {
      sessionIndex = 0;
      return;
    }
    if (previousId) {
      const found = sessionQueue.findIndex(item => item.id === previousId);
      if (found >= 0) { sessionIndex = found; return; }
    }
    if (preferTodo) {
      const firstTodo = sessionQueue.findIndex(item => !isPracticeAnswered(item, selections, results));
      sessionIndex = firstTodo >= 0 ? firstTodo : 0;
    } else {
      sessionIndex = Math.min(sessionIndex, sessionQueue.length - 1);
    }
  };
  const updateViewMode = () => {
    const show = isPracticeTopic() && !!topic;
    viewModeNav.hidden = !show;
    search.hidden = show && viewMode === 'session';
    document.querySelector('label[for="study-search"]')?.toggleAttribute('hidden', show && viewMode === 'session');
    for (const button of viewModeButtons) button.setAttribute('aria-pressed', String(button.dataset.mode === viewMode));
    sessionNav.hidden = !(show && viewMode === 'session');
    document.body.classList.toggle('study-session-active', show && viewMode === 'session');
  };
  const updateSessionNav = () => {
    if (!(isPracticeTopic() && viewMode === 'session')) {
      sessionNav.hidden = true;
      return;
    }
    sessionNav.hidden = false;
    const total = sessionQueue.length;
    if (!total) {
      sessionText.textContent = 'Không còn câu trong phiên này.';
      sessionPrev.disabled = true;
      sessionSkip.disabled = true;
      sessionNext.disabled = true;
      sessionNext.classList.remove('is-ready');
      return;
    }
    const current = sessionQueue[sessionIndex];
    const answered = current && isPracticeAnswered(current, selections, results);
    sessionText.textContent = `Phiên · Câu ${sessionIndex + 1} / ${total}` + (sessionLimit ? ` (tối đa ${sessionLimit})` : '') + (answered ? ' · Đã chọn' : '');
    sessionPrev.disabled = sessionIndex <= 0;
    sessionSkip.disabled = sessionIndex >= total - 1 && answered;
    sessionNext.disabled = false;
    sessionNext.textContent = sessionIndex >= total - 1 ? (answered ? 'Xong phiên' : 'Câu này') : 'Câu tiếp';
    sessionNext.classList.toggle('is-ready', !!answered && sessionIndex < total - 1);
  };
  const updateProgress = () => {
    const show = isPracticeTopic();
    progress.hidden = !show;
    if (!show) return;
    if (gradable.length) {
      const ok = gradable.filter(item => results.get(item.id) === 'ok').length;
      const bad = gradable.filter(item => results.get(item.id) === 'wrong').length;
      const total = gradable.length;
      progressText.textContent = `Đúng ${ok} · Sai ${bad} · Còn ${total - ok - bad} / ${total}`;
      progressBar.setAttribute('aria-valuenow', String(total ? Math.round((ok + bad) / total * 100) : 0));
      progressBar.setAttribute('aria-valuetext', progressText.textContent);
      okFill.style.width = (total ? ok / total * 100 : 0) + '%';
      badFill.style.width = (total ? bad / total * 100 : 0) + '%';
      retryWrong.disabled = !bad;
      session20.disabled = !gradable.some(item => !results.has(item.id));
    } else {
      const total = practiceItems.length;
      const done = practiceItems.filter(item => selections.has(item.id)).length;
      progressText.textContent = `Đã chọn ${done} · Còn ${total - done} / ${total}`;
      progressBar.setAttribute('aria-valuenow', String(total ? Math.round(done / total * 100) : 0));
      progressBar.setAttribute('aria-valuetext', progressText.textContent);
      okFill.style.width = (total ? done / total * 100 : 0) + '%';
      badFill.style.width = '0%';
      retryWrong.disabled = true;
      session20.disabled = !practiceItems.some(item => !selections.has(item.id));
    }
    for (const button of filterButtons) button.setAttribute('aria-pressed', String(button.dataset.filter === filterMode));
    syncFilterDrawer();
    updateSessionNav();
  };
  const onSelect = (item, key) => {
    if (hasAnswer(item)) results.set(item.id, key === String(item.correct_answer) ? 'ok' : 'wrong');
    persist(); updateProgress();
    if (viewMode === 'session') {
      updateSessionNav();
      if (sessionIndex < sessionQueue.length - 1) sessionNext.focus({ preventScroll: true });
      return;
    }
    if (filterMode !== 'all') render();
  };
  for (const [mode, label] of [['list', 'Danh sách'], ['session', 'Phiên']]) {
    const button = el('button', label);
    button.type = 'button';
    button.dataset.mode = mode;
    button.addEventListener('click', () => {
      viewMode = mode;
      sessionLimit = null;
      if (mode === 'session') refreshSessionQueue({ preferTodo: true });
      render();
      window.scrollTo(0, 0);
    });
    viewModeNav.append(button);
    viewModeButtons.push(button);
  }
  for (const [mode, label] of [['all', 'Tất cả'], ['todo', 'Chưa làm'], ['wrong', 'Câu sai'], ['ok', 'Câu đúng']]) {
    const button = el('button', label);
    button.type = 'button'; button.dataset.filter = mode;
    button.addEventListener('click', () => {
      progressMenu.open = false;
      filterMode = mode;
      sessionLimit = null;
      if (viewMode === 'session') refreshSessionQueue({ preferTodo: true });
      render();
    });
    filters.append(button); filterButtons.push(button);
  }
  const goSession = delta => {
    if (!sessionQueue.length) return;
    const next = sessionIndex + delta;
    if (next < 0) return;
    if (next >= sessionQueue.length) {
      viewMode = 'list';
      sessionLimit = null;
      render();
      status.textContent = 'Đã hết phiên. Có thể mở lại Phiên hoặc chọn “20 câu chưa làm”.';
      window.scrollTo(0, 0);
      return;
    }
    sessionIndex = next;
    render();
    window.scrollTo(0, 0);
  };
  sessionPrev.addEventListener('click', () => goSession(-1));
  sessionSkip.addEventListener('click', () => goSession(1));
  sessionNext.addEventListener('click', () => {
    const current = sessionQueue[sessionIndex];
    if (current && !isPracticeAnswered(current, selections, results) && sessionIndex >= sessionQueue.length - 1) return;
    goSession(1);
  });
  session20.addEventListener('click', () => {
    progressMenu.open = false;
    filterMode = 'todo';
    sessionLimit = SESSION_SHORT;
    viewMode = 'session';
    refreshSessionQueue({ preferTodo: true });
    render();
    window.scrollTo(0, 0);
  });
  retryWrong.addEventListener('click', () => {
    for (const [id, result] of results) if (result === 'wrong') { results.delete(id); selections.delete(id); }
    persist(); progressMenu.open = false; filterMode = 'todo'; sessionLimit = null; viewMode = 'session';
    refreshSessionQueue({ preferTodo: true });
    render();
  });
  resetTopic.addEventListener('click', () => {
    if (!window.confirm('Xóa toàn bộ tiến độ của bộ tài liệu này?')) return;
    selections.clear(); results.clear(); persist(); progressMenu.open = false; filterMode = 'all';
    sessionLimit = null; viewMode = 'list'; sessionQueue = []; sessionIndex = 0; render();
  });
  window.addEventListener('keydown', event => {
    if (!ready || dialog.open) return;
    if (flashActive) {
      if (event.key === 'Escape') {
        event.preventDefault();
        exitFlashMode();
      }
      return;
    }
    if (!flashFabMenu.hidden && event.key === 'Escape') {
      event.preventDefault();
      setFlashMenuOpen(false);
      flashStart.focus();
      return;
    }
    if (!isPracticeTopic() || viewMode !== 'session') return;
    if (event.target.closest('input, textarea, select')) return;
    if (event.key >= '1' && event.key <= '9') {
      const option = list.querySelectorAll('.study-option')[Number(event.key) - 1];
      if (!option) return;
      event.preventDefault();
      option.click();
      return;
    }
    if (event.key === 'Enter') {
      if (sessionNext.disabled) return;
      event.preventDefault();
      sessionNext.click();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      sessionSkip.click();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      sessionPrev.click();
    }
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', syncFilterDrawer);
  let topics, topic, items = [], version = 0, ready = false, groupFilter = 'all';
  let restoreCatalogScroll = null;
  const persistCatalogUi = () => {
    if (topic || !ready) return;
    saveCatalogState({ scrollY: window.scrollY, groupFilter, search: search.value });
  };
  const groupNav = document.getElementById('study-group-filters');
  const groupButtons = [];
  for (const [mode, label] of [['all', 'Tất cả'], ...STUDY_GROUPS.map(group => [group.id, group.label])]) {
    const button = el('button', label);
    button.type = 'button';
    button.dataset.group = mode;
    button.addEventListener('click', () => { groupFilter = mode; render(); persistCatalogUi(); });
    groupNav.append(button);
    groupButtons.push(button);
  }
  const updateGroupFilters = () => {
    const catalog = !topic;
    groupNav.hidden = !catalog;
    for (const button of groupButtons) button.setAttribute('aria-pressed', String(button.dataset.group === groupFilter));
  };
  const renderCatalog = matches => {
    const nodes = [];
    for (const group of STUDY_GROUPS) {
      if (groupFilter !== 'all' && groupFilter !== group.id) continue;
      const groupTopics = matches.filter(item => topicGroupId(item) === group.id);
      if (!groupTopics.length) continue;
      const section = el('section', '', 'study-group');
      section.setAttribute('aria-labelledby', 'study-group-' + group.id);
      const heading = el('h2', group.label, 'study-group-heading');
      heading.id = 'study-group-' + group.id;
      const count = el('span', ' · ' + groupTopics.length + ' bộ', 'study-group-count');
      heading.append(count);
      const grid = el('div', '', 'study-group-list grammar-list');
      for (const item of groupTopics) grid.append(createTopicCard(item));
      section.append(heading, grid);
      nodes.push(section);
    }
    list.replaceChildren(...nodes);
  };
  const renderSessionDone = () => {
    if (practiceAllDone()) {
      list.replaceChildren(createPracticeCompleteBanner());
      return;
    }
    const panel = el('div', '', 'study-session-done');
    panel.append(el('h2', 'Hết phiên'));
    panel.append(el('p', sessionLimit
      ? `Đã hết ${sessionLimit} câu trong phiên ngắn. Tiến độ vẫn được lưu trên thiết bị.`
      : 'Không còn câu phù hợp bộ lọc hiện tại.'));
    if (wrongCount()) {
      const review = el('button', 'Ôn câu sai', 'study-session-done-action');
      review.type = 'button';
      review.addEventListener('click', () => {
        filterMode = 'wrong';
        sessionLimit = null;
        refreshSessionQueue({ preferTodo: true });
        render();
      });
      panel.append(review);
    }
    const again = el('button', '20 câu chưa làm', 'study-session-done-action');
    again.type = 'button';
    again.addEventListener('click', () => session20.click());
    const toList = el('button', 'Xem danh sách', 'study-session-done-action study-session-done-secondary');
    toList.type = 'button';
    toList.addEventListener('click', () => { viewMode = 'list'; sessionLimit = null; render(); });
    panel.append(again, toList);
    list.replaceChildren(panel);
  };
  const render = () => {
    if (!ready) return;
    if (flashActive) {
      updateGroupFilters();
      updateViewMode();
      updateProgress();
      updateKnownProgress();
      return;
    }
    updateGroupFilters();
    updateViewMode();
    if (isPracticeTopic() && viewMode === 'session') {
      if (!sessionQueue.length) refreshSessionQueue({ preferTodo: true });
      updateProgress();
      updateKnownProgress();
      if (!sessionQueue.length) {
        renderSessionDone();
        status.textContent = practiceAllDone()
          ? 'Đã làm hết bộ này.'
          : filterMode === 'wrong' ? 'Không còn câu sai trong phiên.' : 'Không còn câu chưa làm trong phiên.';
        return;
      }
      const item = sessionQueue[sessionIndex];
      if (!item) { renderSessionDone(); return; }
      const card = createStudyCard(item, items.indexOf(item), selections, onSelect);
      card.classList.add('study-session-card');
      list.replaceChildren(card);
      updateSessionNav();
      status.textContent = `Đang làm phiên · ${sessionIndex + 1} / ${sessionQueue.length}` + (topic ? ' ' + topic.unit : '');
      return;
    }
    updateProgress(); updateKnownProgress();
    const matches = filterStudy(items, search.value)
      .filter(matchesFilter)
      .filter(matchesKnownFilter)
      .filter(item => topic || groupFilter === 'all' || topicGroupId(item) === groupFilter);
    if (topic && isPracticeTopic() && !matches.length) {
      list.replaceChildren(createPracticeEmptyState());
      status.textContent = filterMode === 'wrong' ? 'Không còn câu sai.' : 'Không còn nội dung phù hợp bộ lọc.';
      return;
    }
    if (topic) {
      const cards = matches.map(item => createStudyCard(item, items.indexOf(item), selections, onSelect, knownMode ? { known, onChange: onKnownChange } : undefined));
      if (isPracticeTopic() && practiceAllDone() && filterMode === 'all' && !search.value.trim()) {
        list.replaceChildren(createPracticeCompleteBanner(), ...cards);
      } else {
        list.replaceChildren(...cards);
      }
    } else {
      renderCatalog(matches);
    }
    status.textContent = matches.length ? 'Hiển thị ' + matches.length + ' / ' + items.length + (topic ? ' ' + topic.unit : ' bộ tài liệu') + (search.value.trim() || (!topic && groupFilter !== 'all') ? ' phù hợp.' : '.') : filterMode === 'wrong' && !practiceItems.some(item => results.get(item.id) === 'wrong') ? 'Không còn câu sai.' : knownMode && !search.value.trim() && knownFilter === 'unknown' ? 'Bạn đã thuộc toàn bộ nội dung của bộ này.' : knownMode && !search.value.trim() && knownFilter === 'known' ? 'Chưa có mục nào được đánh dấu đã thuộc.' : !topic && groupFilter !== 'all' ? 'Không có bộ nào trong nhóm này.' : 'Không tìm thấy nội dung phù hợp. Hãy thử bộ lọc hoặc từ khóa khác.';
  };
  const load = async ({ restoreCatalog = false } = {}) => {
    const request = ++version;
    if (dialog.open) dialog.close();
    progressMenu.open = false;
    exitFlashMode({ renderList: false, updateHash: false });
    ready = false; progress.hidden = true; knownProgress.hidden = true;
    restoreCatalogScroll = null;
    list.replaceChildren(); retry.hidden = true; notice.hidden = true;
    list.setAttribute('aria-busy', 'true');
    status.textContent = 'Đang tải tài liệu…';
    const { id, flash: wantFlash } = parseStudyHash();
    title.textContent = 'Tài liệu ôn tập N3 tổng hợp';
    back.href = id ? '#' : './settings.html';
    back.setAttribute('aria-label', id ? 'Về danh mục tài liệu' : 'Về Cài đặt');
    try {
      const getJSON = async path => {
        const url = new URL(path, import.meta.url);
        url.searchParams.set('v', DATA_VERSION);
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      };
      if (!topics) topics = await getJSON('./study-data/topics.json');
      if (request !== version) return;
      const selected = topics.find(item => item.id === id);
      if (id && !selected) throw new Error('Unknown topic');
      title.textContent = selected?.title || 'Tài liệu ôn tập N3 tổng hợp';
      document.title = title.textContent + ' · JLPT N3';
      if (selected) {
        if (!cache.has(selected.id)) {
          const data = await getJSON(selected.path);
          if (!Array.isArray(data.items) || data.items.length !== selected.count) throw new Error('Invalid study data');
          cache.set(selected.id, data.items);
        }
        if (request !== version) return;
        items = cache.get(selected.id);
        notice.textContent = topicNotice(selected);
        notice.hidden = !topicNotice(selected);
      } else items = topics;
      topic = selected;
      ({ selections, results } = hydrateStudyProgress(items, topic ? loadStudyProgress()[topic.id] : {}));
      practiceItems = topic ? items.filter(item => item.type === 'practice') : [];
      gradable = practiceItems.filter(hasAnswer);
      filterMode = 'all';
      sessionLimit = null;
      sessionQueue = [];
      sessionIndex = 0;
      viewMode = practiceItems.length && practiceItems.length === items.length ? 'session' : 'list';
      const catalogState = !topic ? loadCatalogState() : null;
      if (!topic) {
        const allowed = new Set(['all', ...STUDY_GROUPS.map(group => group.id)]);
        groupFilter = catalogState && allowed.has(catalogState.groupFilter) ? catalogState.groupFilter : 'all';
        if (restoreCatalog && catalogState) {
          search.value = catalogState.search;
          restoreCatalogScroll = catalogState.scrollY;
        }
      }
      knownMode = !!topic && items.every(item => item.type !== 'practice') && items.some(item => ['reading', 'vocabulary', 'grammar', 'tips'].includes(item.type));
      known = knownMode ? hydrateStudyKnown(items, loadStudyKnown()[topic.id]) : new Set();
      knownFilter = 'all';
      search.hidden = false;
      document.querySelector('label[for="study-search"]')?.removeAttribute('hidden');
      search.placeholder = topic ? 'Tìm tiếng Nhật hoặc nghĩa tiếng Việt…' : 'Tìm tài liệu hoặc nhóm…';
      if (viewMode === 'session') refreshSessionQueue({ preferTodo: true });
      ready = true; render();
      if (wantFlash && knownMode) enterFlashMode({ all: false });
      else if (restoreCatalogScroll != null) {
        const y = restoreCatalogScroll;
        restoreCatalogScroll = null;
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
      }
    } catch {
      if (request !== version) return;
      status.textContent = id && topics && !topics.some(item => item.id === id) ? 'Không tìm thấy mục này. Nhấn mũi tên để về danh mục.' : 'Chưa tải được tài liệu. Kiểm tra kết nối rồi thử lại.';
      retry.hidden = false;
    } finally { if (request === version) list.setAttribute('aria-busy', 'false'); }
  };
  search.addEventListener('input', () => { render(); persistCatalogUi(); });
  retry.addEventListener('click', load);
  window.addEventListener('scroll', () => { if (!topic && ready) persistCatalogUi(); }, { passive: true });
  window.addEventListener('hashchange', () => {
    const nextId = parseStudyHash().id;
    const leavingCatalog = !topic && !!nextId;
    const returningToCatalog = !!topic && !nextId;
    if (leavingCatalog) persistCatalogUi();
    if (!returningToCatalog) {
      search.value = '';
      window.scrollTo(0, 0);
    }
    load({ restoreCatalog: returningToCatalog });
  });
  await load({ restoreCatalog: !parseStudyHash().id && !!loadCatalogState() });
}
if (typeof document !== 'undefined') startStudy();
