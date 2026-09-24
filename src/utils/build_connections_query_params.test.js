import test from 'ava';
import { build_connections_query_params } from './build_connections_query_params.js';
import { pre_process } from '../actions/connections-list/pre_process.js';
import { create_feedback_fixture } from '../../test/fixtures/connections_feedback.js';
import { CollectionItem } from 'smart-collections';

test('empty options and display-only local settings produce no query defaults', t => {
  const { list } = create_feedback_fixture();
  t.deepEqual(build_connections_query_params(list), {});
  t.deepEqual(build_connections_query_params(list, { connections_settings: {} }), {});
  t.deepEqual(build_connections_query_params(list, {
    connections_settings: { show_connections_graph: false, expanded_view: true },
    container: {}, results: [], to_item: {}, hidden: [], pinned: [],
    on_visible_results() {}, render_connections() {},
  }), {});
});

test('local settings project once into canonical query overrides', t => {
  const { list } = create_feedback_fixture();
  const score_settings = Object.freeze({ weight: 0.4 });
  const local_settings = Object.freeze({
    results_limit: 3, results_collection_key: 'smart_blocks', score_algo_key: 'weighted',
    actions: { weighted: score_settings }, connections_post_process: 'recency_rank',
    exclude_inlinks: false, exclude_outlinks: true, exclude_frontmatter_blocks: false,
    include_filter: ' Projects/, Notes/ ', exclude_filter: ' Archive/ ',
    frontmatter_filter_include: 'Status:Open', frontmatter_filter_exclude: 'Type:Draft',
    show_connections_graph: false,
  });
  const params = build_connections_query_params(list, { connections_settings: local_settings });
  t.deepEqual(params, {
    limit: 3, results_collection_key: 'smart_blocks', score_algo_key: 'weighted',
    score_settings, connections_post_process: 'recency_rank',
    exclude_inlinks: false, exclude_outlinks: true, exclude_frontmatter_blocks: false,
    filter: {
      key_includes_any: ['Projects/', 'Notes/'], exclude_key_includes_any: ['Archive/'],
      frontmatter: { include: [{ key: 'status', value: 'open' }], exclude: [{ key: 'type', value: 'draft' }] },
    },
  });
  t.is(params.score_settings, score_settings);
  t.false('connections_settings' in params);
  t.is(local_settings.results_limit, 3);
});

test('explicit query fields beat local settings, including false and empty score settings', t => {
  const { list } = create_feedback_fixture();
  const score_settings = Object.freeze({});
  const params = build_connections_query_params(list, {
    connections_settings: {
      results_limit: 8, results_collection_key: 'smart_blocks', score_algo_key: 'weighted',
      actions: { similarity: { weight: 0.4 } }, connections_post_process: 'recency_rank',
      exclude_inlinks: true, exclude_outlinks: true, exclude_frontmatter_blocks: true,
    },
    limit: 1, results_collection_key: 'smart_sources', score_algo_key: 'similarity',
    score_settings, connections_post_process: 'none', rank_query: '',
    exclude_inlinks: false, exclude_outlinks: false, exclude_frontmatter_blocks: false,
  });
  t.deepEqual(params, {
    limit: 1, results_collection_key: 'smart_sources', score_algo_key: 'similarity',
    score_settings, connections_post_process: 'none', rank_query: '',
    exclude_inlinks: false, exclude_outlinks: false, exclude_frontmatter_blocks: false,
  });
});

test('local action settings work when the scoring algorithm is inherited', t => {
  const { list } = create_feedback_fixture();
  const score_settings = Object.freeze({ weight: 0.4 });
  const params = build_connections_query_params(list, {
    connections_settings: { actions: { similarity: score_settings } },
  });
  t.deepEqual(params, { score_settings });
  pre_process.call(list, params);
  t.is(params.score_algo_key, 'similarity');
  t.is(params.score_settings, score_settings);
});

