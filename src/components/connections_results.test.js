import test from 'ava';
import { create_feedback_fixture, result_keys } from '../../test/fixtures/connections_feedback.js';
import { create_node, install_components, load_component, presenter } from '../../test/fixtures/presentation_surface.js';
import { build_html, render as render_results } from './connections_results.js';
import { build_html as list_html, post_process as base_list, render as render_list } from './connections_list.js';

test('canonical graph and list receive one shared ranked snapshot', async t => {
  const fixture = create_feedback_fixture();
  const get_results = fixture.list.get_results.bind(fixture.list);
  let retrievals = 0;
  fixture.list.get_results = params => { retrievals++; return get_results(params); };
  const calls = install_components(fixture);
  let visible_results;
  await fixture.env.smart_components.render_component('connections_results', fixture.list, {
    connections_graph_component_key: 'connections_graph_v1',
    on_visible_results(results) { visible_results = results; },
  });
  const list_call = calls.find(call => call.key === 'connections_list');
  const graph_call = calls.find(call => call.key === 'connections_graph_v1');
  t.is(retrievals, 1);
  t.is(graph_call.options.results, list_call.options.results);
  t.is(graph_call.options.results, fixture.list.results);
  t.not(graph_call.options.results, visible_results);
  t.deepEqual(result_keys(visible_results), ['Pinned.md', 'First.md']);
  t.true(graph_call.options.filter.exclude_keys.includes('Target.md'));
});

test('graph disabled still renders the canonical list with one retrieval', async t => {
  const fixture = create_feedback_fixture();
  const calls = install_components(fixture);
  const root = await fixture.env.smart_components.render_component('connections_results', fixture.list, { show_connections_graph: false });
  t.is(fixture.queries.length, 1);
  t.is(calls.filter(call => call.key === 'connections_list').length, 1);
  t.false(calls.some(call => call.key.startsWith('connections_graph_')));
  t.deepEqual(root.querySelector('.connections-graph-container').children, []);
});

test('an explicitly supplied empty snapshot is not fetched again', async t => {
  const fixture = create_feedback_fixture();
  fixture.target.data.connections = {};
  fixture.list.get_results = () => { throw new Error('unexpected retrieval'); };
  const calls = install_components(fixture);
  const results = [];
  let visible;
  await fixture.env.smart_components.render_component('connections_results', fixture.list, {
    results, on_visible_results(rows) { visible = rows; },
  });
  t.is(calls.find(call => call.key === 'connections_list').options.results, results);
  t.is(calls.find(call => call.key === 'connections_graph_v1').options.results, results);
  t.deepEqual(visible, []);
});

test('graph uses the captured snapshot even when another caller replaces the raw cache', async t => {
  const fixture = create_feedback_fixture();
  const calls = install_components(fixture, {
    async connections_list(scope, root, opts) {
      await base_list.call(this, scope, root, opts);
      scope.results = [{ item: fixture.second }];
    },
  });
  await fixture.env.smart_components.render_component('connections_results', fixture.list, {});
  const list_call = calls.find(call => call.key === 'connections_list');
  const graph_call = calls.find(call => call.key === 'connections_graph_v1');
  t.is(graph_call.options.results, list_call.options.results);
  t.not(graph_call.options.results, fixture.list.results);
  t.deepEqual(result_keys(graph_call.options.results), ['Hidden.md', 'First.md']);
});

test('list markup has no graph slot; the shared presenter owns sibling slots', async t => {
  const fixture = create_feedback_fixture();
  t.false((await list_html(fixture.list)).includes('connections-graph-container'));
  const html = await build_html(fixture.list);
  t.true(html.includes('connections-graph-container'));
  t.true(html.includes('connections-results-list'));
});

test('local graph visibility overrides the persisted display preference', async t => {
  const fixture = create_feedback_fixture();
  fixture.collection.settings.show_connections_graph = true;
  const calls = install_components(fixture);
  const local_settings = Object.freeze({ show_connections_graph: false });
  await fixture.env.smart_components.render_component('connections_results', fixture.list, { connections_settings: local_settings });
  t.false(calls.some(call => call.key.startsWith('connections_graph_')));
  t.true(fixture.collection.settings.show_connections_graph);
  t.is(calls.find(call => call.key === 'connections_list').options.connections_settings, local_settings);
});

