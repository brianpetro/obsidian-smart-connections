export async function connections_list_get_results(params = {}) {
  const target_key = to_trimmed_string(params.to);
  if (!target_key) throw new Error('Missing required argument: to');

  const source = this.env.smart_sources?.get?.(target_key)
    || this.env.smart_sources?.items?.[target_key]
  ;
  if (!source) {
    throw new Error(`No Smart Source found for "${target_key}".`);
  }

  const connections_list = source.connections
    || this.new_item?.(source)
  ;
  if (!connections_list) {
    throw new Error('Unable to create Smart Connections list.');
  }

  const results = await connections_list.get_results?.({});
  const normalized_results = Array.isArray(results)
    ? results.map(to_result).filter(Boolean)
    : []
  ;

  return {
    ok: true,
    to: source.key || target_key,
    total: normalized_results.length,
    results: normalized_results,
  };
}

export const display_name = 'List Smart Connections';
export const display_description = 'Returns ranked Smart Connections for a source key.';
export const input_schema = {
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
};
export const output_schema = {
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
};
export const action_scope = {
  type: 'collection',
  collection_key: 'connections_lists',
};
export const tool = {
  name: 'smart_connections_list',
  when({ env }) {
    return Boolean(env.connections_lists && env.smart_sources);
  },
  effects: {
    read_only: true,
    destructive: false,
    idempotent: true,
  },
};

function to_result(result) {
  const item = result?.item;
  const key = to_trimmed_string(item?.key)
    || to_trimmed_string(item?.data?.key)
    || to_trimmed_string(item?.path)
  ;
  if (!key) return null;

  return {
    key,
    collection_key: to_trimmed_string(item?.collection_key),
    score: Number.isFinite(result?.score) ? result.score : null,
  };
}

function to_trimmed_string(value) {
  return typeof value === 'string' ? value.trim() : '';
}
