#!/usr/bin/env node
/**
 * Upgrade A→B regression for study module graph.
 * Uses embedded fixtures for the known broken mix (new entry + stale render),
 * so CI shallow clones do not need historical commits.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, '.tmp-upgrade-test');

const parseExports = source => {
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|class|let|var)\s+(\w+)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
};

const parseNamedImports = (source, fromFile) => {
  const out = [];
  const re = new RegExp(String.raw`import\s*\{([^}]+)\}\s*from\s*'\.\/${fromFile}(?:\?v=\d+)?'`, 'g');
  for (const match of source.matchAll(re)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) out.push(name);
    }
  }
  return out;
};

// Fixture mirroring the proven failure: new study.js needed star helpers; old render lacked them.
const FIXTURE_NEEDED = [
  'el',
  'escapeHtml',
  'createRuby',
  'createTopicCard',
  'createStudyCard',
  'createStarStem',
  'buildStarExplanationNodes',
  'filterStudy',
  'setActiveGroupFilter',
  'topicMatchesGroup',
];
const FIXTURE_OLD_EXPORTS = [
  'el',
  'escapeHtml',
  'createRuby',
  'createTopicCard',
  'createStudyCard',
  'filterStudy',
  'setActiveGroupFilter',
  'topicMatchesGroup',
];

const missing = FIXTURE_NEEDED.filter(name => !FIXTURE_OLD_EXPORTS.includes(name));
assert.ok(missing.includes('buildStarExplanationNodes'));
assert.ok(missing.includes('createStarStem'));
console.log('repro A→B mismatch confirmed:', missing.join(', '));

const release = fs.readFileSync(path.join(ROOT, 'release.js'), 'utf8').match(/RELEASE = '(\d+)'/)[1];
const currentStudy = fs.readFileSync(path.join(ROOT, 'study.js'), 'utf8');
const currentRender = fs.readFileSync(path.join(ROOT, 'study-render.js'), 'utf8');
assert.match(currentStudy, new RegExp(String.raw`from '\./study-render\.js\?v=${release}'`));
assert.match(currentRender, new RegExp(String.raw`from '\./grammar\.js\?v=${release}'`));
const currentNeeded = parseNamedImports(currentStudy, 'study-render.js');
const currentExports = parseExports(currentRender);
const currentMissing = currentNeeded.filter(name => !currentExports.has(name));
assert.deepEqual(currentMissing, [], `current graph missing exports: ${currentMissing}`);
for (const name of ['buildStarExplanationNodes', 'createStarStem']) {
  assert.ok(currentExports.has(name), `current render must export ${name}`);
  assert.ok(currentNeeded.includes(name), `current study must import ${name}`);
}

const html = fs.readFileSync(path.join(ROOT, 'study.html'), 'utf8');
assert.match(html, /import\('\.\/study\.js\?v=\d+'\)/);
assert.match(html, /\.catch\(error\s*=>/);
assert.match(html, /study-boot-fallback/);
assert.match(html, /Tải bản mới/);
assert.doesNotMatch(html, /localStorage\.clear/);
assert.doesNotMatch(html, /unregister\(/);

const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
assert.match(sw, /SKIP_WAITING/);
const installBlock = sw.match(/addEventListener\(\s*'install'\s*,[\s\S]*?\n\}\);/);
assert.ok(installBlock && !/skipWaiting\(\)/.test(installBlock[0]), 'install must not skipWaiting');

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const staleBody = FIXTURE_OLD_EXPORTS.map(name => `export const ${name} = () => null;`).join('\n') + '\n';
fs.writeFileSync(path.join(TMP, 'study-render.js'), staleBody);
fs.writeFileSync(
  path.join(TMP, 'entry.mjs'),
  `import { ${FIXTURE_NEEDED.join(', ')} } from './study-render.js';\n`
);
let mixedFailed = false;
try {
  await import(pathToFileURL(path.join(TMP, 'entry.mjs')).href + '?t=' + Date.now());
} catch (error) {
  mixedFailed = true;
  assert.match(String(error && error.message), /buildStarExplanationNodes|does not provide an export/);
  console.log('live mixed import failed as expected');
}
assert.ok(mixedFailed, 'mixed A→B graph must fail to import');

fs.writeFileSync(path.join(TMP, 'result.json'), JSON.stringify({
  release,
  reproMissing: missing,
  currentMissing,
  ok: true,
}, null, 2));
console.log('test-module-upgrade PASS');
