import { createGrammarCard, createRubyText } from './grammar.js';
const DATA_VERSION = new URL(import.meta.url).searchParams.get('v') || '21';

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

export const createPracticeStem = (value, segments, target) => {
  const stem = createRubyText('p', value, segments, 'study-stem');
  const start = target ? value.indexOf(target) : -1;
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

export function createStudyCard(item, index, selections = new Map()) {
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
    card.append(createPracticeStem(stemText, stemRuby, item.target));
    const options = el('div', '', 'study-options');
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', 'Lựa chọn cho câu ' + (index + 1));
    const feedback = el('p', '', 'study-feedback');
    feedback.setAttribute('role', 'status');
    const keyed = hasAnswer(item);
    if (!keyed) card.append(el('small', 'Chưa có đáp án · Chọn để tự ôn, không chấm điểm.'));
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
        feedback.textContent = (correct ? 'Chính xác. ' : 'Chưa đúng. Đáp án: ' + answer.key + '. ' + answer.text_jp + '. ') + [item.meaning_vi, item.explanation].filter(Boolean).join(' · ');
      });
      options.append(button);
    }
    // Restore only after all options exist so the answer can be highlighted too.
    const selectedButton = [...options.children].find(button => button.dataset.key === selections.get(item.id));
    if (selectedButton) selectedButton.click();
    card.append(options, feedback);
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
  const cache = new Map();
  const selections = new Map();
  let topics, topic, items = [], version = 0, ready = false;
  const render = () => {
    if (!ready) return;
    const matches = filterStudy(items, search.value);
    list.replaceChildren(...matches.map(item => {
      if (topic) return createStudyCard(item, items.indexOf(item), selections);
      const link = el('a', '', 'grammar-card study-topic');
      link.href = '#' + item.id;
      link.append(el('span', item.count + ' ' + item.unit, 'grammar-number'), el('h2', item.title), el('p', item.description));
      if (topicNotice(item)) link.append(el('small', topicNotice(item)));
      link.append(el('span', 'Mở tài liệu →', 'study-open'));
      return link;
    }));
    status.textContent = matches.length ? 'Hiển thị ' + matches.length + ' / ' + items.length + (topic ? ' ' + topic.unit : ' bộ tài liệu') + (search.value.trim() ? ' phù hợp.' : '.') : 'Không tìm thấy nội dung phù hợp. Hãy thử từ khóa khác.';
  };
  const load = async () => {
    const request = ++version;
    ready = false;
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
