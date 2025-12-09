import test from 'ava';
import { migrate_hidden_connections } from './migrate_hidden_connections.js';

function create_source(overrides = {}) {
  return {
    data: {
      connections: {},
      ...overrides.data,
    },
    ...overrides,
  };
}

test('migrates legacy hidden_connections to connections map with prefixed keys', t => {
  const hidden_at = 1700000000000;
  const block_hidden_at = 1700000100000;
  const source = create_source({
    data: {
      hidden_connections: {
        'Folder/Note.md': hidden_at,
        'Folder/Note.md#^block': block_hidden_at,
      },
    },
  });

  const migrated = migrate_hidden_connections(source);

  t.true(migrated);
  t.deepEqual(source.data.connections, {
    'smart_sources:Folder/Note.md': { hidden: hidden_at },
    'smart_blocks:Folder/Note.md#^block': { hidden: block_hidden_at },
  });
  t.false('hidden_connections' in source.data);
});

test('merges with existing connections and preserves other fields', t => {
  const hidden_at = 1700000200000;
  const source = create_source({
    data: {
      connections: {
        'smart_sources:Existing.md': { pinned: 1700000000000 },
        'smart_blocks:Folder/Note.md#^block': { pinned: 1, hidden: 42 },
      },
      hidden_connections: {
        'Folder/Note.md#^block': hidden_at,
        'Another.md': hidden_at,
      },
    },
  });

  migrate_hidden_connections(source);

  t.deepEqual(source.data.connections, {
    'smart_sources:Existing.md': { pinned: 1700000000000 },
    'smart_blocks:Folder/Note.md#^block': { pinned: 1, hidden: 42 },
    'smart_sources:Another.md': { hidden: hidden_at },
  });
});

test('returns false when there is nothing to migrate', t => {
  t.false(migrate_hidden_connections(create_source()));
});
