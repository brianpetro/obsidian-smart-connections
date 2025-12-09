import test from 'ava';

import {
  apply_hidden_state,
  apply_pinned_state,
  build_prefixed_connection_key,
  count_hidden_connections,
  count_pinned_connections,
  remove_all_hidden_states,
  remove_all_pinned_states,
  remove_hidden_state,
  remove_pinned_state,
  is_connection_hidden,
  is_connection_pinned,
} from './connections_list_item_state.js';

test('build_prefixed_connection_key prefixes collection key when missing', t => {
  const key = build_prefixed_connection_key('smart_sources', 'Folder/Note.md');
  t.is(key, 'smart_sources:Folder/Note.md');
});

test('build_prefixed_connection_key returns original when already prefixed', t => {
  const key = build_prefixed_connection_key('smart_sources', 'smart_blocks:Folder/Note.md#^block');
  t.is(key, 'smart_blocks:Folder/Note.md#^block');
});

test('apply_hidden_state sets hidden timestamp without mutating pinned state', t => {
  const connections = {
    'smart_sources:Other.md': { pinned: 1 },
  };

  const updated = apply_hidden_state(connections, 'smart_sources:Other.md', 123);

  t.is(updated, connections);
  t.deepEqual(updated['smart_sources:Other.md'], { pinned: 1, hidden: 123 });
});

test('remove_hidden_state clears hidden flag and preserves pinned flag', t => {
  const connections = {
    'smart_sources:Other.md': { hidden: 456, pinned: 1 },
  };

  const updated = remove_hidden_state(connections, 'smart_sources:Other.md');

  t.is(updated, connections);
  t.deepEqual(updated['smart_sources:Other.md'], { pinned: 1 });
});

test('apply_pinned_state sets pinned timestamp without disturbing hidden state', t => {
  const connections = {
    'smart_sources:Hidden.md': { hidden: 123 },
  };

  const updated = apply_pinned_state(connections, 'smart_sources:Hidden.md', 555);

  t.is(updated, connections);
  t.deepEqual(updated['smart_sources:Hidden.md'], { hidden: 123, pinned: 555 });
});

test('remove_pinned_state clears pinned flag and retains hidden', t => {
  const connections = {
    'smart_sources:Hidden.md': { hidden: 222, pinned: 333 },
  };

  const updated = remove_pinned_state(connections, 'smart_sources:Hidden.md');

  t.is(updated, connections);
  t.deepEqual(updated['smart_sources:Hidden.md'], { hidden: 222 });
});

test('remove_pinned_state deletes empty records', t => {
  const connections = {
    'smart_sources:Pinned.md': { pinned: 444 },
  };

  const updated = remove_pinned_state(connections, 'smart_sources:Pinned.md');

  t.false(Object.prototype.hasOwnProperty.call(updated, 'smart_sources:Pinned.md'));
});

test('remove_hidden_state deletes empty entries', t => {
  const connections = {
    'smart_sources:Other.md': { hidden: 789 },
  };

  const updated = remove_hidden_state(connections, 'smart_sources:Other.md');

  t.is(updated, connections);
  t.false(Object.prototype.hasOwnProperty.call(updated, 'smart_sources:Other.md'));
});

test('remove_all_hidden_states clears hidden flags and reports if changes applied', t => {
  const connections = {
    'smart_sources:Hidden.md': { hidden: 1 },
    'smart_sources:Pinned.md': { pinned: 2 },
    'smart_sources:Both.md': { hidden: 3, pinned: 4 },
  };

  const changed = remove_all_hidden_states(connections);

  t.true(changed);
  t.deepEqual(connections, {
    'smart_sources:Pinned.md': { pinned: 2 },
    'smart_sources:Both.md': { pinned: 4 },
  });
});

test('remove_all_pinned_states clears pinned flags and reports if changes applied', t => {
  const connections = {
    'smart_sources:Hidden.md': { hidden: 1 },
    'smart_sources:Pinned.md': { pinned: 2 },
    'smart_sources:Both.md': { hidden: 3, pinned: 4 },
  };

  const changed = remove_all_pinned_states(connections);

  t.true(changed);
  t.deepEqual(connections, {
    'smart_sources:Hidden.md': { hidden: 1 },
    'smart_sources:Both.md': { hidden: 3 },
  });
});

test('count_hidden_connections tallies connections with hidden flag', t => {
  const connections = {
    'smart_sources:Hidden.md': { hidden: 1 },
    'smart_sources:Pinned.md': { pinned: 2 },
    'smart_sources:Both.md': { hidden: 3, pinned: 4 },
    'smart_sources:NullHidden.md': { hidden: null },
  };

  t.is(count_hidden_connections(connections), 2);
});

test('count_pinned_connections tallies connections with pinned flag', t => {
  const connections = {
    'smart_sources:Hidden.md': { hidden: 1 },
    'smart_sources:Pinned.md': { pinned: 2 },
    'smart_sources:Both.md': { hidden: 3, pinned: 4 },
    'smart_sources:NullPinned.md': { pinned: null },
  };

  t.is(count_pinned_connections(connections), 2);
});

test('is_connection_pinned returns true only for entries with pinned flag', t => {
  const connections = {
    'smart_sources:Pinned.md': { pinned: 123 },
    'smart_sources:Hidden.md': { hidden: 456 },
  };

  t.true(is_connection_pinned(connections, 'smart_sources:Pinned.md'));
  t.false(is_connection_pinned(connections, 'smart_sources:Hidden.md'));
  t.false(is_connection_pinned(connections, 'smart_sources:Missing.md'));
});

test('is_connection_hidden returns true only for entries with hidden flag', t => {
  const connections = {
    'smart_sources:Pinned.md': { pinned: 123 },
    'smart_sources:Hidden.md': { hidden: 456 },
  };

  t.true(is_connection_hidden(connections, 'smart_sources:Hidden.md'));
  t.false(is_connection_hidden(connections, 'smart_sources:Pinned.md'));
  t.false(is_connection_hidden(connections, 'smart_sources:Missing.md'));
});
