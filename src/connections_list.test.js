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
        filter_and_score() {
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
  connections_list.env = {
    smart_sources: {
      items,
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
