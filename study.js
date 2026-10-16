import { createGrammarCard, createRubyText } from './grammar.js';
const DATA_VERSION = new URL(import.meta.url).searchParams.get('v') || '26';

const el = (tag, value = '', className = '', lang) => {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  if (lang) node.lang = lang;
  return node;
};
const normalize = value => String(value).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const searchable = value => Array.isArray(value) ? value.map(searchable).join(' ') : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => !/^(source|content_source|verify_reason|id|knowledge_id|ai_extra|ruby_source)/.test(key)).map(([, v]) => searchable(v)).join(' ') : typeof value === 'string' ? value : '';
export const filterStudy = (items, query) => items.filter(item => normalize(searchable(item)).includes(normalize(query.trim())));
export const hasAnswer = item => item.correct_answer != null && item.choices.some(choice => String(choice.key) === String(item.correct_answer));
const topicNotice = topic => (topic.notice || '').replace(/(?:Cần )?UI type=reading(?: \(xem PROMPT\))?\.\s*/g, '');

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
  const stem = createRubyText('p', value, segments, 'study-stem');
  if (start < 0) return stem;
  const end = start + target.length;
  const textNodes = [];
  const collect = node => {
    if (node.nodeType === 3) { textNodes.push(node); return; }
    // Readings and ruby fallback punctuation are not part of the base sentence.
    if (node.localName === 'rt' || node.localName === 'rp') return;
    for (const child of node.childNodes) collect(child);
  };
  collect(stem);
  let offset = 0;
  for (const node of textNodes) {
    const text = node.textContent;
    const from = Math.max(0, start - offset);
    const to = Math.min(text.length, end - offset);
    if (from < to) {
      const parts = [];
      if (from) parts.push(document.createTextNode(text.slice(0, from)));
      parts.push(el('mark', text.slice(from, to)));
      if (to < text.length) parts.push(document.createTextNode(text.slice(to)));
      node.replaceWith(...parts);
    }
    offset += text.length;
  }
  return stem;
};

