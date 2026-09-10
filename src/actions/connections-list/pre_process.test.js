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
    collection: {
      ...collection,
      frontmatter_inclusions: [],
      frontmatter_exclusions: [],
    },
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

  t.deepEqual(params.pinned, [connections_list.env.notes.get('pinned')]);
  t.deepEqual(params.hidden, [connections_list.env.notes.get('hidden')]);
  t.deepEqual(params.filter.exclude_keys, ['center']);
  t.false('hidden_keys' in params);
  t.false('pinned_keys' in params);

  pre_process.call(connections_list, params);

  t.deepEqual(params.pinned, [connections_list.env.notes.get('pinned')]);
  t.deepEqual(params.hidden, [connections_list.env.notes.get('hidden')]);
  t.deepEqual(params.filter.exclude_keys, ['center']);
});

test('merges singular and plural exact-key exclusions', (t) => {
  const connections_list = build_connections_list();
  const params = {
    filter: {
      exclude_key: 'single',
      exclude_keys: ['plural'],
    },
  };

  pre_process.call(connections_list, params);

  t.deepEqual(params.filter.exclude_keys, ['plural', 'single', 'center']);
});

test('treats hidden and pinned entries as pinned for scoring', (t) => {
  const connections_state = {
    'notes:dual': { hidden: true, pinned: true },
  };
  const connections_list = build_connections_list({ connections_state });
  const params = { filter: {} };

  pre_process.call(connections_list, params);

  t.deepEqual(params.pinned, [connections_list.env.notes.get('dual')]);
  t.deepEqual(params.hidden, []);
  t.deepEqual(params.filter.exclude_keys, ['center']);
});

test('injects parsed frontmatter include/exclude filters from collection', (t) => {
  const connections_list = build_connections_list();
  connections_list.collection.frontmatter_inclusions = [{ key: 'status', value: 'open' }];
  connections_list.collection.frontmatter_exclusions = [{ key: 'type', value: 'draft' }];
  const params = { filter: {} };

  pre_process.call(connections_list, params);

  t.deepEqual(params.filter.frontmatter.include, [{ key: 'status', value: 'open' }]);
  t.deepEqual(params.filter.frontmatter.exclude, [{ key: 'type', value: 'draft' }]);
});

test('pre_process supplies only the owning Connections score settings', t => {
  const list = build_connections_list();
  const own_settings = Object.freeze({ key_weights: { 'Projects/': 2 } });
  list.settings.actions = { default: own_settings };
  list.env.settings = { lookup_lists: { actions: { default: { key_weights: { 'Projects/': 9 } } } } };
  const params = {};
  pre_process.call(list, params);
  t.is(params.score_settings, own_settings);
});

test('pre_process preserves explicit empty score_settings', t => {
  const list = build_connections_list();
  list.settings.actions = { default: { key_weights: { 'Projects/': 2 } } };
  const settings = Object.freeze({});
  const params = { score_settings: settings };
  pre_process.call(list, params);
  t.is(params.score_settings, settings);
});


test('pre_process preserves explicit semantic frontmatter and frontmatter-block settings', t => {
  const list = build_connections_list({ results_collection_key: 'smart_blocks' });
  list.collection.frontmatter_inclusions = [{ key: 'global', value: 'include' }];
  list.collection.frontmatter_exclusions = [{ key: 'global', value: 'exclude' }];
  list.collection.settings = { exclude_frontmatter_blocks: true };
  const params = {
    filter: {
      frontmatter: {
        include: [{ key: 'status', value: 'open' }],
        exclude: [{ key: 'type', value: 'draft' }],
      },
    },
    exclude_frontmatter_blocks: false,
  };
  pre_process.call(list, params);
  t.deepEqual(params.filter.frontmatter.include, [{ key: 'status', value: 'open' }]);
  t.deepEqual(params.filter.frontmatter.exclude, [{ key: 'type', value: 'draft' }]);
  t.false(params.filter.exclude_key_ends_with_any?.includes('---frontmatter---') === true);
});
