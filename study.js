import { createGrammarCard } from './grammar.js';

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

export function createStudyCard(item, index, selections = new Map()) {
  if (item.type === 'grammar') {
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
    card.append(el('h2', item.lemma_jp || item.example_jp, 'study-word', 'ja'));
    if (item.reading) card.append(el('p', item.reading, '', 'ja'));
    if (item.meaning_vi) card.append(el('p', item.meaning_vi));
    if (item.example_jp) card.append(el('p', item.example_jp, 'grammar-example', 'ja'));
  } else if (item.type === 'practice') {
    const stem = el('p', '', 'study-stem', 'ja');
    const targetIndex = item.target ? item.stem_jp.indexOf(item.target) : -1;
    if (targetIndex >= 0) stem.append(document.createTextNode(item.stem_jp.slice(0, targetIndex)), el('mark', item.target), document.createTextNode(item.stem_jp.slice(targetIndex + item.target.length)));
    else stem.textContent = item.stem_jp;
    card.append(stem);
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
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        selections.set(item.id, String(choice.key));
        for (const other of options.children) { other.setAttribute('aria-pressed', 'false'); delete other.dataset.result; }
        button.setAttribute('aria-pressed', 'true');
        if (!keyed) { feedback.textContent = 'Đã chọn ' + choice.key + '. Tài liệu chưa cung cấp đáp án để đối chiếu.'; return; }
        const answer = item.choices.find(option => String(option.key) === String(item.correct_answer));
        const correct = String(choice.key) === String(item.correct_answer);
        button.dataset.result = correct ? 'correct' : 'incorrect';
        feedback.textContent = (correct ? 'Chính xác. ' : 'Chưa đúng. Đáp án: ' + answer.key + '. ' + answer.text_jp + '. ') + [item.meaning_vi, item.explanation].filter(Boolean).join(' · ');
      });
      options.append(button);
      if (selections.get(item.id) === String(choice.key)) button.click();
    }
    card.append(options, feedback);
    if (item.stem_gloss_vi) {
      const hint = el('details', '', 'grammar-details');
      hint.append(el('summary', 'Gợi ý nghĩa tiếng Việt'), el('p', item.stem_gloss_vi));
      card.append(hint);
    }
  }
  if (item.needs_verify && item.type !== 'practice') card.append(el('span', 'Cần đối chiếu', 'study-badge'));
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
  const more = document.getElementById('study-more');
  const cache = new Map();
  const selections = new Map();
  let topics, topic, items = [], visible = 30, version = 0, ready = false;
  const render = () => {
    if (!ready) return;
    const matches = filterStudy(items, search.value);
    const shown = matches.slice(0, visible);
    list.replaceChildren(...shown.map(item => {
      if (topic) return createStudyCard(item, items.indexOf(item), selections);
      const link = el('a', '', 'grammar-card study-topic');
      link.href = '#' + item.id;
      link.append(el('span', item.count + ' ' + item.unit, 'grammar-number'), el('h2', item.title), el('p', item.description));
      if (item.notice) link.append(el('small', item.id === 'synonyms' ? 'Chưa có đáp án' : item.id === 'kanji' ? 'Dữ liệu cần đối chiếu' : 'Dữ liệu hiện có trong tài liệu'));
      link.append(el('span', 'Mở tài liệu →', 'study-open'));
      return link;
    }));
    more.hidden = shown.length >= matches.length;
    status.textContent = matches.length ? 'Hiển thị ' + shown.length + ' / ' + matches.length + (topic ? ' mục' : ' bộ tài liệu') + (search.value.trim() ? ' phù hợp.' : '.') : 'Không tìm thấy nội dung phù hợp. Hãy thử từ khóa khác.';
  };
  const load = async () => {
    const request = ++version;
    ready = false;
    list.replaceChildren(); more.hidden = true; retry.hidden = true; notice.hidden = true;
    list.setAttribute('aria-busy', 'true');
    status.textContent = 'Đang tải tài liệu…';
    const id = location.hash.slice(1);
    title.textContent = 'Tài liệu ôn tập N3 tổng hợp';
    back.href = id ? './study.html' : './settings.html';
    back.setAttribute('aria-label', id ? 'Về danh mục tài liệu' : 'Về Cài đặt');
    try {
      const getJSON = async path => {
        const response = await fetch(new URL(path, import.meta.url));
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
        notice.textContent = selected.notice;
        notice.hidden = !selected.notice;
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
  search.addEventListener('input', () => { visible = 30; render(); });
  more.addEventListener('click', () => { visible += 30; render(); });
  retry.addEventListener('click', load);
  window.addEventListener('hashchange', () => { search.value = ''; visible = 30; window.scrollTo(0, 0); load(); });
  await load();
}
if (typeof document !== 'undefined') startStudy();
