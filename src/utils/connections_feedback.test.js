import { get_visible_connections_results } from './get_visible_connections_results.js';
import test from 'ava';
import { CollectionItem } from 'smart-collections';
import { connections_list_item_toggle_pinned } from '../actions/connections-list-item/toggle_pinned.js';
import { create_feedback_fixture, result_keys } from '../../test/fixtures/connections_feedback.js';
import { resolve_connection_feedback } from './connections_list_item_state.js';
import { get_graph_connections_results } from './get_graph_connections_results.js';
import { get_random_connection } from './get_random_connection.js';
import { filter_hidden_results } from './filter_hidden_results.js';

for (const [record, state] of [
  [{}, 'default'], [{ pinned: 1 }, 'pinned'], [{ hidden: 1 }, 'hidden'],
  [{ pinned: 1, hidden: 2 }, 'pinned'], [{ pinned: null, hidden: 2 }, 'hidden'],
  [{ pinned: 0, hidden: 2 }, 'pinned'], [{ hidden: 0 }, 'hidden'],
]) {
  test(`feedback resolves ${JSON.stringify(record)} as ${state} without mutation`, t => {
    const { target, pinned } = create_feedback_fixture();
    target.data.connections['smart_sources:Pinned.md'] = Object.freeze(record);
    Object.freeze(target.data.connections);
    t.deepEqual(resolve_connection_feedback(target, pinned), { state });
    t.is(target.data.connections['smart_sources:Pinned.md'], record);
  });
}

test('feedback identity includes collection and preserves colons in item keys', t => {
  const { target, add_item } = create_feedback_fixture();
  const source = add_item('Project:One.md', 0.8);
  const block = add_item('Project:One.md', 0.8, 'smart_blocks');
  target.data.connections['smart_sources:Project:One.md'] = { pinned: 1 };
  t.is(resolve_connection_feedback(target, source).state, 'pinned');
  t.is(resolve_connection_feedback(target, block).state, 'default');
});

test('hidden result filtering uses the target item feedback directly', t => {
  const { target, hidden, pinned, first } = create_feedback_fixture();
  target.data.connections['smart_sources:Pinned.md'].hidden = 99;
  const visible = filter_hidden_results([
    { item: hidden },
    { item: pinned },
    { item: first },
  ], target);
  t.deepEqual(result_keys(visible), ['Pinned.md', 'First.md']);
});

test('raw retrieval ranks hidden evidence, does not append pins, and preserves target data', async t => {
  const { list, target } = create_feedback_fixture();
  const before = structuredClone(target.data);
  const params = { limit: 2 };
  const results = await list.get_results(params);
  t.deepEqual(result_keys(results), ['Hidden.md', 'First.md']);
  t.deepEqual(results.map(r => r.feedback.state), ['hidden', 'default']);
  t.deepEqual(params.filter.exclude_keys, ['Target.md']);
  t.false('eligibility_filter' in params);
  t.false('ranked_result_count' in params);
  t.deepEqual(target.data, before);
  t.true(results.every(r => r.connections_list === list));
});

test('hard filters exclude pinned and hidden candidates in both raw and visible results', async t => {
  const { list } = create_feedback_fixture();
  const params = { limit: 1, filter: { exclude_keys: ['Pinned.md', 'Hidden.md'] } };
  t.deepEqual(result_keys(await list.get_results(params)), ['First.md']);
  t.deepEqual(result_keys(await get_visible_connections_results(list, params)), ['First.md']);
});

test('feedback supplementation uses prepared hard eligibility without scoring', async t => {
  const { list, pinned, hidden, first, target } = create_feedback_fixture();
  const params = { filter: { exclude_keys: ['Pinned.md'] } };
  await list.pre_process(params);
  t.false(list.is_candidate_eligible(pinned, params));
  t.true(list.is_candidate_eligible(hidden, params));
  t.true(list.is_candidate_eligible(first, params));
  t.false(list.is_candidate_eligible(target, params));
  t.deepEqual(list.get_feedback_items(params, { states: ['pinned'] }), []);
  t.deepEqual(list.get_feedback_items(params, { states: ['hidden'] }), [{ item: hidden, feedback: { state: 'hidden' } }]);
  t.is(hidden.score_calls, 0);
});

