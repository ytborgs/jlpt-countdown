/** Study DOM builders and search helpers. */

import { createGrammarCard, createRubyText } from './grammar.js';
import { topicCatalogProgress } from './study-storage.js';
import { hasAnswer } from './study-session.js';

export const el = (tag, value = '', className = '', lang) => {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  if (lang) node.lang = lang;
  return node;
};

const normalize = value => String(value).normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const searchable = value => Array.isArray(value)
  ? value.map(searchable).join(' ')
  : value && typeof value === 'object'
    ? Object.entries(value).filter(([key]) => !/^(source|content_source|verify_reason|id|knowledge_id|ai_extra|ruby_source|group|gradable|path)/.test(key)).map(([, v]) => searchable(v)).join(' ')
    : typeof value === 'string' ? value : '';

export const filterStudy = (items, query) =>
  items.filter(item => normalize(searchable(item)).includes(normalize(query.trim())));

export const topicNotice = topic =>
  (topic.notice || '').replace(/(?:Cần )?UI type=reading(?: \(xem PROMPT\))?\.\s*/g, '');

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
    const next = !state.known.has(item.id);
    if (next) state.known.add(item.id);
    else state.known.delete(item.id);
    update(); state.onChange(item.id, next);
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
