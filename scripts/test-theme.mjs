import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const KEY = 'jlpt-n3-theme-v1';
const source = fs.readFileSync(new URL('../theme.js', import.meta.url), 'utf8');
const boot = ({ dark = false, stored, blocked = false, legacy = false } = {}) => {
  const values = new Map([['jlpt-study-progress-v1', 'keep-progress']]);
  if (stored !== undefined) values.set(KEY, stored);
  const windowEvents = {}, documentEvents = {};
  const inputs = ['system', 'light', 'dark'].map(value => ({ value, checked: false,
    matches: selector => selector === 'input[name="theme"]' }));
  const meta = {}, error = { hidden: true }, root = { dataset: {} };
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  let systemListener;
  const media = { matches: dark };
  if (legacy) media.addListener = listener => { systemListener = listener; };
  else media.addEventListener = (_, listener) => { systemListener = listener; };
  const sandbox = {
    document: {
      documentElement: root,
      querySelector: () => meta,
      querySelectorAll: () => inputs,
      getElementById: () => error,
      addEventListener: (name, listener) => { documentEvents[name] = listener; },
    },
    window: {
      matchMedia: () => media,
      addEventListener: (name, listener) => { windowEvents[name] = listener; },
    },
  };
  Object.defineProperty(sandbox, 'localStorage', { get() {
    if (blocked) throw new Error('Storage blocked');
    return storage;
  } });
  vm.runInNewContext(source, sandbox);
  return {
    root, meta, error, values, inputs,
    choose: value => documentEvents.change({ target: inputs.find(input => input.value === value) }),
    system: value => { media.matches = value; systemListener(); },
    sync: value => {
      if (value === null) values.delete(KEY); else values.set(KEY, value);
      windowEvents.storage({ key: KEY, storageArea: storage });
    },
    restore: () => windowEvents.pageshow(),
    ready: () => documentEvents.DOMContentLoaded(),
  };
};

for (const dark of [true, false]) {
  const app = boot({ dark });
  assert.equal(app.root.dataset.theme, dark ? 'dark' : 'light', 'theme resolved synchronously');
  app.ready();
  assert(app.inputs[0].checked);
  app.choose('dark');
  app.system(false);
  assert.equal(app.root.dataset.theme, 'dark', 'explicit preference wins');
  assert.equal(app.values.get(KEY), 'dark');
  assert.equal(boot({ dark: false, stored: app.values.get(KEY) }).root.dataset.theme, 'dark');
  app.choose('light');
  app.system(true);
  assert.equal(app.root.dataset.theme, 'light');
  assert.equal(app.meta.content, '#f5f0e6');
  app.choose('system');
  assert.equal(app.root.dataset.theme, 'dark');
  app.system(false);
  assert.equal(app.root.dataset.theme, 'light');
  app.sync('dark');
  assert.equal(app.root.dataset.theme, 'dark', 'cross-tab preference updates');
  app.sync(null);
  assert.equal(app.root.dataset.theme, 'light', 'removed key returns to system');
  app.values.set(KEY, 'dark');
  app.restore();
  assert.equal(app.root.dataset.theme, 'dark', 'bfcache restore refreshes preference');
  assert.equal(app.values.get('jlpt-study-progress-v1'), 'keep-progress');
}
assert.equal(boot({ dark: true, stored: 'invalid' }).root.dataset.theme, 'dark');
const blocked = boot({ dark: true, blocked: true });
blocked.choose('light');
assert.equal(blocked.root.dataset.theme, 'light');
assert.equal(blocked.error.hidden, false);
blocked.sync('dark'); // A storage event must not throw when localStorage access is denied.
const legacy = boot({ legacy: true });
legacy.system(true);
assert.equal(legacy.root.dataset.theme, 'dark');

for (const file of ['index.html', 'settings.html', 'profile.html', 'grammar.html', 'study.html']) {
  const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert(html.indexOf('theme.js?v=') < html.indexOf('rel="stylesheet"'), `${file}: theme before styles`);
}
console.log('test-theme PASS: first paint, system/explicit, persistence, cross-tab, bfcache, denied storage');