test('feedback supplementation enforces collection, source exclusions, and vector capability', async t => {
  const { list, target, pinned, add_item } = create_feedback_fixture({ target_key: 'Target.md#Section' });
  const same_source = add_item('Target.md#Other', 0.8, 'smart_blocks');
  const wrong_collection = add_item('Other.md#Part', 0.8, 'smart_blocks');
  target.data.connections[`smart_blocks:${same_source.key}`] = { pinned: 1 };
  target.data.connections[`smart_blocks:${wrong_collection.key}`] = { pinned: 1 };
  const params = { results_collection_key: 'smart_sources', filter: {
    exclude_keys: ['Target.md'], exclude_key_starts_with_any: ['Target.md#'],
  } };
  await list.pre_process(params);
  t.deepEqual(result_keys(list.get_feedback_items(params, { states: ['pinned'] })), ['Pinned.md']);
  pinned.vec = [];
  t.deepEqual(list.get_feedback_items(params, { states: ['pinned'] }), []);
});

test('preprocessing owns mutable nested filters and leaves frozen caller state untouched', async t => {
  const { list } = create_feedback_fixture();
  const filter = Object.freeze({
    exclude_keys: Object.freeze(['Never.md']),
    exclude_key_ends_with_any: Object.freeze(['secret']),
    frontmatter: Object.freeze({ include: Object.freeze([{ key: 'status', value: 'open' }]) }),
  });
  const params = { results_collection_key: 'smart_blocks', filter };
  await list.pre_process(params);
  t.not(params.filter, filter);
  t.not(params.filter.frontmatter, filter.frontmatter);
  t.deepEqual(filter.exclude_key_ends_with_any, ['secret']);
  t.deepEqual(params.filter.exclude_key_ends_with_any, ['secret', '---frontmatter---']);
  await list.pre_process(params);
  t.deepEqual(params.filter.exclude_key_ends_with_any, ['secret', '---frontmatter---']);
});

test('default presentation uses one retrieval/rerank, preserves scores, and never backfills', async t => {
  const { list, env, collection, pinned, queries } = create_feedback_fixture();
  let rank_calls = 0;
  env.config.actions.rank_fixture = { action(results) { rank_calls++; return [...results].reverse(); } };
  collection.settings.connections_post_process = 'rank_fixture';
  const results = await get_visible_connections_results(list, { limit: 2 });
  t.deepEqual(result_keys(results), ['Pinned.md', 'First.md']);
  t.deepEqual(results.map(r => r.score), [0.2, 0.9]);
  t.is(rank_calls, 1);
  t.is(queries.length, 1);
  t.is(pinned.score_calls, 1);
});

test('visible projection preserves a frozen native snapshot and reuses a ranked pin', async t => {
  const { list, pinned } = create_feedback_fixture();
  const params = { limit: 5 };
  const raw = await list.get_results(params);
  raw.forEach(Object.freeze);
  Object.freeze(raw);
  const visible = await get_visible_connections_results(list, params, raw);
  t.deepEqual(result_keys(raw), ['Hidden.md', 'First.md', 'Second.md', 'Third.md', 'Pinned.md']);
  t.deepEqual(result_keys(visible), ['Pinned.md', 'First.md', 'Second.md', 'Third.md']);
  t.is(visible[0], raw.at(-1));
  t.is(pinned.score_calls, 0);
});

test('an all-hidden ranked window is not refilled; eligible pins remain additional', async t => {
  const { list, queries } = create_feedback_fixture();
  t.deepEqual(result_keys(await get_visible_connections_results(list, { limit: 1 })), ['Pinned.md']);
  t.deepEqual(result_keys(list.results), ['Hidden.md']);
  t.is(queries.length, 1);
});