export function createStudyCard(item, index, selections = new Map(), onSelect = () => {}) {
  // The answer edition retains type=tips but supplies the complete grammar schema.
  const grammarTip = item.type === 'tips' && item.subtype === 'exam_tip_grammar' &&
    ['pattern', 'meaning', 'structure', 'usage', 'example_jp', 'example_vi'].every(key => typeof item[key] === 'string');
  if (item.type === 'grammar' || grammarTip) {
    const card = createGrammarCard(item);
    card.querySelector('.grammar-number').textContent = 'MẪU ' + (index + 1);
    return card;
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
    if (item.example_jp) card.append(createRubyText('p', item.example_jp, item.example_ruby, 'grammar-example study-example-jp'));
    if (item.example_vi) card.append(el('p', item.example_vi, 'study-example-vi'));
  } else if (item.type === 'reading') {
    card.append(createRubyText('h2', item.connector_jp || '', item.connector_ruby, 'study-connector'));
    if (item.section) card.append(el('small', item.section, 'study-section'));
    if (item.meaning_vi) card.append(el('p', item.meaning_vi));
    if (item.example_jp) card.append(createRubyText('p', item.example_jp, item.example_ruby, 'grammar-example study-example-jp'));
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
  return card;
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
  let filterMode = 'all', gradable = [];
  const filterButtons = [];
  const persist = () => { if (topic) saveStudyProgress(topic.id, selections, results); };
  const matchesFilter = item => {
    if (!gradable.length || item.type !== 'practice' || filterMode === 'all') return true;
    const result = results.get(item.id);
    return filterMode === 'todo' ? !result : result === filterMode;
  };
  const updateProgress = () => {
    progress.hidden = !gradable.length;
    const ok = gradable.filter(item => results.get(item.id) === 'ok').length;
    const bad = gradable.filter(item => results.get(item.id) === 'wrong').length;
    const total = gradable.length;
    progressText.textContent = `Đúng ${ok} · Sai ${bad} · Còn ${total - ok - bad} / ${total}`;
    progressBar.setAttribute('aria-valuenow', String(total ? Math.round((ok + bad) / total * 100) : 0));
    progressBar.setAttribute('aria-valuetext', progressText.textContent);
    okFill.style.width = (total ? ok / total * 100 : 0) + '%';
    badFill.style.width = (total ? bad / total * 100 : 0) + '%';
    for (const button of filterButtons) button.setAttribute('aria-pressed', String(button.dataset.filter === filterMode));
    retryWrong.disabled = !bad;
  };
  const onSelect = (item, key) => {
    if (hasAnswer(item)) results.set(item.id, key === String(item.correct_answer) ? 'ok' : 'wrong');
    persist(); updateProgress();
    if (filterMode !== 'all') render();
  };
  for (const [mode, label] of [['all', 'Tất cả'], ['todo', 'Chưa làm'], ['wrong', 'Câu sai'], ['ok', 'Câu đúng']]) {
    const button = el('button', label);
    button.type = 'button'; button.dataset.filter = mode;
    button.addEventListener('click', () => { progressMenu.open = false; filterMode = mode; render(); });
    filters.append(button); filterButtons.push(button);
  }
  retryWrong.addEventListener('click', () => {
    for (const [id, result] of results) if (result === 'wrong') { results.delete(id); selections.delete(id); }
    persist(); progressMenu.open = false; filterMode = 'todo'; render();
  });
  resetTopic.addEventListener('click', () => {
    if (!window.confirm('Xóa toàn bộ tiến độ của bộ tài liệu này?')) return;
    selections.clear(); results.clear(); persist(); progressMenu.open = false; filterMode = 'all'; render();
  });
  let topics, topic, items = [], version = 0, ready = false;
  const render = () => {
    if (!ready) return;
    updateProgress();
    const matches = filterStudy(items, search.value).filter(matchesFilter);
    list.replaceChildren(...matches.map(item => {
      if (topic) return createStudyCard(item, items.indexOf(item), selections, onSelect);
      const link = el('a', '', 'grammar-card study-topic');
      link.href = '#' + item.id;
      link.append(el('span', item.count + ' ' + item.unit, 'grammar-number'), el('h2', item.title), el('p', item.description));
      if (topicNotice(item)) link.append(el('small', topicNotice(item)));
      link.append(el('span', 'Mở tài liệu →', 'study-open'));
      return link;
    }));
    status.textContent = matches.length ? 'Hiển thị ' + matches.length + ' / ' + items.length + (topic ? ' ' + topic.unit : ' bộ tài liệu') + (search.value.trim() ? ' phù hợp.' : '.') : filterMode === 'wrong' && !gradable.some(item => results.get(item.id) === 'wrong') ? 'Không còn câu sai.' : 'Không tìm thấy nội dung phù hợp. Hãy thử bộ lọc hoặc từ khóa khác.';
  };
  const load = async () => {
    const request = ++version;
    if (dialog.open) dialog.close();
    progressMenu.open = false;
    ready = false; progress.hidden = true;
    list.replaceChildren(); retry.hidden = true; notice.hidden = true;
    list.setAttribute('aria-busy', 'true');
    status.textContent = 'Đang tải tài liệu…';
    const id = location.hash.slice(1);
    title.textContent = 'Tài liệu ôn tập N3 tổng hợp';
    back.href = id ? './study.html' : './settings.html';
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
      gradable = topic ? items.filter(item => item.type === 'practice' && hasAnswer(item)) : [];
      filterMode = 'all';
      search.placeholder = topic ? 'Tìm tiếng Nhật hoặc nghĩa tiếng Việt…' : 'Tìm tài liệu…';
      ready = true; render();
    } catch {
      if (request !== version) return;
      status.textContent = id && topics && !topics.some(item => item.id === id) ? 'Không tìm thấy mục này. Nhấn mũi tên để về danh mục.' : 'Chưa tải được tài liệu. Kiểm tra kết nối rồi thử lại.';
      retry.hidden = false;
    } finally { if (request === version) list.setAttribute('aria-busy', 'false'); }
  };
  search.addEventListener('input', render);
  retry.addEventListener('click', load);
  window.addEventListener('hashchange', () => { search.value = ''; window.scrollTo(0, 0); load(); });
  await load();
}
if (typeof document !== 'undefined') startStudy();
