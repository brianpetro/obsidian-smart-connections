import { get_visible_connections_results } from './get_visible_connections_results.js';
import test from 'ava';
import { connections_list_item_hide } from '../actions/connections-list-item/hide.js';
import { connections_list_item_toggle_pinned } from '../actions/connections-list-item/toggle_pinned.js';
import { connections_list_unpin_all } from '../actions/connections-list/unpin_all.js';
import { filter_hidden_results } from './filter_hidden_results.js';
import { CollectionItem } from 'smart-collections';
import { create_feedback_fixture, result_keys } from '../../test/fixtures/connections_feedback.js';
import { create_node, load_component, presenter, install_components } from '../../test/fixtures/presentation_surface.js';
import { connections_list_copy_as_links } from '../actions/connections-list/copy_as_links.js';
import { resolve_connection_feedback, build_prefixed_connection_key } from './connections_list_item_state.js';
import { post_process as list_v3 } from '../components/connections-list/v3.js';
import { post_process as list_v4 } from '../components/connections-list/v4.js';

for (const [key, processor] of [['connections_list_v3', list_v3], ['connections_list_v4', list_v4]]) {
  test(`${key} publishes the exact visible rows and keeps native graph input separate`, async t => {
    const fixture = create_feedback_fixture();
    const calls = install_components(fixture, { [key]: processor });
    let visible_results;
    const container = await fixture.env.smart_components.render_component(key, fixture.list, {
      on_visible_results(results) { visible_results = results; },
    });
    const list = key.endsWith('v3') ? container : container.querySelector('.connections-list');
    t.deepEqual(result_keys(visible_results), ['Pinned.md', 'First.md']);
    t.false('_connections_visible_results' in list);
    const rows = calls.filter(call => call.key === 'connections_list_item_v3');
    t.deepEqual(rows.map(call => call.scope.item.key), result_keys(visible_results));
    t.true(rows.every(call => call.options.visible_results === visible_results));
    if (key.endsWith('v4')) {
      const graph = calls.find(call => call.key === 'connections_graph_v1');
      t.is(graph.options.results, fixture.list.results);
      t.not(graph.options.results, visible_results);
      t.true(graph.options.filter.exclude_keys.includes('Target.md'));
    }
  });
}

test('failed row rendering does not publish an unrendered handoff set', async t => {
  const fixture = create_feedback_fixture();
  const container = create_node(['connections-list']);
  fixture.env.smart_components = { render_component() { throw new Error('row failed'); } };
  const published = [];
  await t.throwsAsync(() => list_v3.call(presenter, fixture.list, container, {
    on_visible_results(results) { published.push(results); },
  }), { message: 'row failed' });
  t.deepEqual(published, [[]]);
  t.false('_connections_visible_results' in container);
});

test('dedicated-view menu reads rendered rows even after another caller replaces raw cache', async t => {
  const fixture = create_feedback_fixture();
  install_components(fixture, { connections_list_v3: list_v3 });
  const menu_calls = [];
  fixture.env.build_menu = (key, menu, scope, params) => { menu_calls.push({ key, scope, params }); };
  const root = create_node();
  const slot = root.appendChild(create_node(['connections-list-container']));
  const menu_button = create_node();
  root.selectors['[data-action="open-menu"]'] = menu_button;
  root.selectors['.sc-top-bar .sc-context'] = create_node();
  const view = { env: fixture.env, plugin: { app: {} }, render_view() {} };
  const { post_process } = load_component(new URL('../components/connections-view/v3.js', import.meta.url));
  await post_process.call(presenter, view, root, { connections_item: fixture.target, connections_list_component_key: 'connections_list_v3' });
  const list = slot.querySelector('.connections-list');
  root._connections_menu_state.connections_list.results = [{ item: fixture.hidden }];
  menu_button.listeners.click({});
  const call = menu_calls.find(call => call.key === 'connections:list_menu');
  t.deepEqual(result_keys(call.params.visible_results), ['Pinned.md', 'First.md']);
  t.is(call.scope, root._connections_menu_state.connections_list);
});

