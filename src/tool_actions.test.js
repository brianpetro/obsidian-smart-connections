import test from 'ava';
import {
  connections_list_get_results,
  output_schema,
  project_connections_list_request,
  project_connections_list_result,
  tool,
} from './actions/connections-list/get_results.js';
import { ConnectionsLists } from './collections/connections_lists.js';
import { ConnectionsList } from './items/connections_list.js';
import {
  migrate_hidden_connections,
  migrate_hidden_connections_collection,
} from '../migrations/migrate_hidden_connections.js';

function create_connections_lists_fixture() {
  class TestConnectionsList {
    constructor(env, data) {
      this.env = env;
      this.data = data;
    }

    get key() {
      return `${this.data.collection_key}:${this.data.item_key}`;
    }

    get item() {
      return this.env[this.data.collection_key].items[this.data.item_key];
    }
  }

  const source = {
    key: 'Notes/Alpha.md',
    collection_key: 'smart_sources',
  };
  const env = {
    smart_sources: {
      items: {
        [source.key]: source,
      },
      get(key) {
        return this.items[key];
      },
    },
  };
  const connections_lists = Object.create(ConnectionsLists.prototype);
  connections_lists.env = env;
  connections_lists.items = {};
  connections_lists._item_type = TestConnectionsList;
  env.connections_lists = connections_lists;

  return {
    connections_lists,
    env,
    source,
  };
}

test('connections_list_get_results preserves the native list result', async (t) => {
  const expected_results = [
    {
      item: {
        key: 'Notes/Beta.md',
        collection_key: 'smart_sources',
      },
      score: 0.75,
    },
  ];
  const params = {};
  const connections_list = {
    async get_results(next_params) {
      t.is(next_params, params);
      return expected_results;
    },
  };

  const results = await connections_list_get_results.call(
    connections_list,
    params,
  );

  t.is(results, expected_results);
});

test('Connections retrieval does not migrate source data', async (t) => {
  const source = {
    key: 'Notes/Alpha.md',
    data: {
      hidden_connections: {
        'Notes/Beta.md': 1700000000000,
      },
    },
  };
  const connections_list = Object.create(ConnectionsList.prototype);
  connections_list.env = {
    smart_sources: {
      items: {
        [source.key]: source,
      },
    },
    config: {
      actions: {},
    },
  };
  connections_list.data = {
    collection_key: 'smart_sources',
    item_key: source.key,
  };
  connections_list._actions = {};

  await connections_list.pre_process({});

  t.true(Object.hasOwn(source.data, 'hidden_connections'));
  t.false(Object.hasOwn(source.data, 'connections'));
});

test('Connections migration removes equivalent legacy data', (t) => {
  const source = {
    data: {
      connections: {
        'smart_sources:Notes/Beta.md': {
          hidden: 1700000000000,
        },
      },
      hidden_connections: {
        'Notes/Beta.md': 1700000000000,
      },
    },
  };

  t.true(migrate_hidden_connections(source));
  t.false(Object.hasOwn(source.data, 'hidden_connections'));
});

test('Connections load migration queues only migrated sources', (t) => {
  let queued_count = 0;
  const migrated_source = {
    data: {
      hidden_connections: {
        'Notes/Beta.md': 1700000000000,
      },
    },
    queue_save() {
      queued_count += 1;
    },
  };
  const unchanged_source = {
    data: {},
    queue_save() {
      t.fail('Unchanged sources must not be queued for save.');
    },
  };

  t.is(
    migrate_hidden_connections_collection({
      items: {
        migrated_source,
        unchanged_source,
      },
    }),
    1,
  );
  t.is(queued_count, 1);
});

test('project_connections_list_request creates a fresh unregistered scope', (t) => {
  const {
    connections_lists,
    env,
    source,
  } = create_connections_lists_fixture();

  const first = project_connections_list_request(
    {
      to: `  ${source.key}  `,
      include_content: true,
    },
    { env },
  );
  const second = project_connections_list_request(
    {
      to: source.key,
    },
    { env },
  );

  t.is(first.scope.item, source);
  t.deepEqual(first.params, {});
  t.not(first.scope, second.scope);
  t.deepEqual(connections_lists.items, {});
  t.false(Object.hasOwn(source, 'connections'));

  const registered = connections_lists.new_item(source);
  const registered_items = { ...connections_lists.items };
  const third = project_connections_list_request(
    {
      to: source.key,
    },
    { env },
  );

  t.not(third.scope, registered);
  t.deepEqual(connections_lists.items, registered_items);
  t.is(source.connections, registered);
});

test('project_connections_list_request fails clearly for an unknown source', (t) => {
  const env = {
    smart_sources: {
      get() {
        return null;
      },
    },
    connections_lists: {},
  };

  t.throws(
    () => project_connections_list_request(
      {
        to: 'Missing.md',
      },
      { env },
    ),
    { message: 'No Smart Source found for "Missing.md".' },
  );
});

test('project_connections_list_result returns the stable public payload', async (t) => {
  const source = {
    key: 'Notes/Alpha.md',
  };
  const scope = {
    item: source,
  };
  const raw_results = [
    {
      item: {
        key: 'Notes/Beta.md',
        collection_key: 'smart_sources',
      },
      score: 0.75,
    },
  ];

  t.deepEqual(
    await project_connections_list_result(raw_results, { scope }),
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
  t.is(raw_results[0].item.key, 'Notes/Beta.md');
});

test('project_connections_list_result includes item content when requested', async (t) => {
  let read_count = 0;
  const scope = {
    item: {
      key: 'Notes/Alpha.md',
    },
  };
  const raw_results = [
    {
      item: {
        key: 'Notes/Beta.md',
        collection_key: 'smart_sources',
        async read() {
          read_count += 1;
          return '# Beta\n\nConnection content.';
        },
      },
      score: 0.75,
    },
  ];

  const result = await project_connections_list_result(
    raw_results,
    {
      scope,
      request: {
        include_content: true,
      },
    },
  );

  t.is(read_count, 1);
  t.deepEqual(result.results[0], {
    key: 'Notes/Beta.md',
    collection_key: 'smart_sources',
    score: 0.75,
    content: '# Beta\n\nConnection content.',
  });
});

test('connections tool metadata selects request and result projection', (t) => {
  t.is(output_schema, null);
  t.is(tool.project_request, project_connections_list_request);
  t.is(tool.project_result, project_connections_list_result);
  t.deepEqual(tool.input_schema.required, ['to']);
  t.is(tool.input_schema.properties.include_content.type, 'boolean');
  t.is(
    tool.output_schema.properties.results.items.properties.content.type,
    'string',
  );
  t.deepEqual(tool.output_schema.required, [
    'ok',
    'to',
    'total',
    'results',
  ]);
});
