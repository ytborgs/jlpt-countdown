/** Flashcard mode helpers + controller factory. */

import { createRubyText } from './grammar.js?v=46';
import { el, highlightTargetInExample } from './study-render.js?v=46';

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

/**
 * Owns flash queue/UI. Caller supplies live getters for topic/items/known and
 * callbacks for hash, known-change side effects, and list re-render.
 */
export function createFlashController({
  root, fab, fabMenu, startBtn, fabUnknown, fabAll, counter, shuffle,
  exitBtn, card, head, answer, meaning, example, frontActions, backActions,
  revealBtn, markKnownBtn, markUnknownBtn, nextBtn, done, doneTitle, doneText,
  retryUnknown, retryAll, backList,
  getTopic, getItems, getKnown, getKnownMode, setKnown,
  onKnownChange, onActiveChange, renderList,
}) {
  let flashActive = false, flashQueue = [], flashIndex = 0, flashRevealed = false, flashReviewed = 0;

  const isActive = () => flashActive;
  const isMenuOpen = () => !fabMenu.hidden;

  const setFlashMenuOpen = open => {
    fabMenu.hidden = !open;
    startBtn.setAttribute('aria-expanded', String(open));
  };

  const setFlashHash = enabled => {
    const topic = getTopic();
    if (!topic) return;
    const next = '#' + topic.id + (enabled ? '?mode=flash' : '');
    if (location.hash !== next) history.replaceState(null, '', next);
  };

  const updateFabVisibility = () => {
    const showFab = getKnownMode() && getItems().length > 0 && !flashActive;
    fab.hidden = !showFab;
    if (!showFab) setFlashMenuOpen(false);
  };

  const buildFlashQueue = ({ all = false } = {}) => {
    const known = getKnown();
    const items = getItems();
    let queue = all ? [...items] : items.filter(item => !known.has(item.id));
    if (shuffle.checked) queue = shuffleItems(queue);
    return queue;
  };

  const showFlashDone = ({ emptyUnknown = false } = {}) => {
    const known = getKnown();
    const items = getItems();
    card.hidden = true;
    done.hidden = false;
    const unknownLeft = items.filter(item => !known.has(item.id)).length;
    doneTitle.textContent = emptyUnknown ? 'Đã ôn hết mục chưa thuộc' : 'Đã ôn hết';
    doneText.textContent = `Đã ôn ${flashReviewed} mục · Đã thuộc tổng ${known.size} / ${items.length}`;
    retryUnknown.disabled = unknownLeft === 0;
    retryUnknown.focus();
  };

  const paintFlashCard = () => {
    const item = flashQueue[flashIndex];
    if (!item) { showFlashDone(); return; }
    card.hidden = false;
    done.hidden = true;
    flashRevealed = false;
    counter.textContent = `${flashIndex + 1} / ${flashQueue.length} còn lại`;
    const headInfo = flashHeadForItem(item);
    head.replaceChildren();
    if (headInfo.text) {
      const node = createRubyText('div', headInfo.text, headInfo.ruby, headInfo.className);
      if (headInfo.lang) node.lang = headInfo.lang;
      head.append(node);
    } else {
      head.append(el('div', '—', headInfo.className));
    }
    meaning.replaceChildren();
    example.replaceChildren();
    answer.hidden = true;
    frontActions.hidden = false;
    backActions.hidden = true;
    revealBtn.focus({ preventScroll: true });
  };

  const revealFlash = () => {
    const item = flashQueue[flashIndex];
    if (!item || flashRevealed) return;
    flashRevealed = true;
    const text = flashMeaningForItem(item);
    meaning.replaceChildren(text ? el('p', text) : el('p', 'Chưa có nghĩa trong tài liệu.'));
    example.replaceChildren();
    if (item.example_jp) {
      example.append(highlightTargetInExample(item.example_jp, item.example_ruby, flashExampleTarget(item), item.type));
    }
    answer.hidden = false;
    frontActions.hidden = true;
    backActions.hidden = false;
    nextBtn.focus({ preventScroll: true });
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
    if (!getKnownMode() || !getItems().length) return;
    setFlashMenuOpen(false);
    flashQueue = buildFlashQueue({ all });
    flashIndex = 0;
    flashReviewed = 0;
    flashActive = true;
    root.hidden = false;
    document.body.classList.add('study-flash-active');
    setFlashHash(true);
    onActiveChange?.(true);
    updateFabVisibility();
    if (!flashQueue.length) {
      showFlashDone({ emptyUnknown: !all });
      return;
    }
    paintFlashCard();
    window.scrollTo(0, 0);
  };

  const exitFlashMode = ({ renderList: doRender = true, updateHash = true } = {}) => {
    if (!flashActive && root.hidden) return;
    flashActive = false;
    flashQueue = [];
    flashIndex = 0;
    flashRevealed = false;
    root.hidden = true;
    card.hidden = false;
    done.hidden = true;
    document.body.classList.remove('study-flash-active');
    if (updateHash) setFlashHash(false);
    onActiveChange?.(false);
    updateFabVisibility();
    if (doRender) renderList();
  };

  startBtn.addEventListener('click', () => setFlashMenuOpen(fabMenu.hidden));
  fabUnknown.addEventListener('click', () => enterFlashMode({ all: false }));
  fabAll.addEventListener('click', () => enterFlashMode({ all: true }));
  document.addEventListener('click', event => {
    if (fabMenu.hidden || fab.contains(event.target)) return;
    setFlashMenuOpen(false);
  });
  exitBtn.addEventListener('click', () => exitFlashMode());
  backList.addEventListener('click', () => exitFlashMode());
  revealBtn.addEventListener('click', event => { event.stopPropagation(); revealFlash(); });
  card.addEventListener('click', event => {
    if (event.target.closest('button, a, input, label')) return;
    if (done.hidden === false) return;
    if (!flashRevealed) revealFlash();
  });
  card.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') {
      if (flashRevealed || !done.hidden) return;
      event.preventDefault();
      revealFlash();
    }
  });
  markKnownBtn.addEventListener('click', event => {
    event.stopPropagation();
    const item = flashQueue[flashIndex];
    if (!item) return;
    const known = getKnown();
    known.add(item.id);
    setKnown(known);
    onKnownChange(item.id, true);
    advanceFlash();
  });
  markUnknownBtn.addEventListener('click', event => {
    event.stopPropagation();
    const item = flashQueue[flashIndex];
    if (!item) return;
    const known = getKnown();
    known.delete(item.id);
    setKnown(known);
    onKnownChange(item.id, false);
    advanceFlash();
  });
  nextBtn.addEventListener('click', event => {
    event.stopPropagation();
    advanceFlash();
  });
  retryUnknown.addEventListener('click', () => enterFlashMode({ all: false }));
  retryAll.addEventListener('click', () => enterFlashMode({ all: true }));

  return {
    isActive,
    isMenuOpen,
    setFlashMenuOpen,
    updateFabVisibility,
    enterFlashMode,
    exitFlashMode,
  };
}