test('codeblock copy and Context actions receive its exact rendered set, not raw cache', async t => {
  const fixture = create_feedback_fixture();
  install_components(fixture, { connections_list_v3: list_v3 });
  const calls = [];
  for (const key of ['connections_list_copy_as_links', 'connections_list_send_to_context']) {
    fixture.env.config.actions[key] = { action(params) { calls.push({ key, params, scope: this }); return true; } };
  }
  const root = create_node();
  const slot = root.appendChild(create_node(['connections-list-container']));
  const copy = create_node(); const context = create_node();
  root.selectors['[data-action="copy-as-links"]'] = copy;
  root.selectors['[data-action="send-to-smart-context"]'] = context;
  const { post_process } = load_component(new URL('../components/connections_codeblock.js', import.meta.url));
  await post_process.call(presenter, fixture.list, root, { connections_list_component_key: 'connections_list_v3' });
  await new Promise(resolve => setImmediate(resolve));
  const presented_keys = ['Pinned.md', 'First.md'];
  fixture.list.results = [{ item: fixture.hidden }];
  await copy.listeners.click({}); await context.listeners.click({});
  t.is(calls.length, 2);
  for (const call of calls) {
    t.deepEqual(result_keys(call.params.visible_results), presented_keys);
    t.is(call.scope, fixture.list);
  }
});

