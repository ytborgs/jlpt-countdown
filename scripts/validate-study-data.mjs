#!/usr/bin/env node
/** Pre-deploy gate: topics, ids, ruby join, answer keys. Exit 1 on failure. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'study-data');
const RUBY_PAIRS = [
  ['pattern', 'pattern_ruby'],
  ['stem_jp', 'stem_ruby'],
  ['lemma_jp', 'lemma_ruby'],
  ['example_jp', 'example_ruby'],
  ['connector_jp', 'connector_ruby'],
];

const errors = [];
const warn = [];

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const topics = readJson(path.join(DIR, 'topics.json'));
if (!Array.isArray(topics) || topics.length === 0) errors.push('topics.json missing or empty');

const seenTopicIds = new Set();
for (const topic of topics) {
  if (!topic?.id || !topic?.path || typeof topic.count !== 'number') {
    errors.push(`topic invalid: ${JSON.stringify(topic?.id)}`);
    continue;
  }
  if (seenTopicIds.has(topic.id)) errors.push(`duplicate topic id: ${topic.id}`);
  seenTopicIds.add(topic.id);
  const file = path.join(DIR, path.basename(topic.path));
  if (!fs.existsSync(file)) {
    errors.push(`missing file for ${topic.id}: ${topic.path}`);
    continue;
  }
  const data = readJson(file);
  const items = data.items;
  if (!Array.isArray(items)) {
    errors.push(`${topic.id}: items not array`);
    continue;
  }
  if (items.length !== topic.count) {
    errors.push(`${topic.id}: count ${topic.count} != items ${items.length}`);
  }
  const ids = new Set();
  for (const item of items) {
    if (!item?.id) {
      errors.push(`${topic.id}: item missing id`);
      continue;
    }
    if (ids.has(item.id)) errors.push(`${topic.id}: duplicate item id ${item.id}`);
    ids.add(item.id);

    for (const [baseKey, rubyKey] of RUBY_PAIRS) {
      const base = item[baseKey];
      const ruby = item[rubyKey];
      if (!Array.isArray(ruby)) continue;
      if (typeof base !== 'string') {
        errors.push(`${topic.id}/${item.id}: ${rubyKey} present but ${baseKey} not string`);
        continue;
      }
      if (!ruby.every(seg => seg && typeof seg.text === 'string')) {
        errors.push(`${topic.id}/${item.id}: ${rubyKey} has invalid segment`);
        continue;
      }
      const joined = ruby.map(seg => seg.text).join('');
      if (joined !== base) {
        errors.push(`${topic.id}/${item.id}: ${rubyKey} join !== ${baseKey}`);
      }
    }

    if (item.type === 'practice' && Array.isArray(item.choices)) {
      const keys = item.choices.map(c => String(c.key));
      if (item.correct_answer != null) {
        if (!keys.includes(String(item.correct_answer))) {
          errors.push(`${topic.id}/${item.id}: correct_answer not in choices`);
        }
      }
      if (Array.isArray(item.choice_analyses)) {
        for (const row of item.choice_analyses) {
          if (row?.status === 'correct' && item.correct_answer != null &&
              String(row.key) !== String(item.correct_answer)) {
            errors.push(`${topic.id}/${item.id}: choice_analyses correct key mismatch`);
          }
        }
      }
      if (item.subtype === 'star_rearrange') {
        const order = item.correct_order;
        const star = item.star_position;
        if (!Array.isArray(order) || order.length !== 4) {
          errors.push(`${topic.id}/${item.id}: star correct_order must be length 4`);
        } else if ([...order].map(String).sort().join() !== [...keys].sort().join()) {
          errors.push(`${topic.id}/${item.id}: correct_order must permute choice keys`);
        }
        if (!Number.isInteger(star) || star < 1 || star > 4) {
          errors.push(`${topic.id}/${item.id}: invalid star_position ${star}`);
        } else if (Array.isArray(order) && item.correct_answer != null &&
            String(order[star - 1]) !== String(item.correct_answer)) {
          errors.push(`${topic.id}/${item.id}: correct_answer != key at ★`);
        }
        if (!item.completed_jp || !item.completed_vi) {
          errors.push(`${topic.id}/${item.id}: missing completed_jp/vi`);
        }
        if (!Array.isArray(item.grammar_points) || !item.grammar_points.length) {
          errors.push(`${topic.id}/${item.id}: missing grammar_points`);
        }
      }
    }
  }
}

const collectionsPath = path.join(DIR, 'collections.json');
if (!fs.existsSync(collectionsPath)) {
  errors.push('collections.json missing');
} else {
  const collectionsDoc = readJson(collectionsPath);
  const collections = collectionsDoc?.collections;
  if (!Array.isArray(collections)) {
    errors.push('collections.json: collections must be array');
  } else {
    const seenCollectionIds = new Set();
    for (const collection of collections) {
      if (!collection?.id || !collection?.title || !Array.isArray(collection.folders)) {
        errors.push(`collection invalid: ${JSON.stringify(collection?.id)}`);
        continue;
      }
      if (seenCollectionIds.has(collection.id)) errors.push(`duplicate collection id: ${collection.id}`);
      seenCollectionIds.add(collection.id);
      const seenFolderIds = new Set();
      for (const folder of collection.folders) {
        if (!folder?.id || !folder?.title || !Array.isArray(folder.topicIds)) {
          errors.push(`folder invalid in ${collection.id}: ${JSON.stringify(folder?.id)}`);
          continue;
        }
        if (seenFolderIds.has(folder.id)) errors.push(`duplicate folder id in ${collection.id}: ${folder.id}`);
        seenFolderIds.add(folder.id);
        const seenTopicRefs = new Set();
        for (const topicId of folder.topicIds) {
          if (typeof topicId !== 'string' || !topicId) {
            errors.push(`${collection.id}/${folder.id}: invalid topicId`);
            continue;
          }
          if (seenTopicRefs.has(topicId)) {
            errors.push(`${collection.id}/${folder.id}: duplicate topicId ${topicId}`);
          }
          seenTopicRefs.add(topicId);
          if (!seenTopicIds.has(topicId)) {
            errors.push(`${collection.id}/${folder.id}: unknown topicId ${topicId}`);
          }
        }
      }
    }
  }
}

if (errors.length) {
  console.error('validate-study-data FAIL:', errors.length);
  for (const line of errors.slice(0, 50)) console.error(' -', line);
  if (errors.length > 50) console.error(` ... +${errors.length - 50} more`);
  process.exit(1);
}
console.log('validate-study-data PASS:', topics.length, 'topics');
if (warn.length) for (const line of warn) console.warn(' !', line);
