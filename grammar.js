const STORAGE_KEY = 'jlpt-n3-previous-grammar';

// Shuffle a fresh copy, excluding the previous selection when there are enough items.
export const pickGrammar = (items, previous = [], count = 5, random = Math.random) => {
  const previousIds = new Set(previous);
  const fresh = items.filter(item => !previousIds.has(item.id));
  const pool = [...(fresh.length >= count ? fresh : items)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
};

export const filterGrammar = (items, query) => {
  const normalize = value => value.toLowerCase().normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const needle = normalize(query.trim());
  return items.filter(item => normalize([item.id, item.pattern, item.meaning, item.structure, item.usage, item.example_jp, item.example_hira, item.example_vi].join(' ')).includes(needle));
};

const text = (tag, value, className, lang) => {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  if (lang) element.lang = lang;
  return element;
};

export const createGrammarCard = item => {
  const card = document.createElement('article');
  card.className = 'grammar-card';
  card.dataset.grammarId = item.id;
  card.append(text('span', 'MẪU ' + item.id, 'grammar-number'));
  card.append(text('h3', item.pattern, 'grammar-pattern', 'ja'));
  card.append(text('p', item.meaning, 'grammar-meaning'));
  const structure = document.createElement('div');
  structure.className = 'grammar-structure';
  structure.append(text('span', 'Cấu trúc'));
  structure.append(text('p', item.structure, '', 'ja'));
  card.append(structure);
  const details = document.createElement('details');
  details.className = 'grammar-details';
  details.append(text('summary', 'Cách dùng và ví dụ'));
  const content = document.createElement('div');
  content.className = 'grammar-detail-content';
  content.append(text('p', item.usage));
  const example = document.createElement('div');
  example.className = 'grammar-example';
  example.append(text('p', item.example_jp, 'grammar-example-jp', 'ja'));
  example.append(text('p', item.example_hira, 'grammar-hira', 'ja'));
  example.append(text('p', item.example_vi));
  content.append(example);
  if (item.note) content.append(text('p', 'Lưu ý: ' + item.note, 'grammar-note'));
  if (item.source_page) content.append(text('small', 'Tài liệu gốc · trang ' + item.source_page, 'grammar-source'));
  details.append(content);
  card.append(details);
  return card;
};

const startGrammar = async () => {
  const daily = document.getElementById('daily-grammar');
  const library = document.getElementById('library-grammar');
  if (!daily && !library) return;
  const list = document.getElementById('grammar-list');
  const status = document.getElementById('grammar-status');
  const retry = document.getElementById('grammar-retry');
  let items = [];
  let previous = [];
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) previous = stored;
  } catch { /* Random selection still works when storage is unavailable. */ }

  const render = selected => list.replaceChildren(...selected.map(createGrammarCard));
  const refreshDaily = () => {
    if (!items.length) return;
    const selected = pickGrammar(items, previous);
    previous = selected.map(item => item.id);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(previous)); } catch {}
    render(selected);
    status.textContent = '5 mẫu ngẫu nhiên từ ' + items.length + ' mẫu · Chạm để xem cách dùng và ví dụ.';
  };
  const renderLibrary = () => {
    const selected = filterGrammar(items, document.getElementById('grammar-search').value);
    render(selected);
    status.textContent = selected.length ? 'Đang hiển thị ' + selected.length + ' / ' + items.length + ' mẫu.' : 'Không tìm thấy mẫu phù hợp. Hãy thử từ khóa khác.';
  };
  const load = async () => {
    status.textContent = 'Đang tải ngữ pháp…';
    retry.hidden = true;
    list.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(new URL('./grammar.json', import.meta.url));
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data.items) || data.items.length < 5 || data.items.length !== data.total || new Set(data.items.map(item => item.id)).size !== data.items.length) throw new Error('Invalid grammar data');
      items = data.items;
      if (daily) refreshDaily(); else renderLibrary();
    } catch {
      status.textContent = 'Chưa tải được ngữ pháp. Kiểm tra kết nối rồi thử lại.';
      retry.hidden = false;
    } finally { list.setAttribute('aria-busy', 'false'); }
  };
  retry.addEventListener('click', load);
  if (library) document.getElementById('grammar-search').addEventListener('input', renderLibrary);
  if (daily) {
    let wasHidden = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) wasHidden = true;
      else if (wasHidden) { wasHidden = false; refreshDaily(); }
    });
    window.addEventListener('pagehide', () => { wasHidden = true; });
    window.addEventListener('pageshow', event => {
      if (event.persisted && wasHidden) { wasHidden = false; refreshDaily(); }
    });
  }
  await load();
};

if (typeof document !== 'undefined') startGrammar();
