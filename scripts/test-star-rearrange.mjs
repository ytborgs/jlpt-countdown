#!/usr/bin/env node
/** Star rearrange acceptance: data contract + DOM face/modal (minimal document shim). */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal DOM so study-render can build cards without jsdom. */
function installDomShim() {
  const createEl = tag => {
    const attrs = {};
    const children = [];
    const node = {
      tagName: String(tag).toUpperCase(),
      nodeType: 1,
      localName: String(tag).toLowerCase(),
      childNodes: children,
      children,
      style: {},
      dataset: {},
      className: '',
      hidden: false,
      isConnected: true,
      textContent: '',
      setAttribute(name, value) { attrs[name] = String(value); if (name === 'class') node.className = String(value); },
      getAttribute(name) { return Object.hasOwn(attrs, name) ? attrs[name] : null; },
      append(...nodes) {
        for (const child of nodes) {
          if (child == null) continue;
          if (typeof child === 'string') children.push({ nodeType: 3, textContent: child, childNodes: [] });
          else children.push(child);
        }
        node.textContent = collectText(node);
      },
      appendChild(child) { node.append(child); return child; },
      replaceChildren(...nodes) { children.length = 0; node.append(...nodes); },
      replaceWith(...nodes) { /* unused in star path */ },
      addEventListener(type, fn) {
        node._listeners = node._listeners || {};
        (node._listeners[type] = node._listeners[type] || []).push(fn);
      },
      click() {
        for (const fn of node._listeners?.click || []) fn({ target: node, stopPropagation() {} });
      },
      querySelector(sel) { return queryAll(node, sel)[0] || null; },
      querySelectorAll(sel) { return queryAll(node, sel); },
      focus() {},
      closest() { return null; },
    };
    Object.defineProperty(node, 'classList', {
      value: {
        add(...names) { node.className = [...new Set(`${node.className} ${names.join(' ')}`.trim().split(/\s+/))].join(' '); },
        contains(name) { return node.className.split(/\s+/).includes(name); },
      },
    });
    return node;
  };

  const collectText = node => {
    if (!node) return '';
    if (node.nodeType === 3) return node.textContent || '';
    if (node.childNodes?.length) return node.childNodes.map(collectText).join('');
    return typeof node.textContent === 'string' ? node.textContent : '';
  };

  const matches = (node, sel) => {
    if (!node || node.nodeType !== 1) return false;
    if (sel.startsWith('.')) return node.className.split(/\s+/).includes(sel.slice(1));
    if (sel.includes('.')) {
      const [tag, cls] = sel.split('.');
      return (!tag || node.localName === tag) && node.className.split(/\s+/).includes(cls);
    }
    return node.localName === sel;
  };

  const queryAll = (root, sel) => {
    const out = [];
    const walk = node => {
      if (!node || node.nodeType !== 1) return;
      if (matches(node, sel)) out.push(node);
      for (const child of node.childNodes || []) walk(child);
    };
    walk(root);
    return out;
  };

  const dialog = createEl('dialog');
  dialog.id = 'study-explanation-dialog';
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  const title = createEl('h2'); title.id = 'study-explanation-title';
  const content = createEl('div'); content.id = 'study-explanation-content';
  const byId = {
    'study-explanation-dialog': dialog,
    'study-explanation-title': title,
    'study-explanation-content': content,
  };

  globalThis.document = {
    createElement: createEl,
    createTextNode: text => ({ nodeType: 3, textContent: String(text), childNodes: [] }),
    getElementById: id => byId[id] || null,
  };
  globalThis.window = globalThis;
}

const topics = JSON.parse(fs.readFileSync(path.join(ROOT, 'study-data/topics.json'), 'utf8'));
const topic = topics.find(row => row.id === 'star-rearrange');
assert.ok(topic, 'star-rearrange topic missing');
assert.equal(topic.count, 84);
assert.equal(topic.group, 'practice');
assert.equal(topic.gradable, true);
assert.match(topic.title, /84 câu/);
assert.ok(fs.existsSync(path.join(ROOT, 'study-data/star-rearrange.json')));

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'study-data/star-rearrange.json'), 'utf8'));
assert.equal(data.items.length, 84);
assert.equal(data.item_count, 84);

