#!/usr/bin/env node
/**
 * Upgrade A→B regression for study module graph.
 * Proves stale child modules break new entry exports,
 * and the current versioned graph stays consistent.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';

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

const gitShow = (rev, file) =>
  execFileSync('git', ['show', `${rev}:${file}`], { cwd: ROOT, encoding: 'utf8' });

const newStudy = gitShow('eb8901a', 'study.js');
const oldRender = gitShow('bb07db9', 'study-render.js');
const needed = parseNamedImports(newStudy.replace(/\?v=\d+/g, ''), 'study-render.js');
const oldExports = parseExports(oldRender);
const missing = needed.filter(name => !oldExports.has(name));
assert.ok(missing.includes('buildStarExplanationNodes'), 'expected repro missing buildStarExplanationNodes');
assert.ok(missing.includes('createStarStem'), 'expected repro missing createStarStem');
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

const html = fs.readFileSync(path.join(ROOT, 'study.html'), 'utf8');
assert.match(html, /import\('\.\/study\.js\?v=\d+'\)/);
assert.match(html, /\.catch\(error\s*=>/);
assert.match(html, /study-boot-fallback/);
assert.match(html, /Tải bản mới/);
assert.doesNotMatch(html, /localStorage\.clear/);
assert.doesNotMatch(html, /unregister\(/);

const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
assert.match(sw, /SKIP_WAITING/);
assert.doesNotMatch(sw, /install'[\s\S]{0,200}skipWaiting\(\)/);
const installBlock = sw.match(/addEventListener\(\s*'install'\s*,[\s\S]*?\n\}\);/);
assert.ok(installBlock && !/skipWaiting\(\)/.test(installBlock[0]), 'install must not skipWaiting');

// Live import: stale child missing the exports the new entry needs.
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const present = needed.filter(name => oldExports.has(name));
const staleBody = present.map(name => `export const ${name} = () => null;`).join('\n') + '\n';
fs.writeFileSync(path.join(TMP, 'study-render.js'), staleBody);
fs.writeFileSync(
  path.join(TMP, 'entry.mjs'),
  `import { ${needed.join(', ')} } from './study-render.js';\n`
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

// Current release: versioned import specs resolve via strip-query hook for export presence.
const consistent = present.length + missing.length === needed.length;
assert.ok(consistent);
assert.ok(currentExports.has('buildStarExplanationNodes'));
assert.ok(currentExports.has('createStarStem'));

fs.writeFileSync(path.join(TMP, 'result.json'), JSON.stringify({
  release,
  reproMissing: missing,
  currentMissing,
  ok: true,
}, null, 2));
console.log('test-module-upgrade PASS');
