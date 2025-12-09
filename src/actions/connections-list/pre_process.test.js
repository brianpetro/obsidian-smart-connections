import test from 'ava';
import { pre_process } from './pre_process.js';

function build_connections_list({ connections_state = {}, results_collection_key = 'notes' } = {}) {
  const items = new Map();
  Object.keys(connections_state).forEach((prefixed_key) => {
    const [, item_key] = prefixed_key.split(':');
    if (!item_key) return;
    items.set(item_key, {
      key: item_key,
      collection_key: results_collection_key,
      data: {},
    });
  });
  const collection = {
    results_collection_key,
    score_algo_key: 'default',
    get: (key) => items.get(key),
  };

  const env = {
    [results_collection_key]: collection,
  };

  const item = {
    key: 'center',
    collection_key: results_collection_key,
    data: { connections: connections_state },
    env,
  };

  return {
    item,
    env,
    collection,
    settings: { results_limit: 5 },
    apply_style_sheet: () => {},
  };
}

test('rebuilds pinned and hidden arrays on each pre_process call', (t) => {
  const connections_state = {
    'notes:pinned': { pinned: true },
    'notes:hidden': { hidden: true },
  };
  const connections_list = build_connections_list({ connections_state });
  const params = { filter: {} };

  pre_process.call(connections_list, params);

  t.deepEqual(params.pinned_keys, ['pinned']);
  t.deepEqual(params.hidden_keys, ['hidden']);
  t.deepEqual(params.filter.exclude_keys, ['center', 'hidden', 'pinned']);

  pre_process.call(connections_list, params);

  t.deepEqual(params.pinned_keys, ['pinned']);
  t.deepEqual(params.hidden_keys, ['hidden']);
  t.deepEqual(params.filter.exclude_keys, ['center', 'hidden', 'pinned']);
});

test('treats hidden and pinned entries as pinned for scoring', (t) => {
  const connections_state = {
    'notes:dual': { hidden: true, pinned: true },
  };
  const connections_list = build_connections_list({ connections_state });
  const params = { filter: {} };

  pre_process.call(connections_list, params);

  t.deepEqual(params.pinned_keys, ['dual']);
  t.deepEqual(params.hidden_keys, []);
  t.deepEqual(params.filter.exclude_keys, ['center', 'dual']);
});
