import { ConnectionsList } from '../../src/items/connections_list.js';
import { pre_process } from '../../src/actions/connections-list/pre_process.js';
import { CollectionItem } from 'smart-collections';

/** Real ConnectionsList and preprocess over deterministic in-memory candidates. */
export function create_feedback_fixture({ limit = 2, target_key = 'Target.md', results_collection_key = 'smart_sources' } = {}) {
  const events = [];
  const queries = [];
  const env = {
    config: { actions: { connections_list_pre_process: { action: pre_process } } },
    opts: {},
    events: { emit: (...args) => events.push(args) },
    create_env_getter() {},
  };
  for (const collection_key of ['smart_sources', 'smart_blocks']) {
    const collection = {
      collection_key, env, items: {},
      get(key) { return this.items[key]; },
      embeddings: {
        dims: 2,
        get_active_file_info() { return { file: 'fixture', dims: 2, value_count: Object.keys(collection.items).length * 2 }; },
        get _vectors_by_file() { return { fixture: new Float32Array(Object.values(collection.items).flatMap(item => item.vec)) }; },
        get_item_embedding_ref(item) { return { file: 'fixture', file_i: Object.values(collection.items).indexOf(item), read_hash: 'fixture' }; },
        get _persisted_lengths_by_file() { return { fixture: Object.keys(collection.items).length * 2 }; },
      },
      actions: {
        top_k({ k }) {
          queries.push(k);
          return Object.values(collection.items)
            .sort((left, right) => right.test_score - left.test_score)
            .slice(0, k).map(item => ({ item, score: item.test_score }));
        },
      },
      save() {},
    };
    env[collection_key] = collection;
  }
  const settings = {
    results_limit: limit,
    results_collection_key,
    score_algo_key: 'similarity',
    connections_post_process: 'none',
    exclude_frontmatter_blocks: true,
    inline_connections_score_threshold: '0.77',
  };
  const collection = {
    env, collection_key: 'connections_lists', item_class_name: 'ConnectionsList',
    items: {}, settings, results_collection_key, score_algo_key: 'similarity',
    frontmatter_inclusions: [], frontmatter_exclusions: [],
    new_connections_list(item) {
      return new ConnectionsList(env, { collection_key: item.collection_key, item_key: item.key });
    },
    new_item(item) { const list = this.new_connections_list(item); item.connections = list; return list; },
  };
  env.connections_lists = collection;
  env.settings = { connections_lists: settings };
  let next_vec_i = 0;
  const add_item = (key, test_score, collection_key = 'smart_sources') => {
    const item = {
      key, collection_key, env, collection: env[collection_key], data: { connections: {} },
      vec: [test_score, Math.sqrt(Math.max(0, 1 - test_score ** 2))],
      vec_i: next_vec_i++, test_score, should_embed: true,
      read_hash: 'fixture', path: key, link: `[[${key}]]`, score_calls: 0,
      queue_save() {}, emit_event() {},
      async read() { return `content:${key}`; },
      filter(filter = {}) { return CollectionItem.prototype.filter.call(this, filter); },
      score(params) { this.score_calls++; return { item: this, score: this.test_score }; },
    };
    if (collection_key === 'smart_blocks') item.source_key = key.split('#')[0];
    env[collection_key].items[key] = item;
    return item;
  };
  const target = add_item(target_key, 1, target_key.includes('#') ? 'smart_blocks' : 'smart_sources');
  const pinned = add_item('Pinned.md', 0.2);
  const hidden = add_item('Hidden.md', 0.99);
  const first = add_item('First.md', 0.9);
  const second = add_item('Second.md', 0.8);
  const third = add_item('Third.md', 0.7);
  target.data.connections = {
    'smart_sources:Pinned.md': { pinned: 12 },
    'smart_sources:Hidden.md': { hidden: 13 },
  };
  const list = collection.new_connections_list(target);
  return { env, list, collection, target, pinned, hidden, first, second, third, add_item, queries, events };
}

export function result_keys(results) { return results.map(result => result.item.key); }
