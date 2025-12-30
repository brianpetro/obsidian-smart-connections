import test from 'ava';

import { build_connections_context_items } from './connections_context_items.js';

test('includes the source item before visible results', t => {
  const source_item = { key: 'note-a' };
  const results = [
    { item: { key: 'note-b' }, score: 0.8 },
    { item: { key: 'note-c' }, score: 0.6 }
  ];

  const context_items = build_connections_context_items({ source_item, results });

  t.deepEqual(context_items, [
    { key: 'note-a', score: 1 },
    { key: 'note-b', score: 0.8 },
    { key: 'note-c', score: 0.6 }
  ]);
});

test('deduplicates by key while preserving scores', t => {
  const source_item = { key: 'note-a', score: 0.5 };
  const results = [
    { item: { key: 'note-a' }, score: 0.9 },
    { item: { key: 'note-b' }, score: 0.7 },
    { item: { key: 'note-b' }, score: 0.4 },
    { item: { key: null }, score: 0.3 }
  ];

  const context_items = build_connections_context_items({ source_item, results });

  t.deepEqual(context_items, [
    { key: 'note-a', score: 0.5 },
    { key: 'note-b', score: 0.7 }
  ]);
});

test('handles missing source by returning visible results only', t => {
  const results = [
    { item: { key: 'note-b' }, score: 0.7 },
    { item: { key: 'note-c' }, score: 0.4 }
  ];

  const context_items = build_connections_context_items({ results });

  t.deepEqual(context_items, [
    { key: 'note-b', score: 0.7 },
    { key: 'note-c', score: 0.4 }
  ]);
});
