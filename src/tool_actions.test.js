import test from 'ava';
import {
  connections_list_get_results,
  output_schema,
  project_connections_list_request,
  project_connections_list_result,
  tool,
} from './actions/connections-list/get_results.js';

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

test('project_connections_list_request resolves the exact source-backed list', (t) => {
  const source = {
    key: 'Notes/Alpha.md',
  };
  const connections_list = {
    item: source,
  };
  const env = {
    smart_sources: {
      get(key) {
        return key === source.key ? source : null;
      },
    },
    connections_lists: {
      new_item(next_source) {
        t.is(next_source, source);
        return connections_list;
      },
    },
  };

  t.deepEqual(
    project_connections_list_request(
      {
        to: `  ${source.key}  `,
        include_content: true,
      },
      { env },
    ),
    {
      scope: connections_list,
      params: {},
    },
  );
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