test('visible helper does not mutate request or re-preprocess a supplied snapshot', async t => {
  const { list } = create_feedback_fixture();
  const request = { limit: 2, filter: { exclude_keys: [] } };
  const before = structuredClone(request);
  await get_visible_connections_results(list, request);
  t.deepEqual(request, before);
  const params = { limit: 2 };
  const raw = await list.get_results(params);
  list.pre_process = () => { throw new Error('unexpected preprocessing'); };
  t.deepEqual(result_keys(await get_visible_connections_results(list, params, raw)), ['Pinned.md', 'First.md']);
  t.deepEqual(result_keys(await get_graph_connections_results(list, params, raw)), ['Hidden.md', 'First.md', 'Pinned.md']);
});

test('empty presentation is valid and does not manufacture ordinary candidates', async t => {
  const { list, target, env } = create_feedback_fixture();
  target.data.connections = {};
  env.smart_sources.items = { [target.key]: target };
  t.deepEqual(await get_visible_connections_results(list), []);
});

test('graph retains hidden ranked rows and adds feedback nodes without scoring or duplicates', async t => {
  const { list, hidden, pinned } = create_feedback_fixture();
  const params = { limit: 2 };
  const raw = await list.get_results(params);
  const graph = await get_graph_connections_results(list, params, raw);
  t.deepEqual(result_keys(graph), ['Hidden.md', 'First.md', 'Pinned.md']);
  t.is(graph[0], raw[0]);
  t.is(graph[0].feedback.state, 'hidden');
  t.false('score' in graph.at(-1));
  t.false('connections_list' in graph.at(-1));
  t.is(hidden.score_calls + pinned.score_calls, 0);
  t.is(new Set(result_keys(graph)).size, graph.length);
});

test('graph never restores feedback excluded by explicit filters', async t => {
  const { list } = create_feedback_fixture();
  const params = { filter: { exclude_keys: ['Pinned.md', 'Hidden.md'] } };
  const raw = await list.get_results(params);
  const graph = get_graph_connections_results(list, params, raw);
  t.deepEqual(result_keys(graph), ['First.md', 'Second.md']);
});

test('pin plus hide is attributed as pinned in both list and graph', async t => {
  const { list, target, pinned } = create_feedback_fixture();
  target.data.connections['smart_sources:Pinned.md'].hidden = 99;
  const visible = await get_visible_connections_results(list);
  const params = {};
  const raw = await list.get_results(params);
  const graph = get_graph_connections_results(list, params, raw);
  t.is(visible[0].feedback.state, 'pinned');
  t.is(graph.find(result => result.item === pinned).feedback.state, 'pinned');
});

test('subsequent retrieval resolves current feedback after unpin and unhide', async t => {
  const { list, target } = create_feedback_fixture();
  await get_visible_connections_results(list);
  delete target.data.connections['smart_sources:Pinned.md'].pinned;
  delete target.data.connections['smart_sources:Hidden.md'].hidden;
  const visible = await get_visible_connections_results(list);
  t.deepEqual(result_keys(visible), ['Hidden.md', 'First.md']);
  t.true(visible.every(r => r.feedback.state === 'default'));
});

test('random connection selects from visible rows and still includes eligible pins', async t => {
  const { env, target, hidden } = create_feedback_fixture();
  t.is((await get_random_connection(env, target.key, { rng: () => 0 })).item.key, 'Pinned.md');
  for (const value of [0.2, 0.5, 0.99]) {
    t.not((await get_random_connection(env, target.key, { rng: () => value })).item, hidden);
  }
});