test('local action settings follow an explicit algorithm instead of the local default', t => {
  const { list } = create_feedback_fixture();
  const score_settings = {};
  const params = build_connections_query_params(list, {
    score_algo_key: 'chosen',
    connections_settings: {
      score_algo_key: 'other', actions: { chosen: score_settings, other: { weight: 2 } },
    },
  });
  t.is(params.score_settings, score_settings);
  t.is(params.score_algo_key, 'chosen');
});

test('missing local action settings are resolved by preprocessing from the owning list', t => {
  const { list } = create_feedback_fixture();
  const score_settings = Object.freeze({ weight: 2 });
  list.settings.actions = { similarity: score_settings };
  const params = build_connections_query_params(list, { connections_settings: { results_limit: 1 } });
  t.false('score_settings' in params);
  pre_process.call(list, params);
  t.is(params.score_settings, score_settings);
  t.is(params.limit, 1);
});

test('empty local filter settings clear defaults without writing to saved settings', t => {
  const { list } = create_feedback_fixture();
  list.collection.frontmatter_inclusions = [{ key: 'status', value: 'open' }];
  list.collection.frontmatter_exclusions = [{ key: 'type', value: 'draft' }];
  const params = build_connections_query_params(list, { connections_settings: {
    include_filter: '', exclude_filter: '', frontmatter_filter_include: '', frontmatter_filter_exclude: '',
  } });
  pre_process.call(list, params);
  t.deepEqual(params.filter.key_includes_any, []);
  t.deepEqual(params.filter.exclude_key_includes_any, []);
  t.deepEqual(params.filter.frontmatter, { include: [], exclude: [] });
  t.deepEqual(list.collection.frontmatter_inclusions, [{ key: 'status', value: 'open' }]);
});

test('explicit semantic filters win per field over local settings without mutating inputs', t => {
  const { list } = create_feedback_fixture();
  const filter = Object.freeze({
    key_includes_any: Object.freeze([]), exclude_key_includes_any: Object.freeze(['Explicit/']),
    frontmatter: Object.freeze({ include: Object.freeze([]) }),
  });
  const params = build_connections_query_params(list, { filter, connections_settings: {
    include_filter: 'Local/', exclude_filter: 'Local/',
    frontmatter_filter_include: 'local', frontmatter_filter_exclude: 'Type:Draft',
  } });
  t.deepEqual(params.filter, {
    key_includes_any: [], exclude_key_includes_any: ['Explicit/'],
    frontmatter: { include: [], exclude: [{ key: 'type', value: 'draft' }] },
  });
  pre_process.call(list, params);
  t.deepEqual(filter.frontmatter, { include: [] });
  t.false('exclude_keys' in filter);
});

test('omitted settings remain sparse and pick up current saved defaults on each retrieval', t => {
  const { list } = create_feedback_fixture();
  const first = build_connections_query_params(list);
  pre_process.call(list, first);
  t.is(first.limit, 2);
  list.settings.results_limit = 5;
  const second = build_connections_query_params(list);
  t.deepEqual(second, {});
  pre_process.call(list, second);
  t.is(second.limit, 5);
});

test('positive singleton and array conditions retain their AND semantics', t => {
  const { list } = create_feedback_fixture();
  const params = build_connections_query_params(list, { filter: {
    key_includes: 'Alpha', key_includes_any: ['Beta'],
    key_starts_with: 'Notes/', key_starts_with_any: ['Notes/Project/'],
  } });
  const matches = key => CollectionItem.prototype.filter.call({ key }, params.filter);
  t.not(matches('Notes/Project/AlphaBeta.md'), false);
  t.false(matches('Notes/Project/Alpha.md'));
  t.false(matches('Notes/Other/AlphaBeta.md'));
});

test('request filters reject obsolete negative aliases before retrieval', t => {
  const { list } = create_feedback_fixture();
  t.throws(() => build_connections_query_params(list, { filter: { exclude_key: 'A.md' } }), {
    instanceOf: TypeError,
    message: /exclude_key/,
  });
});