const ids = new Set();
let sectionA = 0;
let sectionB = 0;
for (const item of data.items) {
  assert.ok(item.id);
  assert.equal(ids.has(item.id), false, `duplicate id ${item.id}`);
  ids.add(item.id);
  assert.equal(item.subtype, 'star_rearrange');
  const keys = item.choices.map(choice => String(choice.key));
  assert.deepEqual([...keys].sort(), ['1', '2', '3', '4']);
  assert.deepEqual([...item.correct_order].map(String).sort(), ['1', '2', '3', '4']);
  assert.equal(String(item.correct_order[item.star_position - 1]), String(item.correct_answer));
  assert.ok(item.completed_jp && item.completed_vi);
  assert.ok(Array.isArray(item.grammar_points) && item.grammar_points.length);
  assert.equal(item.answer_source, 'source_printed');
  if (item.section === 'A') sectionA += 1;
  if (item.section === 'B') sectionB += 1;
}
assert.equal(sectionA, 44);
assert.equal(sectionB, 40);

const q1 = data.items[0];
assert.equal(q1.id, 'star-q-001');
assert.deepEqual(q1.correct_order, ['2', '1', '4', '3']);
assert.equal(q1.star_position, 3);
assert.equal(String(q1.correct_answer), '4');
assert.equal(q1.choices.find(choice => String(choice.key) === '4').text_jp, '悩んだ');

installDomShim();
// Import leaf modules (not study.js glue — that auto-starts against #study-list).
const {
  createStudyCard,
  buildStarExplanationNodes,
  createStarStem,
} = await import('../study-render.js');
const { hasAnswer, buildPracticeSessionQueue, isPracticeAnswered } = await import('../study-session.js');
const { filterStudy } = await import('../study-render.js');
const { saveStudyProgress, loadStudyProgress } = await import('../study-storage.js');

assert.equal(hasAnswer(q1), true);
const stem = createStarStem(q1.stem_jp, q1.star_position);
const starSlots = stem.querySelectorAll('.is-star');
assert.equal(starSlots.length, 1);
assert.equal(starSlots[0].dataset.slot, '3');

const faceCard = createStudyCard(q1, 0, new Map(), () => {});
const face = faceCard.textContent;
assert.match(face, /Chọn phương án nằm ở vị trí ★/);
assert.doesNotMatch(face, /2 → 1 → 4 → 3/);
assert.doesNotMatch(face, /どこに旅行するか悩んだあげく/);
assert.doesNotMatch(face, /Vào kỳ nghỉ hè/);
assert.equal(faceCard.querySelector('.study-explain-toggle').hidden, true);

let graded = null;
const live = createStudyCard(q1, 0, new Map(), (item, key) => { graded = { id: item.id, key }; });
const options = live.querySelectorAll('.study-option');
const wrong = options.find(btn => btn.dataset.key === '2');
const right = options.find(btn => btn.dataset.key === '4');
wrong.click();
assert.equal(graded.key, '2');
assert.equal(wrong.dataset.result, 'incorrect');
assert.equal(right.dataset.result, 'correct');
assert.equal(live.querySelector('.study-explain-toggle').hidden, false);

const modalText = buildStarExplanationNodes(q1, '2').map(node => node.textContent).join('\n');
assert.match(modalText, /2 → 1 → 4 → 3/);
assert.match(modalText, /悩んだ/);
assert.match(modalText, /どこに旅行するか悩んだあげく/);
assert.match(modalText, /Vào kỳ nghỉ hè/);
assert.match(modalText, /～か悩む/);
assert.match(modalText, /～あげく/);

const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: key => { store.delete(key); },
};
const sels = new Map([[q1.id, '4']]);
const results = new Map([[q1.id, 'ok']]);
saveStudyProgress('star-rearrange', sels, results);
assert.equal(loadStudyProgress()['star-rearrange'].selections[q1.id], '4');
assert.equal(isPracticeAnswered(q1, sels, results), true);
assert.equal(
  buildPracticeSessionQueue(data.items, sels, results, filterStudy, { filterMode: 'todo' }).some(item => item.id === q1.id),
  false
);
assert.equal(
  buildPracticeSessionQueue(data.items, new Map([[q1.id, '2']]), new Map([[q1.id, 'wrong']]), filterStudy, { filterMode: 'wrong' })[0]?.id,
  q1.id
);

console.log('test-star-rearrange PASS');
