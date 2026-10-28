import {
  STORAGE_KEY, KNOWN_KEY,
  listRouteKey, loadListState, saveListState,
  loadCatalogState, saveCatalogState,
  loadStudyProgress, saveStudyProgress, hydrateStudyProgress,
  loadStudyKnown, hydrateStudyKnown, saveStudyKnown, patchStudyKnown,
  pruneStudyProgress, pruneStudyKnown, topicCatalogProgress,
} from './study-storage.js?v=44';
import {
  el, filterStudy, topicNotice, createTopicCard, createCollectionCard, createFolderCard,
  createStudyCard, openStudyExplanation, createPracticeStem, createStarStem, buildStarExplanationNodes,
  highlightTargetInExample,
} from './study-render.js?v=44';
import {
  hasAnswer, isPracticeAnswered, buildPracticeSessionQueue as buildQueue,
  createSessionController,
} from './study-session.js?v=44';
import {
  shuffleItems, flashHeadForItem, flashMeaningForItem, flashExampleTarget,
  createFlashController,
} from './study-flash.js?v=44';

const DATA_VERSION = new URL(import.meta.url).searchParams.get('v') || '44';
const SESSION_SHORT = 20;

export {
  listRouteKey, loadListState, saveListState,
  loadCatalogState, saveCatalogState,
  loadStudyProgress, saveStudyProgress, hydrateStudyProgress,
  loadStudyKnown, hydrateStudyKnown, saveStudyKnown, patchStudyKnown,
  pruneStudyProgress, pruneStudyKnown, topicCatalogProgress,
  filterStudy, createTopicCard, createCollectionCard, createFolderCard, createStudyCard,
  openStudyExplanation, createPracticeStem, createStarStem, buildStarExplanationNodes,
  highlightTargetInExample,
  hasAnswer, isPracticeAnswered,
  shuffleItems, flashHeadForItem, flashMeaningForItem, flashExampleTarget,
};

export const PACK_RETURN_KEY = 'jlpt-study-pack-return';

export const parseStudyHash = (hash = typeof location !== 'undefined' ? location.hash : '') => {
  const raw = String(hash || '').replace(/^#/, '');
  const q = raw.indexOf('?');
  const path = q < 0 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : raw.slice(q + 1));
  const flash = params.get('mode') === 'flash';
  if (!path) return { kind: 'catalog', id: '', collectionId: '', folderId: '', flash };
  if (path === 'pack' || path.startsWith('pack/')) {
    const parts = path.split('/').filter(Boolean);
    const collectionId = parts[1] || '';
    const folderId = parts[2] || '';
    if (!collectionId) return { kind: 'invalid', id: path, collectionId: '', folderId: '', flash };
    if (!folderId) return { kind: 'collection', id: path, collectionId, folderId: '', flash };
    return { kind: 'folder', id: path, collectionId, folderId, flash };
  }
  return { kind: 'topic', id: path, collectionId: '', folderId: '', flash };
};

export const clearPackReturn = () => {
  try { sessionStorage.removeItem(PACK_RETURN_KEY); } catch { /* ignore */ }
};

/** Store pack back-context bound to one topic id (never a bare folder hash). */
export const writePackReturn = (topicId, returnHash) => {
  if (!topicId || !returnHash) {
    clearPackReturn();
    return;
  }
  try {
    sessionStorage.setItem(PACK_RETURN_KEY, JSON.stringify({ topicId, returnHash }));
  } catch { /* ignore */ }
};

export const readPackReturn = () => {
  try {
    const raw = sessionStorage.getItem(PACK_RETURN_KEY);
    if (!raw) return null;
    if (raw.startsWith('#')) {
      // Legacy bare hash from earlier L1 draft — ignore to avoid cross-topic leaks.
      clearPackReturn();
      return null;
    }
    const data = JSON.parse(raw);
    if (!data || typeof data.topicId !== 'string' || typeof data.returnHash !== 'string') {
      clearPackReturn();
      return null;
    }
    return data;
  } catch {
    clearPackReturn();
    return null;
  }
};

export const resolvePackReturn = (topicId, collections) => {
  const stored = readPackReturn();
  if (!stored) return '';
  if (stored.topicId !== topicId) {
    // Context belongs to another topic — drop so it cannot leak later.
    clearPackReturn();
    return '';
  }
  const parsed = parseStudyHash(stored.returnHash);
  if (parsed.kind !== 'folder') {
    clearPackReturn();
    return '';
  }
  const collection = (collections || []).find(item => item.id === parsed.collectionId);
  const folder = collection?.folders?.find(item => item.id === parsed.folderId);
  if (!(folder && (folder.topicIds || []).includes(topicId))) {
    clearPackReturn();
    return '';
  }
  return stored.returnHash;
};