test('ranking cannot widen hard eligibility or the final raw limit', async t => {
  const { list, env, collection, target, third, pinned } = create_feedback_fixture();
  collection.settings.connections_post_process = 'rank_fixture';
  env.config.actions.rank_fixture = { action(results) {
    return [{ item: target }, { item: pinned }, ...results, { item: third }];
  } };
  const results = await list.get_results({ limit: 1, filter: { exclude_keys: ['Pinned.md'] } });
  t.deepEqual(result_keys(results), ['Hidden.md']);
});



test('post_process uses invocation-local ranking selection', async t => {
  const { list, env, collection, first, second } = create_feedback_fixture();
  collection.settings.connections_post_process = 'none';
  env.config.actions.local_rank = {
    action(results) {
      return [...results].reverse();
    },
  };
  const results = [
    { item: first, score: 0.9 },
    { item: second, score: 0.8 },
  ];
  const ranked = await list.post_process(results, {
    connections_post_process: 'local_rank',
  });
  t.deepEqual(result_keys(ranked), ['Second.md', 'First.md']);
});

test('legacy null filter still means no caller filter', async t => {
  const { list } = create_feedback_fixture();
  t.deepEqual(result_keys(await list.get_results({ filter: null })), ['Hidden.md', 'First.md']);
});

test('concurrent same-list retrievals reuse the active request', async t => {
  const { list } = create_feedback_fixture();
  const retrieve = list._get_results.bind(list);
  let calls = 0;
  list._get_results = async params => {
    calls++;
    await Promise.resolve();
    return retrieve(params);
  };
  const [first, second] = await Promise.all([
    list.get_results({ limit: 2 }),
    list.get_results({ limit: 1 }),
  ]);
  t.is(calls, 1);
  t.deepEqual(result_keys(first), result_keys(second));
});

test('a rejected retrieval clears the active request for the next call', async t => {
  const { list } = create_feedback_fixture();
  const retrieve = list._get_results.bind(list);
  let calls = 0;
  list._get_results = async params => {
    if (++calls === 1) throw new Error('first retrieval failed');
    return retrieve(params);
  };
  await t.throwsAsync(() => list.get_results(), { message: 'first retrieval failed' });
  t.deepEqual(result_keys(await list.get_results({ limit: 1 })), ['Hidden.md']);
  t.is(calls, 2);
  t.is(list._results_promise, null);
});

test('block descendants are not excluded by feedback on an ancestor', async t => {
  const { list, target, add_item } = create_feedback_fixture({ limit: 4, results_collection_key: 'smart_blocks' });
  const hidden = add_item('H.md#Parent', 0.99, 'smart_blocks');
  const hidden_child = add_item('H.md#Parent#Child', 0.95, 'smart_blocks');
  const pinned = add_item('P.md#Parent', 0.9, 'smart_blocks');
  const pinned_child = add_item('P.md#Parent#Child', 0.85, 'smart_blocks');
  target.data.connections = {
    [`smart_blocks:${hidden.key}`]: { hidden: 1 },
    [`smart_blocks:${pinned.key}`]: { pinned: 1 },
  };
  const params = { limit: 4 };
  const raw = await list.get_results(params);
  t.deepEqual(result_keys(raw), [hidden.key, hidden_child.key, pinned.key, pinned_child.key]);
  t.deepEqual(raw.map(result => result.feedback.state), ['hidden', 'default', 'pinned', 'default']);
  t.deepEqual(params.filter.exclude_key_starts_with_any, [target.key]);
});

test('scoring exemplars use the same zero-timestamp and pinned-over-hidden interpretation', async t => {
  const { list, target, pinned, hidden } = create_feedback_fixture();
  target.data.connections['smart_sources:Pinned.md'] = { pinned: 0, hidden: 3 };
  target.data.connections['smart_sources:Hidden.md'] = { hidden: 0 };
  const params = {};
  await list.pre_process(params);
  t.deepEqual(params.pinned, [pinned]);
  t.deepEqual(params.hidden, [hidden]);
  t.deepEqual(params.filter.exclude_keys, [target.key]);
});