test('codeblock translates local filter settings into semantic filter once', async t => {
  const fixture = create_feedback_fixture();
  fixture.target.data.connections = {};
  let received;
  fixture.list.get_results = async params => {
    received = params;
    const results = [];
    fixture.list._result_params.set(results, params);
    return results;
  };
  install_components(fixture, { connections_list_v3: list_v3 });
  const root = create_node();
  root.appendChild(create_node(['connections-list-container']));
  const { post_process } = load_component(new URL('../components/connections_codeblock.js', import.meta.url));
  await post_process.call(presenter, fixture.list, root, {
    connections_list_component_key: 'connections_list_v3',
    connections_settings: {
      include_filter: 'Projects/, Notes/',
      exclude_filter: 'Archive/',
      frontmatter_filter_include: 'status:open',
      frontmatter_filter_exclude: 'type:draft',
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  t.deepEqual(Array.from(received.filter.key_includes_any), ['Projects/', 'Notes/']);
  t.deepEqual(Array.from(received.filter.exclude_key_includes_any), ['Archive/']);
  t.deepEqual(JSON.parse(JSON.stringify(received.filter.frontmatter.include)), [{ key: 'status', value: 'open' }]);
  t.deepEqual(JSON.parse(JSON.stringify(received.filter.frontmatter.exclude)), [{ key: 'type', value: 'draft' }]);
  for (const key of [
    'include_filter',
    'exclude_filter',
    'frontmatter_filter_include',
    'frontmatter_filter_exclude',
  ]) {
    t.false(key in received);
  }
});

test('footer retains configured list presentation without a second projection', async t => {
  const fixture = create_feedback_fixture();
  const calls = install_components(fixture, { connections_list_v3: list_v3 });
  const root = create_node();
  const slot = root.appendChild(create_node(['connections-list-container']));
  const view = { env: fixture.env, app: { loadLocalStorage() {} }, render_view() {} };
  const { post_process } = load_component(new URL('../components/connections_footer_view.js', import.meta.url));
  await post_process.call(presenter, view, root, { connections_item: fixture.target, connections_list_component_key: 'connections_list_v3' });
  t.deepEqual(calls.filter(call => call.key === 'connections_list_item_v3').map(call => call.scope.item.key), ['Pinned.md', 'First.md']);
  t.is(calls.filter(call => call.key === 'connections_list_v3').length, 1);
});

test('Core row uses normalized pinned precedence and keeps selected-result menu scope', async t => {
  const fixture = create_feedback_fixture();
  fixture.target.data.connections['smart_sources:Pinned.md'].hidden = 22;
  const calls = [];
  fixture.env.smart_connections_plugin = { app: {}, registerDomEvent(node, name, handler) { node.listeners[name] = handler; } };
  fixture.env.build_menu = (key, menu, scope, params) => { calls.push({ key, scope, params }); };
  const row = create_node(['sc-collapsed']);
  row.selectors['.header .svg-icon.right-triangle'] = create_node();
  const results = await get_visible_connections_results(fixture.list);
  const { post_process } = load_component(new URL('../components/connections-list-item/v3.js', import.meta.url), ['post_process'], {
    resolve_connection_feedback, build_prefixed_connection_key,
    get_item_display_name: item => item.key,
    register_item_drag() {}, register_item_hover_popover() {}, open_source() {},
    MutationObserver: class { observe() {} },
  });
  await post_process.call(presenter, results[0], row, { visible_results: results });
  t.true(row.classList.contains('sc-result-pinned'));
  t.false(row.classList.contains('sc-result-hidden-by-feedback'));
  row.listeners.contextmenu({ preventDefault() {}, stopPropagation() {} });
  const action = calls.find(call => call.key === 'connections:list_item_menu');
  t.is(action.scope, fixture.list);
  t.is(action.params.target_item, fixture.pinned);
});

test('Core graph state classes preserve muted hidden nodes and separate pin styling', t => {
  const { build_node_classname } = load_component(new URL('../components/connections-graph/v1.js', import.meta.url), ['build_node_classname']);
  t.true(build_node_classname({ is_hidden: true }).includes('sc-result-hidden'));
  t.true(build_node_classname({ is_pinned: true }).includes('sc-result-pinned'));
});

test.serial('copy requires a visible operand and does not read shared raw cache', async t => {
  const fixture = create_feedback_fixture();
  const previous_window = globalThis.window;
  const writes = [];
  globalThis.window = { require: () => ({ clipboard: { writeText: text => writes.push(text) } }) };
  try {
    fixture.list.results = [{ item: fixture.hidden }];
    t.false(await connections_list_copy_as_links.call(fixture.list));
    t.is(writes.length, 0);
    t.true(await connections_list_copy_as_links.call(fixture.list, {
      visible_results: [{ item: fixture.pinned }, { item: fixture.first }],
    }));
    t.true(writes[0].includes('Pinned'));
    t.true(writes[0].includes('First'));
    t.false(writes[0].includes('Hidden'));
    t.false(await connections_list_copy_as_links.call(fixture.list, { visible_results: [] }));
    t.is(writes.length, 1);
  } finally {
    if (previous_window === undefined) delete globalThis.window;
    else globalThis.window = previous_window;
  }
});

test('dedicated-view rejects a late result callback from a superseded render', async t => {
  const fixture = create_feedback_fixture();
  const callbacks = [];
  fixture.env.smart_components = { async render_component(key, scope, opts) {
    callbacks.push(opts.on_visible_results);
    return create_node(['connections-list']);
  } };
  const root = create_node();
  root.appendChild(create_node(['connections-list-container']));
  root.selectors['.sc-top-bar .sc-context'] = create_node();
  const view = { env: fixture.env, plugin: { app: {} }, render_view() {} };
  const { post_process } = load_component(new URL('../components/connections-view/v3.js', import.meta.url));
  await post_process.call(presenter, view, root, { connections_item: fixture.target, connections_list_component_key: 'connections_list_v3' });
  await post_process.call(presenter, view, root, { connections_item: fixture.target, connections_list_component_key: 'connections_list_v3' });
  const current = [{ item: fixture.first }];
  callbacks[1](current);
  callbacks[0]([{ item: fixture.hidden }]);
  t.is(root._connections_menu_state.visible_results, current);
});

test('codeblock ignores old callbacks and excludes a newly hidden row from handoff', async t => {
  const fixture = create_feedback_fixture();
  const callbacks = [];
  let rerender;
  fixture.env.smart_components = { async render_component(key, scope, opts) {
    callbacks.push(opts.on_visible_results);
    rerender = opts.render_connections;
    return create_node(['connections-list']);
  } };
  const calls = [];
  fixture.env.config.actions.connections_list_copy_as_links = { action(params) { calls.push(params); return true; } };
  const root = create_node();
  root.appendChild(create_node(['connections-list-container']));
  const copy = create_node();
  root.selectors['[data-action="copy-as-links"]'] = copy;
  const { post_process } = load_component(new URL('../components/connections_codeblock.js', import.meta.url));
  await post_process.call(presenter, fixture.list, root, { connections_list_component_key: 'connections_list_v3' });
  await rerender();
  callbacks[1]([{ item: fixture.first }, { item: fixture.second }]);
  callbacks[0]([{ item: fixture.hidden }]);
  fixture.target.data.connections['smart_sources:First.md'] = { hidden: 4 };
  await copy.listeners.click({});
  t.deepEqual(result_keys(calls[0].visible_results), ['Second.md']);
});


for (const [key, processor] of [['connections_list_v3', list_v3], ['connections_list_v4', list_v4]]) {
  test(`${key} coalesced renders share prepared scoring and one raw retrieval`, async t => {
    const fixture = create_feedback_fixture();
    fixture.pinned.actions = { similarity() { return { score: 0.2 }; } };
    fixture.pinned.score = CollectionItem.prototype.score;
    const calls = install_components(fixture, { [key]: processor });
    const published = [[], []];
    await Promise.all(published.map((snapshots) => fixture.env.smart_components.render_component(key, fixture.list, {
      on_visible_results(results) { snapshots.push(results); },
    })));
    for (const snapshots of published) {
      t.deepEqual(result_keys(snapshots.at(-1)), ['Pinned.md', 'First.md']);
      t.is(snapshots.at(-1)[0].score, 0.2);
    }
    t.is(fixture.queries.length, 1);
    const graphs = calls.filter(call => call.key === 'connections_graph_v1');
    if (graphs.length) t.is(graphs[0].options.results, graphs[1].options.results);
  });
}

for (const pinned of [false, true]) {
  test(`Hide keeps row and handoff aligned when pinned=${pinned}`, t => {
    const fixture = create_feedback_fixture();
    const item = pinned ? fixture.pinned : fixture.first;
    const row = create_node(pinned ? ['sc-result-pinned'] : []);
    if (pinned) row.dataset.pinned = 'true';
    const raw_row = Object.freeze({ item, feedback: Object.freeze({ state: pinned ? 'pinned' : 'default' }) });
    const visible_results = Object.freeze([raw_row]);
    let queued = 0;
    let saved = 0;
    const events = [];
    fixture.target.queue_save = () => { queued++; };
    fixture.target.collection.save = () => { saved++; };
    fixture.target.emit_event = key => events.push(key);
    t.true(connections_list_item_hide.call(fixture.list, { target_item: item, container: row }));
    t.is(row.classList.contains('sc-result-hidden-by-feedback'), !pinned);
    t.is(row.dataset.hidden, pinned ? undefined : 'true');
    t.is(row.classList.contains('sc-result-pinned'), pinned);
    t.is(resolve_connection_feedback(fixture.target, item).state, pinned ? 'pinned' : 'hidden');
    t.deepEqual(result_keys(filter_hidden_results(visible_results, fixture.target)), pinned ? [item.key] : []);
    t.is(queued, 1);
    t.is(saved, 1);
    t.true(events.includes('connections:hidden_item'));
    t.is(raw_row.feedback.state, pinned ? 'pinned' : 'default');
  });
}

test('Hide, unpin, and repin keep hidden CSS and effective feedback in agreement', t => {
  const { list, target, pinned } = create_feedback_fixture();
  const row = create_node(['sc-result-pinned']);
  row.dataset.pinned = 'true';
  t.true(connections_list_item_hide.call(list, { target_item: pinned, container: row }));
  t.false(row.classList.contains('sc-result-hidden-by-feedback'));
  t.true(connections_list_item_toggle_pinned.call(list, { target_item: pinned, container: row }));
  t.is(resolve_connection_feedback(target, pinned).state, 'hidden');
  t.true(row.classList.contains('sc-result-hidden-by-feedback'));
  t.is(row.dataset.hidden, 'true');
  t.deepEqual(filter_hidden_results([{ item: pinned }], target), []);
  t.true(connections_list_item_toggle_pinned.call(list, { target_item: pinned, container: row }));
  t.is(resolve_connection_feedback(target, pinned).state, 'pinned');
  t.false(row.classList.contains('sc-result-hidden-by-feedback'));
  t.is(row.dataset.hidden, undefined);
  t.is(filter_hidden_results([{ item: pinned }], target).length, 1);
});

test('Unpin All hides only rows with retained hidden feedback', t => {
  const { list, target, pinned, first } = create_feedback_fixture();
  target.data.connections['smart_sources:Pinned.md'].hidden = 44;
  target.data.connections['smart_sources:First.md'] = { pinned: 55 };
  const rows = [pinned, first].map(item => {
    const row = create_node(['sc-result-pinned']);
    row.dataset.prefixedKey = `smart_sources:${item.key}`;
    row.dataset.pinned = 'true';
    return row;
  });
  t.true(connections_list_unpin_all.call(list, { container: { querySelectorAll: () => rows } }));
  t.true(rows[0].classList.contains('sc-result-hidden-by-feedback'));
  t.false(rows[1].classList.contains('sc-result-hidden-by-feedback'));
  t.true(rows.every(row => !row.classList.contains('sc-result-pinned')));
  t.deepEqual(result_keys(filter_hidden_results([{ item: pinned }, { item: first }], target)), [first.key]);
});


for (const [key, processor] of [['connections_list_v3', list_v3], ['connections_list_v4', list_v4]]) {
  test(`${key} maps local settings to semantic retrieval params only`, async t => {
    const fixture = create_feedback_fixture();
    fixture.target.data.connections = {};
    let received;
    fixture.list.get_results = async params => {
      received = params;
      const results = [];
      fixture.list._result_params.set(results, params);
      return results;
    };
    install_components(fixture, { [key]: processor });
    const score_settings = { key_weights: { 'Projects/': 2 } };
    const filter = {
      key_includes_any: ['Projects/'],
      exclude_key_includes_any: ['Archive/'],
      frontmatter: {
        include: [{ key: 'status', value: 'open' }],
        exclude: [{ key: 'type', value: 'draft' }],
      },
    };
    await fixture.env.smart_components.render_component(key, fixture.list, {
      connections_settings: {
        results_limit: 5,
        results_collection_key: 'smart_blocks',
        score_algo_key: 'weighted',
        actions: { weighted: score_settings },
        connections_post_process: 'recency_rank',
        exclude_inlinks: true,
        exclude_outlinks: false,
        exclude_frontmatter_blocks: false,
      },
      filter,
      on_visible_results() {},
      render_connections() {},
      container: create_node(),
    });
    t.is(received.limit, 5);
    t.is(received.results_collection_key, 'smart_blocks');
    t.is(received.score_algo_key, 'weighted');
    t.is(received.score_settings, score_settings);
    t.is(received.connections_post_process, 'recency_rank');
    t.is(received.filter, filter);
    t.true(received.exclude_inlinks);
    t.false(received.exclude_outlinks);
    t.false(received.exclude_frontmatter_blocks);
    t.false('connections_settings' in received);
    t.false('on_visible_results' in received);
    t.false('render_connections' in received);
    t.false('container' in received);
  });
}

test('Core list explicit retrieval params override local settings', async t => {
  const fixture = create_feedback_fixture();
  fixture.target.data.connections = {};
  let received;
  fixture.list.get_results = async params => {
    received = params;
    const results = [];
    fixture.list._result_params.set(results, params);
    return results;
  };
  install_components(fixture, { connections_list_v3: list_v3 });
  const score_settings = { explicit: true };
  await fixture.env.smart_components.render_component('connections_list_v3', fixture.list, {
    connections_settings: {
      results_limit: 5,
      results_collection_key: 'smart_blocks',
      score_algo_key: 'local_score',
      actions: { local_score: { local: true } },
      connections_post_process: 'local_rank',
      exclude_inlinks: false,
    },
    limit: 2,
    results_collection_key: 'smart_sources',
    score_algo_key: 'explicit_score',
    score_settings,
    connections_post_process: 'explicit_rank',
    filter: { key_includes_any: ['Explicit/'] },
    exclude_inlinks: true,
  });
  t.is(received.limit, 2);
  t.is(received.results_collection_key, 'smart_sources');
  t.is(received.score_algo_key, 'explicit_score');
  t.is(received.score_settings, score_settings);
  t.is(received.connections_post_process, 'explicit_rank');
  t.deepEqual(received.filter.key_includes_any, ['Explicit/']);
  t.true(received.exclude_inlinks);
});