export function buildPracticeSessionQueue(items, selections, results, opts = {}) {
  return buildQueue(items, selections, results, filterStudy, opts);
}

export const STUDY_GROUPS = [
  { id: 'grammar', label: 'Ngữ pháp' },
  { id: 'vocab', label: 'Từ vựng & Hán tự' },
  { id: 'practice', label: 'Trắc nghiệm' },
  { id: 'tips', label: 'Mẹo & bí kíp' },
];
const topicGroupId = topic => STUDY_GROUPS.some(group => group.id === topic.group) ? topic.group : 'vocab';

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
  const knownFilterButtons = [];
  let flashCtl;
  const updateKnownProgress = () => {
    knownProgress.hidden = !knownMode;
    flashCtl?.updateFabVisibility();
    const total = knownMode ? items.length : 0;
    const done = knownMode ? known.size : 0;
    knownText.textContent = total ? `Đã thuộc ${done}/${total}` : 'Đã thuộc 0/0';
    const percentage = total ? Math.round(done / total * 100) : 0;
    knownBar.setAttribute('aria-valuenow', String(percentage));
    knownBar.setAttribute('aria-valuetext', `Đã thuộc ${done}, còn ${Math.max(0, total - done)} trên ${total}`);
    knownFill.style.width = (total ? done / total * 100 : 0) + '%';
    for (const button of knownFilterButtons) button.setAttribute('aria-pressed', String(button.dataset.filter === knownFilter));
  };
  const onKnownChange = (itemId, value) => {
    if (itemId != null) patchStudyKnown(topic.id, itemId, value);
    else saveStudyKnown(topic.id, known, { replace: true });
    known = hydrateStudyKnown(items, loadStudyKnown()[topic.id]);
    updateKnownProgress();
    if (flashCtl?.isActive()) return;
    if (knownFilter !== 'all') {
      render();
      knownFilterButtons.find(button => button.dataset.filter === knownFilter)?.focus({ preventScroll: true });
    }
  };
  flashCtl = createFlashController({
    root: flashRoot, fab: flashFab, fabMenu: flashFabMenu, startBtn: flashStart,
    fabUnknown: flashFabUnknown, fabAll: flashFabAll, counter: flashCounter, shuffle: flashShuffle,
    exitBtn: flashExit, card: flashCard, head: flashHead, answer: flashAnswer,
    meaning: flashMeaning, example: flashExample, frontActions: flashFrontActions, backActions: flashBackActions,
    revealBtn: flashReveal, markKnownBtn: flashMarkKnown, markUnknownBtn: flashMarkUnknown, nextBtn: flashNext,
    done: flashDone, doneTitle: flashDoneTitle, doneText: flashDoneText,
    retryUnknown: flashRetryUnknown, retryAll: flashRetryAll, backList: flashBackList,
    getTopic: () => topic, getItems: () => items, getKnown: () => known, getKnownMode: () => knownMode,
    setKnown: next => { known = next; },
    onKnownChange, onActiveChange: () => updateKnownProgress(), renderList: () => render(),
  });
  const { enterFlashMode, exitFlashMode, setFlashMenuOpen, isMenuOpen: flashIsMenuOpen } = flashCtl;
  const matchesKnownFilter = item => !knownMode || knownFilter === 'all' || (knownFilter === 'known' ? known.has(item.id) : !known.has(item.id));
  for (const [mode, label] of [['all', 'Tất cả'], ['unknown', 'Chưa thuộc'], ['known', 'Đã thuộc']]) {
    const button = el('button', label);
    button.type = 'button'; button.dataset.filter = mode;
    button.addEventListener('click', () => { knownFilter = mode; render(); });
    knownFilters.append(button); knownFilterButtons.push(button);
  }
  let filterMode = 'all', gradable = [], practiceItems = [];
  let viewMode = 'list';
  const session = createSessionController({ filterStudy });
  const filterButtons = [];
  const viewModeNav = document.getElementById('study-view-mode');
  const sessionNav = document.getElementById('study-session-nav');
  const sessionText = document.getElementById('study-session-text');
  const sessionPrev = document.getElementById('study-session-prev');
  const sessionSkip = document.getElementById('study-session-skip');
  const sessionNext = document.getElementById('study-session-next');
  const session20 = document.getElementById('study-session-20');
  const filterDrawer = document.getElementById('study-filter-drawer');
  const filterSummary = document.getElementById('study-filter-summary');
  const viewModeButtons = [];
  const filterLabels = { all: 'Tất cả', todo: 'Chưa làm', wrong: 'Câu sai', ok: 'Câu đúng' };
  const persist = ({ replace = false } = {}) => {
    if (!topic) return;
    saveStudyProgress(topic.id, selections, results, { replace });
  };
  const syncProgressFromStorage = () => {
    if (!topic || !ready) return;
    ({ selections, results } = hydrateStudyProgress(items, loadStudyProgress()[topic.id]));
    if (knownMode) known = hydrateStudyKnown(items, loadStudyKnown()[topic.id]);
    updateProgress();
    updateKnownProgress();
    if (viewMode === 'session') refreshSessionQueue({ keepIndex: true, preferTodo: false });
    render();
  };
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== KNOWN_KEY) return;
    syncProgressFromStorage();
  });
  const isPracticeTopic = () => practiceItems.length > 0;
  const wrongCount = () => practiceItems.filter(item => results.get(item.id) === 'wrong').length;
  const practiceAllDone = () => practiceItems.length > 0 && practiceItems.every(item => isPracticeAnswered(item, selections, results));
  const syncFilterDrawer = () => {
    if (!filterDrawer) return;
    filterDrawer.hidden = !isPracticeTopic();
    if (filterSummary) filterSummary.textContent = 'Lọc · ' + (filterLabels[filterMode] || 'Tất cả');
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
        session.setLimit(null);
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
      session.setLimit(null);
      render();
    });
    const toSession = el('button', 'Làm lại kiểu phiên', 'study-complete-action study-complete-secondary');
    toSession.type = 'button';
    toSession.addEventListener('click', () => {
      filterMode = wrong ? 'wrong' : 'all';
      viewMode = 'session';
      session.setLimit(null);
      refreshSessionQueue({ preferTodo: false });
      session.setIndex(0);
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
        session.setLimit(null);
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
      session.setLimit(null);
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
    session.refresh(items, selections, results, {
      query: search.value,
      filterMode,
      keepIndex,
      preferTodo,
    });
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
    const total = session.getQueue().length;
    if (!total) {
      sessionText.textContent = 'Không còn câu trong phiên này.';
      sessionPrev.disabled = true;
      sessionSkip.disabled = true;
      sessionNext.disabled = true;
      sessionNext.classList.remove('is-ready');
      return;
    }
    const current = session.getQueue()[session.getIndex()];
    const answered = current && isPracticeAnswered(current, selections, results);
    sessionText.textContent = `${session.getIndex() + 1}/${total}` + (session.getLimit() ? ` · tối đa ${session.getLimit()}` : '') + (answered ? ' · đã chọn' : '');
    sessionPrev.disabled = session.getIndex() <= 0;
    sessionSkip.disabled = session.getIndex() >= total - 1 && answered;
    sessionNext.disabled = false;
    sessionNext.textContent = session.getIndex() >= total - 1 ? (answered ? 'Xong' : 'Câu này') : 'Tiếp';
    sessionNext.classList.toggle('is-ready', !!answered && session.getIndex() < total - 1);
  };
  const updateProgress = () => {
    const show = isPracticeTopic();
    progress.hidden = !show;
    if (!show) return;
    if (gradable.length) {
      const ok = gradable.filter(item => results.get(item.id) === 'ok').length;
      const bad = gradable.filter(item => results.get(item.id) === 'wrong').length;
      const total = gradable.length;
      progressText.textContent = `${ok} đúng · ${bad} sai · ${total - ok - bad}/${total}`;
      progressBar.setAttribute('aria-valuenow', String(total ? Math.round((ok + bad) / total * 100) : 0));
      progressBar.setAttribute('aria-valuetext', `Đúng ${ok}, sai ${bad}, còn ${total - ok - bad} trên ${total}`);
      okFill.style.width = (total ? ok / total * 100 : 0) + '%';
      badFill.style.width = (total ? bad / total * 100 : 0) + '%';
      retryWrong.disabled = !bad;
      session20.disabled = !gradable.some(item => !results.has(item.id));
    } else {
      const total = practiceItems.length;
      const done = practiceItems.filter(item => selections.has(item.id)).length;
      progressText.textContent = `${done}/${total} đã chọn`;
      progressBar.setAttribute('aria-valuenow', String(total ? Math.round(done / total * 100) : 0));
      progressBar.setAttribute('aria-valuetext', `Đã chọn ${done} trên ${total}`);
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
      if (session.getIndex() < session.getQueue().length - 1) sessionNext.focus({ preventScroll: true });
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
      session.setLimit(null);
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
      if (filterDrawer) filterDrawer.open = false;
      filterMode = mode;
      session.setLimit(null);
      if (viewMode === 'session') refreshSessionQueue({ preferTodo: true });
      render();
    });
    filters.append(button); filterButtons.push(button);
  }
  document.addEventListener('click', event => {
    if (!filterDrawer?.open || filterDrawer.contains(event.target)) return;
    filterDrawer.open = false;
  });
  const goSession = delta => {
    if (!session.getQueue().length) return;
    const result = session.go(delta);
    if (result.kind === 'noop') return;
    if (result.kind === 'end') {
      viewMode = 'list';
      session.setLimit(null);
      render();
      status.textContent = 'Đã hết phiên. Có thể mở lại Phiên hoặc chọn “20 câu chưa làm”.';
      window.scrollTo(0, 0);
      return;
    }
    render();
    window.scrollTo(0, 0);
  };
  sessionPrev.addEventListener('click', () => goSession(-1));
  sessionSkip.addEventListener('click', () => goSession(1));
  sessionNext.addEventListener('click', () => {
    const current = session.getQueue()[session.getIndex()];
    if (current && !isPracticeAnswered(current, selections, results) && session.getIndex() >= session.getQueue().length - 1) return;
    goSession(1);
  });
  session20.addEventListener('click', () => {
    progressMenu.open = false;
    filterMode = 'todo';
    session.setLimit(SESSION_SHORT);
    viewMode = 'session';
    refreshSessionQueue({ preferTodo: true });
    render();
    window.scrollTo(0, 0);
  });
  retryWrong.addEventListener('click', () => {
    for (const [id, result] of results) if (result === 'wrong') { results.delete(id); selections.delete(id); }
    persist(); progressMenu.open = false; filterMode = 'todo'; session.setLimit(null); viewMode = 'session';
    refreshSessionQueue({ preferTodo: true });
    render();
  });
  resetTopic.addEventListener('click', () => {
    if (!window.confirm('Xóa toàn bộ tiến độ của bộ tài liệu này?')) return;
    selections.clear(); results.clear(); persist({ replace: true }); progressMenu.open = false; filterMode = 'all';
    session.setLimit(null); viewMode = 'list'; session.clearQueue(); session.setIndex(0); render();
  });
  window.addEventListener('keydown', event => {
    if (!ready || dialog.open) return;
    if (flashCtl.isActive()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        exitFlashMode();
      }
      return;
    }
    if (flashIsMenuOpen() && event.key === 'Escape') {
      event.preventDefault();
      setFlashMenuOpen(false);
      flashStart.focus();
      return;
    }
    if (!isPracticeTopic() || viewMode !== 'session') return;
    if (event.target.closest('input, textarea, select, a, [contenteditable="true"]')) return;
    const focusedOption = event.target.closest?.('.study-option');
    if (event.key === 'Enter' && focusedOption) {
      // Let the focused answer button handle Enter (native button activation).
      return;
    }
    if (event.target.closest('button') && event.key === 'Enter') return;
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
  let topics, collections = [], collectionsError = '', topic, items = [], version = 0, ready = false, groupFilter = 'all';
  let route = parseStudyHash();
  let activeCollection = null, activeFolder = null;
  let restoreListScroll = null;
  const isFlatCatalog = () => route.kind === 'catalog';
  const isPackView = () => route.kind === 'collection' || route.kind === 'folder';
  const isListView = r => r?.kind === 'catalog' || r?.kind === 'collection' || r?.kind === 'folder';
  const persistListUi = (target = route) => {
    if (!ready || !isListView(target)) return;
    const key = listRouteKey(target);
    if (!key) return;
    const payload = { scrollY: window.scrollY, search: search.value, groupFilter };
    saveListState(key, payload);
    if (key === 'catalog') saveCatalogState(payload);
  };
  const persistCatalogUi = () => persistListUi({ kind: 'catalog' });
  const topicById = id => (topics || []).find(item => item.id === id);
  const ensureBreadcrumb = () => {
    let nav = document.getElementById('study-breadcrumb');
    if (nav) return nav;
    nav = el('nav', '', 'study-breadcrumb');
    nav.id = 'study-breadcrumb';
    nav.setAttribute('aria-label', 'Đường dẫn');
    title.parentElement?.after(nav);
    return nav;
  };
  const renderBreadcrumb = crumbs => {
    const nav = ensureBreadcrumb();
    if (!crumbs.length) {
      nav.hidden = true;
      nav.replaceChildren();
      return;
    }
    nav.hidden = false;
    const nodes = [];
    crumbs.forEach((crumb, index) => {
      if (index) nodes.push(el('span', '→', 'study-breadcrumb-sep'));
      if (crumb.href) {
        const link = el('a', crumb.label);
        link.href = crumb.href;
        nodes.push(link);
      } else {
        nodes.push(el('span', crumb.label, 'study-breadcrumb-current'));
      }
    });
    nav.replaceChildren(...nodes);
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
    groupNav.hidden = !isFlatCatalog();
    for (const button of groupButtons) button.setAttribute('aria-pressed', String(button.dataset.group === groupFilter));
  };
  const hideStudyChrome = () => {
    progress.hidden = true;
    knownProgress.hidden = true;
    if (flashCtl?.isActive()) exitFlashMode({ renderList: false, updateHash: false });
    else flashCtl?.updateFabVisibility?.();
    if (flashFab) flashFab.hidden = true;
  };
  const renderCatalog = matches => {
    const nodes = [];
    if (groupFilter === 'all' && !search.value.trim()) {
      if (collectionsError) {
        const box = el('div', '', 'study-collection-error');
        box.append(el('p', 'Chưa tải được mục tổng hợp. Danh mục tài liệu bên dưới vẫn dùng được.'));
        const retryCollections = el('button', 'Thử tải mục tổng hợp', 'grammar-retry');
        retryCollections.type = 'button';
        retryCollections.addEventListener('click', () => load({ restoreList: true, forceCollections: true }));
        box.append(retryCollections);
        nodes.push(box);
      } else {
        for (const collection of collections) nodes.push(createCollectionCard(collection));
      }
    }
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
  const renderCollectionView = () => {
    hideStudyChrome();
    const query = search.value.trim();
    const folders = activeCollection?.folders || [];
    if (!query) {
      list.replaceChildren(...folders.map(folder => createFolderCard(activeCollection, folder)));
      status.textContent = `Hiển thị ${folders.length} / ${folders.length} thư mục.`;
      return;
    }
    const nodes = [];
    const folderHits = filterStudy(folders.map(folder => ({ ...folder, title: folder.title })), query);
    if (folderHits.length) {
      const section = el('section', '', 'study-group');
      section.append(el('h2', 'Thư mục', 'study-group-heading'));
      const grid = el('div', '', 'study-group-list grammar-list');
      for (const folder of folderHits) {
        const full = folders.find(item => item.id === folder.id);
        if (full) grid.append(createFolderCard(activeCollection, full));
      }
      section.append(grid);
      nodes.push(section);
    }
    const topicHits = [];
    for (const folder of folders) {
      for (const topicId of folder.topicIds || []) {
        const found = topicById(topicId);
        if (!found) continue;
        if (!filterStudy([found], query).length) continue;
        topicHits.push({ topic: found, folder });
      }
    }
    if (topicHits.length) {
      const section = el('section', '', 'study-group');
      section.append(el('h2', 'Bộ tài liệu', 'study-group-heading'));
      const grid = el('div', '', 'study-group-list grammar-list');
      for (const row of topicHits) {
        grid.append(createTopicCard(row.topic, {
          folderLabel: row.folder.title,
          packReturn: '#pack/' + activeCollection.id + '/' + row.folder.id,
        }));
      }
      section.append(grid);
      nodes.push(section);
    }
    if (!nodes.length) {
      list.replaceChildren(el('p', 'Không tìm thấy thư mục hoặc bộ tài liệu trong mục tổng hợp này.', 'study-empty'));
      status.textContent = 'Không có kết quả trong mục tổng hợp.';
      return;
    }
    list.replaceChildren(...nodes);
    status.textContent = `Tìm thấy ${folderHits.length} thư mục · ${topicHits.length} bộ trong mục tổng hợp.`;
  };
  const renderFolderView = () => {
    hideStudyChrome();
    const topicIds = activeFolder?.topicIds || [];
    const folderTopics = topicIds.map(topicById).filter(Boolean);
    if (!topicIds.length) {
      const empty = el('div', '', 'study-folder-empty');
      empty.append(el('p', 'Nội dung đang được chuẩn bị.'));
      const backLink = el('a', '← Về mục tổng hợp', 'study-folder-empty-back');
      backLink.href = '#pack/' + activeCollection.id;
      empty.append(backLink);
      list.replaceChildren(empty);
      status.textContent = 'Thư mục chưa có bộ tài liệu.';
      return;
    }
    const matches = filterStudy(folderTopics, search.value);
    if (!matches.length) {
      list.replaceChildren(el('p', 'Không tìm thấy bộ tài liệu trong thư mục này.', 'study-empty'));
      status.textContent = 'Không có kết quả trong thư mục.';
      return;
    }
    const packReturn = '#pack/' + activeCollection.id + '/' + activeFolder.id;
    list.replaceChildren(...matches.map(item => createTopicCard(item, { packReturn })));
    status.textContent = `Hiển thị ${matches.length} / ${folderTopics.length} bộ tài liệu` + (search.value.trim() ? ' phù hợp.' : '.');
  };
  const renderSessionDone = () => {
    if (practiceAllDone()) {
      list.replaceChildren(createPracticeCompleteBanner());
      return;
    }
    const panel = el('div', '', 'study-session-done');
    panel.append(el('h2', 'Hết phiên'));
    panel.append(el('p', session.getLimit()
      ? `Đã hết ${session.getLimit()} câu trong phiên ngắn. Tiến độ vẫn được lưu trên thiết bị.`
      : 'Không còn câu phù hợp bộ lọc hiện tại.'));
    if (wrongCount()) {
      const review = el('button', 'Ôn câu sai', 'study-session-done-action');
      review.type = 'button';
      review.addEventListener('click', () => {
        filterMode = 'wrong';
        session.setLimit(null);
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
    toList.addEventListener('click', () => { viewMode = 'list'; session.setLimit(null); render(); });
    panel.append(again, toList);
    list.replaceChildren(panel);
  };
  const render = () => {
    if (!ready) return;
    if (flashCtl.isActive()) {
      updateGroupFilters();
      updateViewMode();
      updateProgress();
      updateKnownProgress();
      return;
    }
    updateGroupFilters();
    updateViewMode();
    if (isPackView()) {
      if (route.kind === 'collection') renderCollectionView();
      else renderFolderView();
      return;
    }
    if (isPracticeTopic() && viewMode === 'session') {
      if (!session.getQueue().length) refreshSessionQueue({ preferTodo: true });
      updateProgress();
      updateKnownProgress();
      if (!session.getQueue().length) {
        renderSessionDone();
        status.textContent = practiceAllDone()
          ? 'Đã làm hết bộ này.'
          : filterMode === 'wrong' ? 'Không còn câu sai trong phiên.' : 'Không còn câu chưa làm trong phiên.';
        return;
      }
      const item = session.getQueue()[session.getIndex()];
      if (!item) { renderSessionDone(); return; }
      const card = createStudyCard(item, items.indexOf(item), selections, onSelect);
      card.classList.add('study-session-card');
      list.replaceChildren(card);
      updateSessionNav();
      status.textContent = `Đang làm phiên · ${session.getIndex() + 1} / ${session.getQueue().length}` + (topic ? ' ' + topic.unit : '');
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
  const loadCollections = async getJSON => {
    try {
      const data = await getJSON('./study-data/collections.json');
      if (!data || !Array.isArray(data.collections)) throw new Error('Invalid collections');
      collections = data.collections;
      collectionsError = '';
    } catch (error) {
      collections = [];
      collectionsError = String(error && error.message || error);
      console.warn('[study-collections]', collectionsError);
    }
  };

  const applyRestoredScroll = () => {
    if (restoreListScroll == null) return;
    const y = restoreListScroll;
    restoreListScroll = null;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  };
  const load = async ({ restoreList = false, forceCollections = false } = {}) => {
    const request = ++version;
    if (dialog.open) dialog.close();
    progressMenu.open = false;
    exitFlashMode({ renderList: false, updateHash: false });
    ready = false; progress.hidden = true; knownProgress.hidden = true;
    if (flashFab) flashFab.hidden = true;
    restoreListScroll = null;
    activeCollection = null;
    activeFolder = null;
    list.replaceChildren(); retry.hidden = true; notice.hidden = true;
    list.setAttribute('aria-busy', 'true');
    status.textContent = 'Đang tải tài liệu…';
    route = parseStudyHash();
    const wantFlash = route.flash;
    title.textContent = 'Tài liệu ôn tập N3 tổng hợp';
    try {
      const getJSON = async path => {
        const url = new URL(path, import.meta.url);
        url.searchParams.set('v', DATA_VERSION);
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      };
      if (!topics) topics = await getJSON('./study-data/topics.json');
      if ((!collections.length && !collectionsError) || forceCollections) await loadCollections(getJSON);
      if (request !== version) return;

      if (route.kind === 'invalid') throw new Error('Unknown pack route');

      if (route.kind === 'collection' || route.kind === 'folder') {
        if (collectionsError) throw new Error('Collections unavailable');
        activeCollection = collections.find(item => item.id === route.collectionId);
        if (!activeCollection) throw new Error('Unknown collection');
        if (route.kind === 'folder') {
          activeFolder = (activeCollection.folders || []).find(item => item.id === route.folderId);
          if (!activeFolder) throw new Error('Unknown folder');
        }
        topic = null;
        items = [];
        practiceItems = [];
        gradable = [];
        knownMode = false;
        known = new Set();
        title.textContent = route.kind === 'folder' ? activeFolder.title : activeCollection.title;
        document.title = title.textContent + ' · JLPT N3';
        back.href = route.kind === 'folder' ? '#pack/' + activeCollection.id : '#';
        back.setAttribute('aria-label', route.kind === 'folder' ? 'Về mục tổng hợp' : 'Về danh mục tài liệu');
        renderBreadcrumb(route.kind === 'folder'
          ? [
            { label: 'Tài liệu ôn tập', href: '#' },
            { label: activeCollection.title, href: '#pack/' + activeCollection.id },
            { label: activeFolder.title },
          ]
          : [
            { label: 'Tài liệu ôn tập', href: '#' },
            { label: activeCollection.title },
          ]);
        search.hidden = false;
        document.querySelector('label[for="study-search"]')?.removeAttribute('hidden');
        search.placeholder = route.kind === 'folder'
          ? 'Tìm bộ tài liệu trong thư mục…'
          : 'Tìm thư mục hoặc bộ trong mục tổng hợp…';
        notice.hidden = true;
        const listState = restoreList ? loadListState(listRouteKey(route)) : null;
        if (listState) {
          search.value = listState.search;
          restoreListScroll = listState.scrollY;
        }
        ready = true;
        hideStudyChrome();
        render();
        applyRestoredScroll();
        return;
      }

      const selected = route.kind === 'topic' ? topics.find(item => item.id === route.id) : null;
      if (route.kind === 'topic' && !selected) throw new Error('Unknown topic');
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
      } else {
        items = topics;
        clearPackReturn();
      }
      topic = selected;
      if (topic) {
        pruneStudyProgress(topic.id, items);
        pruneStudyKnown(topic.id, items);
      }
      ({ selections, results } = hydrateStudyProgress(items, topic ? loadStudyProgress()[topic.id] : {}));
      practiceItems = topic ? items.filter(item => item.type === 'practice') : [];
      gradable = practiceItems.filter(hasAnswer);
      filterMode = 'all';
      session.setLimit(null);
      session.clearQueue();
      session.setIndex(0);
      viewMode = practiceItems.length && practiceItems.length === items.length ? 'session' : 'list';
      const catalogState = isFlatCatalog() ? (restoreList ? loadListState('catalog') : loadCatalogState()) : null;
      if (isFlatCatalog()) {
        const allowed = new Set(['all', ...STUDY_GROUPS.map(group => group.id)]);
        groupFilter = catalogState && allowed.has(catalogState.groupFilter) ? catalogState.groupFilter : 'all';
        if (restoreList && catalogState) {
          search.value = catalogState.search;
          restoreListScroll = catalogState.scrollY;
        }
      }
      knownMode = !!topic && items.every(item => item.type !== 'practice') && items.some(item => ['reading', 'vocabulary', 'grammar', 'tips'].includes(item.type));
      known = knownMode ? hydrateStudyKnown(items, loadStudyKnown()[topic.id]) : new Set();
      knownFilter = 'all';
      search.hidden = false;
      document.querySelector('label[for="study-search"]')?.removeAttribute('hidden');
      search.placeholder = topic ? 'Tìm tiếng Nhật hoặc nghĩa tiếng Việt…' : 'Tìm tài liệu hoặc nhóm…';
      if (topic) {
        const packBack = resolvePackReturn(topic.id, collections);
        back.href = packBack || '#';
        back.setAttribute('aria-label', packBack ? 'Về thư mục tổng hợp' : 'Về danh mục tài liệu');
        const crumbs = [{ label: 'Tài liệu ôn tập', href: '#' }];
        if (packBack) {
          const parsed = parseStudyHash(packBack);
          const collection = collections.find(item => item.id === parsed.collectionId);
          const folder = collection?.folders?.find(item => item.id === parsed.folderId);
          if (collection) crumbs.push({ label: collection.title, href: '#pack/' + collection.id });
          if (folder) crumbs.push({ label: folder.title, href: packBack });
        }
        crumbs.push({ label: topic.title });
        renderBreadcrumb(crumbs);
      } else {
        back.href = './settings.html';
        back.setAttribute('aria-label', 'Về Cài đặt');
        renderBreadcrumb([]);
      }
      if (viewMode === 'session') refreshSessionQueue({ preferTodo: true });
      ready = true; render();
      if (wantFlash && knownMode) enterFlashMode({ all: false });
      else applyRestoredScroll();
    } catch {
      if (request !== version) return;
      ready = false;
      hideStudyChrome();
      renderBreadcrumb([{ label: 'Tài liệu ôn tập', href: '#' }]);
      back.href = '#';
      back.setAttribute('aria-label', 'Về danh mục tài liệu');
      const packMissing = route.kind === 'collection' || route.kind === 'folder' || route.kind === 'invalid';
      const topicMissing = route.kind === 'topic' && topics && !topics.some(item => item.id === route.id);
      status.textContent = packMissing || topicMissing
        ? 'Không tìm thấy mục này. Hãy quay lại danh mục.'
        : 'Chưa tải được tài liệu. Kiểm tra kết nối rồi thử lại.';
      const home = el('a', '← Về danh mục tài liệu', 'study-folder-empty-back');
      home.href = '#';
      list.replaceChildren(home);
      retry.hidden = false;
    } finally { if (request === version) list.setAttribute('aria-busy', 'false'); }
  };
  search.addEventListener('input', () => { render(); persistListUi(); });
  retry.addEventListener('click', () => load({ forceCollections: true }));
  window.addEventListener('scroll', () => { if (ready && isListView(route)) persistListUi(); }, { passive: true });
  window.addEventListener('hashchange', () => {
    const next = parseStudyHash();
    const sameSearchScope = (route.kind === next.kind) &&
      route.collectionId === next.collectionId &&
      route.folderId === next.folderId;
    if (isListView(route)) persistListUi(route);
    if (!isListView(next)) {
      // Entering topic/detail — start at top; list scroll already saved.
      window.scrollTo(0, 0);
    } else if (!sameSearchScope) {
      // Entering another list — restore that list's search; scroll applied after render.
      const saved = loadListState(listRouteKey(next));
      search.value = saved?.search || '';
    }
    load({ restoreList: isListView(next) });
  });
  const bootRoute = parseStudyHash();
  await load({ restoreList: isListView(bootRoute) });
  if (typeof window !== 'undefined' && window.__STUDY_BOOT__) {
    window.__STUDY_BOOT__.ready = true;
    window.__STUDY_BOOT__.phase = 'ready';
  }
}
const markBoot = (phase, extra = {}) => {
  if (typeof window === 'undefined' || !window.__STUDY_BOOT__) return;
  window.__STUDY_BOOT__.phase = phase;
  Object.assign(window.__STUDY_BOOT__, extra);
};
if (typeof document !== 'undefined') {
  markBoot('starting');
  Promise.resolve()
    .then(() => startStudy())
    .then(() => markBoot('ready', { ready: true }))
    .catch(error => {
      markBoot('error', { ready: false, errorMessage: String(error && error.message || error) });
      console.error('[study-boot]', {
        release: window.__STUDY_BOOT__?.release,
        phase: 'startStudy',
        message: String(error && error.message || error),
        asset: import.meta.url,
      });
      window.dispatchEvent(new CustomEvent('study-boot-error', { detail: { phase: 'startStudy', error } }));
    });
}