test('footer graph settings are independent from view settings', async t => {
  const fixture = create_feedback_fixture();
  Object.assign(fixture.collection.settings, {
    show_connections_graph: false,
    connections_graph_component_key: 'connections_graph_v1',
    footer_show_connections_graph: true,
    footer_connections_graph_component_key: 'connections_graph_v1',
  });
  const calls = install_components(fixture);
  await fixture.env.smart_components.render_component('connections_results', fixture.list, { footer: true });
  t.is(calls.filter(call => call.key === 'connections_graph_v1').length, 1);
  t.is(calls.filter(call => call.key === 'connections_list').length, 1);
});

test('a saved unavailable graph implementation falls back to the base graph', async t => {
  const fixture = create_feedback_fixture();
  const calls = install_components(fixture);
  await fixture.env.smart_components.render_component('connections_results', fixture.list, { connections_graph_component_key: 'connections_graph_future' });
  t.is(calls.filter(call => call.key === 'connections_graph_v1').length, 1);
  t.false(calls.some(call => call.key === 'connections_graph_future'));
});

test('graph failure does not discard the rendered list or its visible result handoff', async t => {
  const fixture = create_feedback_fixture();
  const calls = install_components(fixture, {
    connections_graph_v1() { throw new Error('graph unavailable'); },
  });
  let visible;
  const root = await fixture.env.smart_components.render_component('connections_results', fixture.list, {
    on_visible_results(results) { visible = results; },
  });
  t.deepEqual(result_keys(visible), ['Pinned.md', 'First.md']);
  t.is(root.querySelector('.connections-list').children.length, 2);
  t.is(calls.filter(call => call.key === 'connections_list').length, 1);
  t.true(root.querySelector('.connections-graph-container').children[0].innerHTML.includes('Unable to load graph visualization: graph unavailable'));
});

test.serial('graph selection expands and focuses the matching sibling list row', async t => {
  const original_window = globalThis.window;
  const timeouts = [];
  globalThis.window = { setTimeout(callback, delay) { timeouts.push({ callback, delay }); } };
  t.teardown(() => { if (original_window === undefined) delete globalThis.window; else globalThis.window = original_window; });
  const fixture = create_feedback_fixture();
  install_components(fixture);
  const root = await fixture.env.smart_components.render_component('connections_results', fixture.list, {});
  const row = root.querySelector('.sc-result');
  row.classList.add('sc-collapsed');
  let scroll_options;
  row.scrollIntoView = options => { scroll_options = options; };
  const graph = root.querySelector('.connections-graph-container').children[0];
  graph.listeners['connections:result']({ detail: { collection_key: row.dataset.collection, item_key: row.dataset.key } });
  t.false(row.classList.contains('sc-collapsed'));
  t.true(row.classList.contains('sc-result-graph-focus'));
  t.deepEqual(scroll_options, { block: 'center', behavior: 'smooth' });
  t.is(timeouts[0].delay, 2400);
  timeouts[0].callback();
  t.false(row.classList.contains('sc-result-graph-focus'));
  t.notThrows(() => graph.listeners['connections:result']());
});

for (const [surface, relative_path] of [
  ['view', './connections-view/v3.js'],
  ['codeblock', './connections_codeblock.js'],
  ['footer', './connections_footer_view.js'],
]) {
  test(`${surface} delegates graph and list composition to the shared presenter`, async t => {
    const fixture = create_feedback_fixture();
    fixture.target.connections = fixture.list;
    fixture.collection.settings.footer_show_connections_graph = true;
    const calls = install_components(fixture);
    const root = create_node();
    root.appendChild(create_node(['connections-list-container']));
    root.selectors['.sc-top-bar .sc-context'] = create_node();
    const { post_process } = load_component(new URL(relative_path, import.meta.url));
    const view = { env: fixture.env, plugin: { app: {} }, app: { loadLocalStorage() {} }, render_view() {} };
    await post_process.call(presenter, surface === 'codeblock' ? fixture.list : view, root, { connections_item: fixture.target });
    // Codeblocks start their initial list without waiting for its contents.
    if (surface === 'codeblock') await new Promise(resolve => setImmediate(resolve));
    t.is(calls.filter(call => call.key === 'connections_results').length, 1);
    t.is(calls.filter(call => call.key === 'connections_list').length, 1);
    t.is(calls.filter(call => call.key === 'connections_graph_v1').length, 1);
    t.is(fixture.queries.length, 1);
  });
}

