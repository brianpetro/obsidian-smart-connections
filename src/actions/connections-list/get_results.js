/**
 * Retrieve ranked results for the current Connections List.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @returns {Promise<Array>}
 */
export async function connections_list_get_results(params = {}) {
  return await this.get_results(params);
}

export const display_name = 'List Smart Connections';
export const display_description = 'Returns ranked Smart Connections for a source key.';
export const input_schema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};
export const output_schema = null;
export const action_scope = {
  type: 'item',
  collection_key: 'connections_lists',
  item_arg: 'key',
};
export const tool = {
  name: 'smart_connections_list',

  when({ env }) {
    return Boolean(env.connections_lists && env.smart_sources);
  },

  input_schema: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        minLength: 1,
        description: 'Source key or vault-relative path.',
      },
    },
    required: ['to'],
    additionalProperties: false,
  },

  project_request: project_connections_list_request,

  effects: {
    read_only: true,
    destructive: false,
    idempotent: true,
  },

  project_result: project_connections_list_result,

  output_schema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      to: { type: 'string' },
      total: { type: 'integer' },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            collection_key: { type: 'string' },
            score: { type: ['number', 'null'] },
          },
          required: ['key', 'collection_key', 'score'],
          additionalProperties: false,
        },
      },
    },
    required: ['ok', 'to', 'total', 'results'],
    additionalProperties: false,
  },
};

/**
 * Convert the public source selector into the exact Connections List scope and
 * the natural list-action params.
 *
 * This is the source-backed list projector pattern to mirror for a future
 * DisconnectionsList tool action.
 *
 * @param {{to: string}} request
 * @param {{env: object}} context
 * @returns {{scope: object, params: object}}
 */
export function project_connections_list_request(request, { env }) {
  const target_key = to_trimmed_string(request.to);
  if (!target_key) throw new Error('Missing required argument: to');

  const source = env.smart_sources?.get?.(target_key)
    || env.smart_sources?.items?.[target_key]
  ;
  if (!source) {
    throw new Error(`No Smart Source found for "${target_key}".`);
  }

  const connections_list = source.connections
    || env.connections_lists?.new_item?.(source)
  ;
  if (!connections_list) {
    throw new Error('Unable to create Smart Connections list.');
  }

  return {
    scope: connections_list,
    params: {},
  };
}

/**
 * Convert native Connections List results into the shared public tool result.
 *
 * @param {Array<object>} raw_result
 * @param {{scope: object}} context
 * @returns {object}
 */
export function project_connections_list_result(raw_result, { scope }) {
  if (!Array.isArray(raw_result)) {
    throw new TypeError('Connections List results must be an array.');
  }

  const target_key = to_trimmed_string(scope?.item?.key)
    || to_trimmed_string(scope?.data?.item_key)
  ;
  if (!target_key) {
    throw new TypeError('Connections List scope is missing its source key.');
  }

  const results = raw_result.map(to_result);

  return {
    ok: true,
    to: target_key,
    total: results.length,
    results,
  };
}

function to_result(result, result_i) {
  const item = result?.item;
  const key = to_trimmed_string(item?.key)
    || to_trimmed_string(item?.data?.key)
    || to_trimmed_string(item?.path)
  ;
  if (!key) {
    throw new TypeError(
      `Connections List result ${result_i} is missing an item key.`,
    );
  }

  const collection_key = to_trimmed_string(item?.collection_key)
    || to_trimmed_string(item?.collection?.collection_key)
  ;
  if (!collection_key) {
    throw new TypeError(
      `Connections List result ${result_i} is missing a collection key.`,
    );
  }

  return {
    key,
    collection_key,
    score: Number.isFinite(result?.score) ? result.score : null,
  };
}

function to_trimmed_string(value) {
  return typeof value === 'string' ? value.trim() : '';
}
