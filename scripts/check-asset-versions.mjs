#!/usr/bin/env node
/** Fail if study module graph / HTML / SW release ids diverge. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseSource = fs.readFileSync(path.join(ROOT, 'release.js'), 'utf8');
const releaseMatch = releaseSource.match(/export const RELEASE = '(\d+)'/);
if (!releaseMatch) {
  console.error('check-asset-versions FAIL: cannot parse RELEASE');
  process.exit(1);
}
const RELEASE = releaseMatch[1];
const errors = [];

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const studyFiles = ['study.js', 'study-render.js', 'study-flash.js'];
for (const file of studyFiles) {
  const text = read(file);
  const imports = [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map(match => match[1]);
  for (const spec of imports) {
    if (!spec.includes('?v=')) {
      errors.push(`${file}: unversioned import ${spec}`);
      continue;
    }
    if (!spec.endsWith(`?v=${RELEASE}`)) {
      errors.push(`${file}: import ${spec} does not use RELEASE=${RELEASE}`);
    }
    const base = spec.split('?')[0].replace(/^\.\//, '');
    if (!fs.existsSync(path.join(ROOT, base))) {
      errors.push(`${file}: missing file for ${spec}`);
    }
  }
}

const html = read('study.html');
if (!html.includes(`study.js?v=${RELEASE}`)) errors.push(`study.html missing study.js?v=${RELEASE}`);
if (!html.includes(`study.css?v=${RELEASE}`)) errors.push(`study.html missing study.css?v=${RELEASE}`);
if (!html.includes(`release: '${RELEASE}'`)) errors.push('study.html boot release mismatch');

const sw = read('sw.js');
if (!sw.includes(`const RELEASE = '${RELEASE}'`)) errors.push('sw.js RELEASE mismatch');
for (const name of ['study.js', 'study-render.js', 'study-storage.js', 'study-session.js', 'study-flash.js', 'grammar.js']) {
  if (!sw.includes(`${name}?v=\${RELEASE}`) && !sw.includes(`${name}?v=${RELEASE}`)) {
    errors.push(`sw.js ASSETS missing versioned ${name}`);
  }
}
if (/skipWaiting\(\)/.test(sw) && !/SKIP_WAITING/.test(sw)) {
  errors.push('sw.js still auto skipWaiting without message gate');
}
const installBlock = sw.match(/addEventListener\(\s*'install'\s*,[\s\S]*?\n\}\);/);
if (installBlock && /skipWaiting\(\)/.test(installBlock[0])) {
  errors.push('sw.js install handler must not call skipWaiting()');
}

const register = read('register-sw.js');
if (!register.includes('SKIP_WAITING')) errors.push('register-sw.js missing SKIP_WAITING flow');
if (!register.includes('jlpt-sw-update')) errors.push('register-sw.js missing update banner');

if (errors.length) {
  console.error('check-asset-versions FAIL:', errors.length);
  for (const line of errors) console.error(' -', line);
  process.exit(1);
}
console.log('check-asset-versions PASS: RELEASE', RELEASE);
