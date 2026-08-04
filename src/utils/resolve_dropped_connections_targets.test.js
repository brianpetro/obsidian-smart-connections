import test from 'ava';
import {
  SMART_DRAG_DATA_TYPE,
  write_smart_drag_data,
} from 'obsidian-smart-env/src/utils/smart_drag_drop.js';
import { resolve_dropped_connections_targets } from './resolve_dropped_connections_targets.js';

function create_data_transfer(data = {}) {
  return {
    data: { ...data },
    files: [],
    get types() {
      return Object.keys(this.data);
    },
    getData(type) {
      return this.data[type] || '';
    },
    setData(type, value) {
      this.data[type] = value;
    },
  };
}

function create_env() {
  const sources = {
    'Projects/Alpha.md': {
      key: 'Projects/Alpha.md',
      collection_key: 'smart_sources',
      vec: [1],
    },
    'Archive/Alpha.md': {
      key: 'Archive/Alpha.md',
      collection_key: 'smart_sources',
      vec: [1],
    },
    'Unindexed.md': {
      key: 'Unindexed.md',
      collection_key: 'smart_sources',
      vec: null,
    },
    'Archive/Unindexed.md': {
      key: 'Archive/Unindexed.md',
      collection_key: 'smart_sources',
      vec: [1],
    },
    'Acme.md': {
      key: 'Acme.md',
      collection_key: 'smart_sources',
      vec: [1],
    },
  };
  const blocks = {
    'Projects/Alpha.md#Heading': {
      key: 'Projects/Alpha.md#Heading',
      collection_key: 'smart_blocks',
      vec: [1],
    },
  };
  const contexts = {
    'context-1': {
      key: 'context-1',
      collection_key: 'smart_contexts',
      vec: [1],
    },
  };

  return {
    smart_blocks: {
      items: blocks,
      get(key) { return blocks[key]; },
    },
    smart_contexts: {
      items: contexts,
      get(key) { return contexts[key]; },
    },
    smart_sources: {
      items: sources,
      fs: {
        base_path: '/vault',
        file_paths: Object.keys(sources),
        folder_paths: [
          'Projects',
          'Archive',
          'Acme',
        ],
      },
      get(key) { return sources[key]; },
    },
  };
}

test('resolve_dropped_connections_targets resolves one Smart source or block', (t) => {
  const env = create_env();
  const source_transfer = create_data_transfer();
  const block_transfer = create_data_transfer();
  write_smart_drag_data(source_transfer, env.smart_sources.get('Projects/Alpha.md'));
  write_smart_drag_data(block_transfer, env.smart_blocks.get('Projects/Alpha.md#Heading'));

  t.deepEqual(resolve_dropped_connections_targets(env, source_transfer), [
    env.smart_sources.get('Projects/Alpha.md'),
  ]);
  t.deepEqual(resolve_dropped_connections_targets(env, block_transfer), [
    env.smart_blocks.get('Projects/Alpha.md#Heading'),
  ]);
});

test('resolve_dropped_connections_targets resolves one native absolute file path', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': '/vault/Projects/Alpha.md',
  });

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), [
    env.smart_sources.get('Projects/Alpha.md'),
  ]);
});

test('resolve_dropped_connections_targets resolves a File Navigator file object', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer();
  data_transfer.files = [
    { path: '/vault/Projects/Alpha.md' },
  ];

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), [
    env.smart_sources.get('Projects/Alpha.md'),
  ]);
});

test('resolve_dropped_connections_targets resolves an exact native block', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': 'Projects/Alpha.md#Heading',
  });

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), [
    env.smart_blocks.get('Projects/Alpha.md#Heading'),
  ]);
});

test('resolve_dropped_connections_targets deduplicates repeated native representations', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': 'Projects/Alpha.md',
  });
  data_transfer.files = [
    { path: '/vault/Projects/Alpha.md' },
  ];

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), [
    env.smart_sources.get('Projects/Alpha.md'),
  ]);
});

test('resolve_dropped_connections_targets retains several valid Smart targets for caller rejection', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer();
  write_smart_drag_data(data_transfer, [
    env.smart_sources.get('Projects/Alpha.md'),
    env.smart_blocks.get('Projects/Alpha.md#Heading'),
  ]);

  t.is(resolve_dropped_connections_targets(env, data_transfer).length, 2);
});

test('resolve_dropped_connections_targets rejects a mixed unsupported Smart batch', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': '/vault/Projects/Alpha.md',
  });
  write_smart_drag_data(data_transfer, [
    env.smart_sources.get('Projects/Alpha.md'),
    {
      collection_key: 'smart_contexts',
      key: 'context-1',
    },
  ]);

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});

test('resolve_dropped_connections_targets rejects a mixed unresolved Smart batch', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': '/vault/Projects/Alpha.md',
  });
  write_smart_drag_data(data_transfer, [
    env.smart_sources.get('Projects/Alpha.md'),
    {
      collection_key: 'smart_sources',
      key: 'Missing.md',
    },
  ]);

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});

test('resolve_dropped_connections_targets rejects a mixed unindexed Smart batch', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': '/vault/Projects/Alpha.md',
  });
  write_smart_drag_data(data_transfer, [
    env.smart_sources.get('Projects/Alpha.md'),
    env.smart_sources.get('Unindexed.md'),
  ]);

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});

test('resolve_dropped_connections_targets does not fall back for malformed Smart data', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    [SMART_DRAG_DATA_TYPE]: '{not-json',
    'text/plain': '/vault/Projects/Alpha.md',
  });

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});

test('resolve_dropped_connections_targets makes exact unindexed native files terminal', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': 'Unindexed.md',
  });

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});

test('resolve_dropped_connections_targets rejects ambiguous native paths', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': 'Alpha.md',
  });

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});

test('resolve_dropped_connections_targets rejects outside-vault absolute paths', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': '/outside/Projects/Alpha.md',
  });

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});

test('resolve_dropped_connections_targets rejects inferred file and folder collisions', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': 'Acme',
  });

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});

test('resolve_dropped_connections_targets rejects mixed native files and folders', (t) => {
  const env = create_env();
  const data_transfer = create_data_transfer({
    'text/plain': 'Projects/Alpha.md\nProjects/',
  });

  t.deepEqual(resolve_dropped_connections_targets(env, data_transfer), []);
});
