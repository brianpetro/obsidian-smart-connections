import test from 'ava';
import { ConnectionsList } from './items/connections_list.js';

function create_connections_list(
  scored_results,
  {
    freeze_results = false,
  } = {},
) {
  const items = Object.fromEntries(
    scored_results.map(({ key, score }) => {
      const item = {
        key,
        collection_key: 'smart_sources',
        vec: [1, 0],
        filter() { return true; },
        score() {
          const result = {
            item,
            score,
          };

          return freeze_results
            ? Object.freeze(result)
            : result
          ;
        },
      };

      return [key, item];
    }),
  );
  const connections_list = Object.create(ConnectionsList.prototype);
  connections_list.data = { collection_key: 'smart_sources', item_key: 'target' };
  connections_list.env = {
    settings: { connections_lists: { results_limit: 20 } },
    connections_lists: { results_collection_key: 'smart_sources' },
    smart_sources: {
      items: { target: { key: 'target', vec: [1, 0] }, ...items },
      embeddings: {
        dims: 2,
        get_active_file_info() { return { file: 'fixture' }; },
        _persisted_lengths_by_file: { fixture: scored_results.length * 2 },
      },
      actions: {
        top_k() { return scored_results.map(({ key, score }) => ({ item: items[key], score })); },
      },
    },
  };

  return connections_list;
}

test('filter_and_score keeps only the highest results at the requested limit', (t) => {
  const connections_list = create_connections_list([
    { key: 'low', score: 0.1 },
    { key: 'middle', score: 0.2 },
    { key: 'high', score: 0.3 },
  ]);

  const results = connections_list.filter_and_score({
    results_collection_key: 'smart_sources',
    limit: 2,
  });

  t.deepEqual(
    results.map((result) => result.item.key),
    ['high', 'middle'],
  );
  t.is(results.length, 2);
});

test('filter_and_score returns the highest all-negative results without normalization', (t) => {
  const connections_list = create_connections_list([
    { key: 'lowest', score: -0.9 },
    { key: 'middle', score: -0.8 },
    { key: 'highest', score: -0.1 },
  ], {
    freeze_results: true,
  });

  const results = connections_list.filter_and_score({
    results_collection_key: 'smart_sources',
    limit: 2,
  });

  t.deepEqual(
    results.map((result) => result.item.key),
    ['highest', 'middle'],
  );
  t.deepEqual(
    results.map((result) => result.score),
    [-0.1, -0.8],
  );
});

test('filter_and_score retains zero scores when no score is positive', (t) => {
  const connections_list = create_connections_list([
    { key: 'lowest', score: -0.9 },
    { key: 'middle', score: -0.1 },
    { key: 'highest', score: 0 },
  ], {
    freeze_results: true,
  });

  const results = connections_list.filter_and_score({
    results_collection_key: 'smart_sources',
    limit: 2,
  });

  t.deepEqual(
    results.map((result) => result.item.key),
    ['highest', 'middle'],
  );
  t.deepEqual(
    results.map((result) => result.score),
    [0, -0.1],
  );
});
