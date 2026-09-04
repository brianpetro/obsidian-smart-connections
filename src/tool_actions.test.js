import test from 'ava';
import { collection_item_filter_schema } from 'obsidian-smart-env/src/utils/collection_item_filter_schema.js';
import {
  connections_list_get_results,
  input_schema,
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

  const filter = {
    exclude_keys: ['Notes/Ignored.md'],
    key_starts_with: 'Notes/',
  };
  const first = project_connections_list_request(
    {
      to: `  ${source.key}  `,
      limit: 8,
      results_collection_key: 'smart_blocks',
      filter,
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
  t.deepEqual(first.params, {
    limit: 8,
    results_collection_key: 'smart_blocks',
    filter,
  });
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

test('project_connections_list_request does not resolve an unmatched source key', (t) => {
  const { env } = create_connections_lists_fixture();

  t.throws(
    () => project_connections_list_request(
      {
        to: 'Alpha.md',
      },
      { env },
    ),
    { message: 'Smart Source not found: "Alpha.md".' },
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
  const filter_schema = input_schema.properties.filter;

  t.is(filter_schema, collection_item_filter_schema);
  t.is(output_schema, null);
  t.is(input_schema.properties.limit.type, 'integer');
  t.is(input_schema.properties.limit.minimum, 1);
  t.deepEqual(input_schema.properties.results_collection_key.enum, [
    'smart_sources',
    'smart_blocks',
  ]);
  t.is(filter_schema.type, 'object');
  t.false(filter_schema.additionalProperties);
  t.deepEqual(Object.keys(filter_schema.properties), [
    'exclude_key',
    'exclude_keys',
    'exclude_key_starts_with',
    'exclude_key_starts_with_any',
    'exclude_key_includes',
    'exclude_key_includes_any',
    'exclude_key_ends_with',
    'exclude_key_ends_with_any',
    'key_ends_with',
    'key_starts_with',
    'key_starts_with_any',
    'key_includes',
    'key_includes_any',
    'frontmatter',
  ]);
  t.is(filter_schema.properties.exclude_keys.items.type, 'string');
  t.deepEqual(
    filter_schema.properties.frontmatter.properties.include
      .items.properties.value.type,
    ['string', 'null'],
  );
  t.is(tool.project_request, project_connections_list_request);
  t.is(tool.project_result, project_connections_list_result);
  t.deepEqual(tool.input_schema.required, ['to']);
  t.is(tool.input_schema.properties.limit, input_schema.properties.limit);
  t.is(
    tool.input_schema.properties.results_collection_key,
    input_schema.properties.results_collection_key,
  );
  t.is(tool.input_schema.properties.filter, filter_schema);
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