test('graph toggle events refresh settings so conditional graph selectors update immediately', t => {
  const { ScEarlySettingsTab } = load_component(new URL('../views/settings_tab.js', import.meta.url), ['ScEarlySettingsTab'], {
    SmartPluginSettingsTab: class {},
  });
  const tab = new ScEarlySettingsTab({}, {});
  let handle_change;
  let rerenders = 0;
  tab.env = { events: { on(event_key, callback) {
    t.is(event_key, 'settings:changed');
    handle_change = callback;
    return () => {};
  } } };
  tab.render_plugin_settings = () => { rerenders++; };
  tab.register_env_events();
  handle_change({ path: ['connections_lists', 'show_connections_graph'] });
  handle_change({ path: ['connections_lists', 'footer_show_connections_graph'] });
  t.is(rerenders, 2);
  handle_change({ path: ['connections_lists', 'connections_graph_component_key'] });
  handle_change({ path: ['connections_lists', 'footer_connections_graph_component_key'] });
  t.is(rerenders, 4);
  handle_change({ path: ['connections_lists', 'results_limit'] });
  t.is(rerenders, 4);
});

test('an installed future graph receives the same snapshot as the canonical list', async t => {
  const fixture = create_feedback_fixture();
  fixture.env.config.components = { connections_graph_future: {} };
  const calls = install_components(fixture);
  await fixture.env.smart_components.render_component('connections_results', fixture.list, {
    connections_graph_component_key: 'connections_graph_future',
  });
  t.is(calls.find(call => call.key === 'connections_graph_future').options.results, calls.find(call => call.key === 'connections_list').options.results);
  t.is(fixture.queries.length, 1);
});

test('local query settings are not merged with global query settings', async t => {
  const fixture = create_feedback_fixture();
  fixture.target.data.connections = {};
  Object.assign(fixture.collection.settings, {
    results_limit: 7, score_algo_key: 'global_score', exclude_inlinks: true,
    show_connections_graph: false,
  });
  let received;
  fixture.list.get_results = async params => { received = params; return []; };
  const calls = install_components(fixture);
  const local_settings = Object.freeze({});
  await fixture.env.smart_components.render_component('connections_results', fixture.list, { connections_settings: local_settings });
  t.is(received.limit, undefined);
  t.is(received.score_algo_key, undefined);
  t.is(received.exclude_inlinks, undefined);
  t.is(calls.find(call => call.key === 'connections_list').options.connections_settings, local_settings);
  t.false(calls.some(call => call.key.startsWith('connections_graph_')));
});

test('a codeblock inherits only display preferences when its query settings are local', async t => {
  const fixture = create_feedback_fixture();
  fixture.env.config.components = { connections_graph_future: {} };
  Object.assign(fixture.collection.settings, {
    show_connections_graph: true,
    connections_graph_component_key: 'connections_graph_future',
  });
  const calls = install_components(fixture);
  await fixture.env.smart_components.render_component('connections_results', fixture.list, { connections_settings: {} });
  t.is(calls.filter(call => call.key === 'connections_graph_future').length, 1);
  t.is(fixture.queries.length, 1);
});

test('the list owns the visible-result reset, without a duplicate reset from the presenter', async t => {
  const fixture = create_feedback_fixture();
  install_components(fixture);
  const published = [];
  await fixture.env.smart_components.render_component('connections_results', fixture.list, {
    on_visible_results(results) { published.push(results); },
  });
  t.is(published.length, 2);
  t.deepEqual(published[0], []);
  t.deepEqual(result_keys(published[1]), ['Pinned.md', 'First.md']);
});