test('coalesced visible callers use one prepared scoring context', async t => {
  const { list, pinned, queries } = create_feedback_fixture();
  pinned.actions = { similarity() { return { score: 0.2 }; } };
  pinned.score = CollectionItem.prototype.score;
  let preparations = 0;
  const pre_process = list.pre_process.bind(list);
  list.pre_process = async params => { preparations++; await pre_process(params); };
  const first_request = { limit: 2 };
  const second_request = { limit: 2 };
  const [first, second] = await Promise.all([
    get_visible_connections_results(list, first_request),
    get_visible_connections_results(list, second_request),
  ]);
  t.deepEqual(result_keys(first), ['Pinned.md', 'First.md']);
  t.deepEqual(result_keys(second), result_keys(first));
  t.is(first[0].score, 0.2);
  t.is(second[0].score, 0.2);
  t.is(preparations, 1);
  t.is(queries.length, 1);
  t.deepEqual(first_request, { limit: 2 });
  t.deepEqual(second_request, { limit: 2 });
});

test('coalesced projections retain the active hard filter rather than the joining request', async t => {
  const { list, queries } = create_feedback_fixture();
  const first_params = { limit: 2, filter: { exclude_keys: ['Pinned.md', 'Hidden.md'] } };
  const second_params = { limit: 1, filter: { exclude_keys: [] } };
  const [first, second] = await Promise.all([
    list.get_results(first_params),
    list.get_results(second_params),
  ]);
  t.is(first, second);
  const visible = await get_visible_connections_results(list, second_params, second);
  const graph = get_graph_connections_results(list, second_params, second);
  t.deepEqual(result_keys(visible), ['First.md', 'Second.md']);
  t.deepEqual(result_keys(graph), ['First.md', 'Second.md']);
  t.deepEqual(second_params, { limit: 1, filter: { exclude_keys: [] } });
  t.is(queries.length, 1);
});

test('older snapshots retain hard filters when caller params and the list cache are reused', async t => {
  const { list, queries } = create_feedback_fixture();
  const params = { limit: 2, filter: { exclude_keys: ['Pinned.md', 'Hidden.md'] } };
  const raw = await list.get_results(params);
  raw.forEach(Object.freeze);
  Object.freeze(raw);
  params.filter.exclude_keys.length = 0;
  params.limit = 1;
  await list.get_results(params);
  const visible = await get_visible_connections_results(list, params, raw);
  const graph = get_graph_connections_results(list, params, raw);
  t.deepEqual(result_keys(visible), ['First.md', 'Second.md']);
  t.deepEqual(result_keys(graph), ['First.md', 'Second.md']);
  t.deepEqual(result_keys(list.results), ['Hidden.md']);
  t.is(queries.length, 2);
});

test('supplemental pins use the score policy of their ranked snapshot', async t => {
  const { list, pinned, queries } = create_feedback_fixture();
  pinned.actions = {
    earlier() { return { score: 0.25 }; },
    later() { return { score: 0.35 }; },
  };
  pinned.score = CollectionItem.prototype.score;
  const params = { limit: 2, score_algo_key: 'earlier' };
  const earlier = await list.get_results(params);
  params.score_algo_key = 'later';
  const later = await list.get_results(params);
  const earlier_visible = await get_visible_connections_results(list, params, earlier);
  const later_visible = await get_visible_connections_results(list, params, later);
  t.is(earlier_visible[0].score, 0.25);
  t.is(later_visible[0].score, 0.35);
  t.is(queries.length, 2);
});

