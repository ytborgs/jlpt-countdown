/** Practice session queue logic. No DOM / no localStorage. */

export const hasAnswer = item =>
  item.correct_answer != null && item.choices.some(choice => String(choice.key) === String(item.correct_answer));

export const isPracticeAnswered = (item, selections, results) => {
  if (item.type !== 'practice') return false;
  return hasAnswer(item) ? results.has(item.id) : selections.has(item.id);
};

/** `filterStudy` injected so this module stays free of render imports. */
export function buildPracticeSessionQueue(items, selections, results, filterStudy, { query = '', filterMode = 'all', limit = null } = {}) {
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

/** Owns session queue index/limit; study.js owns selections/results Maps. */
export function createSessionController({ filterStudy }) {
  let queue = [];
  let index = 0;
  let limit = null;

  const getQueue = () => queue;
  const getIndex = () => index;
  const getLimit = () => limit;
  const setLimit = value => { limit = value; };
  const setIndex = value => { index = value; };
  const current = () => queue[index];
  const clearQueue = () => { queue = []; index = 0; };

  const refresh = (items, selections, results, { query = '', filterMode = 'all', keepIndex = false, preferTodo = true } = {}) => {
    const previousId = keepIndex ? queue[index]?.id : null;
    queue = buildPracticeSessionQueue(items, selections, results, filterStudy, { query, filterMode, limit });
    if (!queue.length) {
      index = 0;
      return;
    }
    if (previousId) {
      const found = queue.findIndex(item => item.id === previousId);
      if (found >= 0) { index = found; return; }
    }
    if (preferTodo) {
      const firstTodo = queue.findIndex(item => !isPracticeAnswered(item, selections, results));
      index = firstTodo >= 0 ? firstTodo : 0;
    } else {
      index = Math.min(index, queue.length - 1);
    }
  };

  const go = delta => {
    const next = index + delta;
    if (next < 0) return { kind: 'noop' };
    if (next >= queue.length) return { kind: 'end' };
    index = next;
    return { kind: 'move', item: queue[index] };
  };

  const reset = () => {
    queue = [];
    index = 0;
    limit = null;
  };

  return { getQueue, getIndex, getLimit, setLimit, setIndex, current, clearQueue, refresh, go, reset };
}