for (const [component_key, render] of [
  ['connections_results', render_results],
  ['connections_list', render_list],
]) {
  test(`${component_key} returns its shell before blocked result retrieval completes`, async t => {
    const fixture = create_feedback_fixture();
    install_components(fixture);
    const root = create_node(['connections-list']);
    root.appendChild(create_node(['connections-graph-container']));
    root.appendChild(create_node(['connections-results-list']));
    const view = {
      ...presenter,
      create_doc_fragment() { return { firstElementChild: root, querySelector() { return root; } }; },
    };
    let release_results;
    const blocked_results = new Promise(resolve => { release_results = resolve; });
    const get_results = fixture.list.get_results.bind(fixture.list);
    fixture.list.get_results = async params => { await blocked_results; return get_results(params); };
    let finish_rows;
    const rows_ready = new Promise(resolve => { finish_rows = resolve; });
    let render_resolved = false;
    const rendered = render.call(view, fixture.list, {
      show_connections_graph: false,
      on_visible_results(results) { if (results.length) finish_rows(results); },
    }).then(node => { render_resolved = true; return node; });
    try {
      await new Promise(resolve => setImmediate(resolve));
      t.true(render_resolved);
      t.is(fixture.queries.length, 0);
    } finally {
      release_results();
      await rendered;
      await rows_ready;
    }
    t.is(await rendered, root);
    t.is(fixture.queries.length, 1);
  });
}

for (const lifecycle of ['render', 'post_process']) {
  test(`codeblock ${lifecycle} does not await its initial child rendering`, async t => {
    const fixture = create_feedback_fixture();
    const root = create_node();
    const list_container = root.appendChild(create_node(['connections-list-container']));
    const fragment = { firstElementChild: root };
    const view = { ...presenter, create_doc_fragment() { return fragment; }, apply_style_sheet() {} };
    let release_child;
    const child = create_node();
    const blocked_child = new Promise(resolve => { release_child = () => resolve(child); });
    fixture.env.smart_components = { render_component() { return blocked_child; } };
    const component = load_component(new URL('./connections_codeblock.js', import.meta.url), [lifecycle], { styles: '' });
    let resolved = false;
    const processing = (lifecycle === 'render'
      ? component.render.call(view, fixture.list, {})
      : component.post_process.call(view, fixture.list, root, {})
    ).then(node => { resolved = true; return node; });
    try {
      await new Promise(resolve => setImmediate(resolve));
      t.true(resolved);
      t.true(root._has_listeners);
      t.is(list_container.children.length, 0);
    } finally {
      release_child();
      await processing;
      await new Promise(resolve => setImmediate(resolve));
    }
    t.is(list_container.children[0], child);
  });
}

test('link-only settings changes do not rebuild Connections views or footers', t => {
  const callbacks = [];
  const env = { events: { on(key, callback) {
    if (key === 'settings:changed') callbacks.push(callback);
    return () => {};
  } } };
  const { ConnectionsItemView } = load_component(new URL('../views/connections_item_view.js', import.meta.url), ['ConnectionsItemView'], {
    SmartItemView: class {},
  });
  const { ConnectionsFooterView } = load_component(new URL('../views/connections_footer_view.js', import.meta.url), ['ConnectionsFooterView']);
  let view_renders = 0;
  let footer_renders = 0;
  const view = new ConnectionsItemView();
  view.env = env;
  view.container = { isConnected: true };
  view.render_target = () => { view_renders++; };
  view.register_env_listeners();
  const footer = new ConnectionsFooterView({ env });
  footer.render_view = () => { footer_renders++; };
  for (const callback of callbacks) {
    callback({ path: ['connections_lists', 'components', 'connections_graph_v1', 'render_links'], path_string: 'connections_lists.components.connections_graph_v1.render_links' });
  }
  t.is(view_renders, 0);
  t.is(footer_renders, 0);
  for (const callback of callbacks) callback({ path: ['connections_lists', 'results_limit'], path_string: 'connections_lists.results_limit' });
  t.is(view_renders, 1);
  t.is(footer_renders, 1);
});