test('coalesced presentation failures reject together and the next retrieval recovers', async t => {
  const { list, pinned, queries } = create_feedback_fixture();
  pinned.actions = { similarity() { return { score: 0.2 }; } };
  pinned.score = CollectionItem.prototype.score;
  const pre_process = list.pre_process.bind(list);
  const failure = new Error('retrieval failed');
  let preparations = 0;
  list.pre_process = async params => {
    if (++preparations === 1) throw failure;
    await pre_process(params);
  };
  const outcomes = await Promise.allSettled([
    get_visible_connections_results(list),
    get_visible_connections_results(list),
  ]);
  t.true(outcomes.every(outcome => outcome.status === 'rejected' && outcome.reason === failure));
  t.is(preparations, 1);
  t.is(list._results_promise, null);
  t.deepEqual(result_keys(await get_visible_connections_results(list)), ['Pinned.md', 'First.md']);
  t.is(preparations, 2);
  t.is(queries.length, 1);
});

for (const [label, before, after, expected_keys, expected_state] of [
  ['pin', {}, { pinned: 1 }, ['Pinned.md', 'First.md'], 'pinned'],
  ['hide', {}, { hidden: 1 }, ['Pinned.md'], undefined],
  ['unpin', { pinned: 1 }, {}, ['Pinned.md', 'First.md'], 'default'],
  ['unhide', { hidden: 1 }, {}, ['Pinned.md', 'First.md'], 'default'],
  ['unpin while hidden', { pinned: 1, hidden: 2 }, { hidden: 2 }, ['Pinned.md'], undefined],
  ['pin while hidden', { hidden: 1 }, { pinned: 2, hidden: 1 }, ['Pinned.md', 'First.md'], 'pinned'],
  ['hide while pinned', { pinned: 1 }, { pinned: 1, hidden: 2 }, ['Pinned.md', 'First.md'], 'pinned'],
]) {
  test(`visible ${label} uses coherent live feedback without mutating the ranked snapshot`, async t => {
    const { list, target, first, queries } = create_feedback_fixture();
    const key = `smart_sources:${first.key}`;
    target.data.connections[key] = before;
    const params = { limit: 2 };
    const raw = await list.get_results(params);
    const raw_feedback = raw.map(result => result.feedback.state);
    const raw_scores = raw.map(result => result.score);
    raw.forEach(result => { Object.freeze(result.feedback); Object.freeze(result); });
    Object.freeze(raw);
    target.data.connections[key] = after;
    const visible = await get_visible_connections_results(list, params, raw);
    t.deepEqual(result_keys(visible), expected_keys);
    t.is(visible.find(result => result.item === first)?.feedback.state, expected_state);
    t.is(new Set(visible.map(result => `${result.item.collection_key}:${result.item.key}`)).size, visible.length);
    t.deepEqual(raw.map(result => result.feedback.state), raw_feedback);
    t.deepEqual(raw.map(result => result.score), raw_scores);
    t.is(visible.find(result => result.item === first)?.score, expected_state ? first.test_score : undefined);
    t.is(first.score_calls, 0);
    t.is(queries.length, 1);
  });
}

test('the pin action between retrieval and projection promotes a row exactly once', async t => {
  const { list, first } = create_feedback_fixture();
  const params = { limit: 2 };
  const raw = await list.get_results(params);
  connections_list_item_toggle_pinned.call(list, { target_item: first });
  const visible = await get_visible_connections_results(list, params, raw);
  t.is(visible.filter(result => result.item === first).length, 1);
  t.is(visible.find(result => result.item === first).feedback.state, 'pinned');
  t.is(raw.find(result => result.item === first).feedback.state, 'default');
});

test('visible live feedback cannot reintroduce an excluded pin or backfill a hidden row', async t => {
  const { list, target, first, third, queries } = create_feedback_fixture();
  const params = { limit: 2, filter: { exclude_keys: ['Third.md'] } };
  const raw = await list.get_results(params);
  target.data.connections[`smart_sources:${first.key}`] = { hidden: 1 };
  target.data.connections[`smart_sources:${third.key}`] = { pinned: 1 };
  t.deepEqual(result_keys(await get_visible_connections_results(list, params, raw)), ['Pinned.md']);
  t.deepEqual(result_keys(raw), ['Hidden.md', 'First.md']);
  t.is(queries.length, 1);
});
