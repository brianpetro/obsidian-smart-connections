import test from 'ava';
import { connections_list_get_results } from './actions/connections-list/get_results.js';

test('connections_list_get_results resolves the source and returns transport-neutral results', async (t) => {
  const source = {
    key: 'Notes/Alpha.md',
  };
  const connections_list = {
    async get_results() {
      return [
        {
          item: {
            key: 'Notes/Beta.md',
            collection_key: 'smart_sources',
          },
          score: 0.75,
        },
      ];
    },
  };
  const collection = {
    env: {
      smart_sources: {
        get(key) {
          return key === source.key ? source : null;
        },
      },
    },
    new_item(next_source) {
      t.is(next_source, source);
      return connections_list;
    },
  };

  t.deepEqual(
    await connections_list_get_results.call(collection, {
      to: source.key,
    }),
    {
      ok: true,
      to: source.key,
      total: 1,
      results: [
        {
          key: 'Notes/Beta.md',
          collection_key: 'smart_sources',
          score: 0.75,
        },
      ],
    },
  );
});

test('connections_list_get_results fails clearly for an unknown source', async (t) => {
  const collection = {
    env: {
      smart_sources: {
        get() {
          return null;
        },
      },
    },
  };

  await t.throwsAsync(
    () => connections_list_get_results.call(collection, {
      to: 'Missing.md',
    }),
    { message: 'No Smart Source found for "Missing.md".' },
  );
});
