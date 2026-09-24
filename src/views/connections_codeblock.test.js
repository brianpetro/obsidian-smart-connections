import { build_connections_query_params } from '../utils/build_connections_query_params.js';
import test from 'ava';
import { create_feedback_fixture } from '../../test/fixtures/connections_feedback.js';
import { create_node, load_component } from '../../test/fixtures/presentation_surface.js';

async function register_codeblock(settings) {
  const fixture = create_feedback_fixture();
  fixture.target.connections = fixture.list;
  const calls = [];
  const callbacks = new Map();
  fixture.env.events.on = (key, callback) => { callbacks.set(key, callback); return () => {}; };
  fixture.env.smart_view = { attach_disposer() {} };
  fixture.env.smart_components = { async render_component(key, scope, opts) { calls.push({ key, scope, opts }); return create_node(); } };
  let processor;
  const plugin = { env: fixture.env, registerMarkdownCodeBlockProcessor(key, callback) { processor = callback; } };
  const container = create_node();
  container.empty = () => { container.children = []; };
  container.createEl = (_tag, opts = {}) => {
    const node = create_node();
    node.textContent = opts.text ?? '';
    return container.appendChild(node);
  };
  const { register_smart_connections_codeblock } = load_component(new URL('./connections_codeblock.js', import.meta.url), ['register_smart_connections_codeblock']);
  await register_smart_connections_codeblock(plugin);
  await processor(JSON.stringify(settings), container, { sourcePath: fixture.target.key });
  await new Promise(resolve => setImmediate(resolve));
  return { ...fixture, calls, callbacks, processor, container };
}

test('current and empty codeblock settings pass through without merging global query defaults', async t => {
  for (const settings of [
    {},
    { results_limit: 3, actions: { similarity: { weight: 0.4 } } },
    { components: { connections_list: { connections_list_item_component_key: 'connections_list_item_v3' } } },
  ]) {
    const fixture = await register_codeblock(settings);
    t.deepEqual(fixture.calls[0].opts.connections_settings, settings);
  }
});

test('link-only settings changes do not rebuild codeblocks; ordinary query settings still do', async t => {
  const fixture = await register_codeblock({});
  const on_change = fixture.callbacks.get('settings:changed');
  on_change({ path: ['connections_lists', 'components', 'connections_graph_v1', 'render_links'], path_string: 'connections_lists.components.connections_graph_v1.render_links' });
  t.is(fixture.calls.length, 1);
  on_change({ path: ['connections_lists', 'results_limit'], path_string: 'connections_lists.results_limit' });
  t.is(fixture.calls.length, 2);
});


test('reused codeblock containers rerender the current configuration on settings changes', async t => {
  const fixture = await register_codeblock({ results_limit: 1 });
  await fixture.processor(
    JSON.stringify({ results_limit: 3 }),
    fixture.container,
    { sourcePath: fixture.target.key },
  );
  fixture.callbacks.get('settings:changed')({
    path: ['connections_lists', 'results_limit'],
    path_string: 'connections_lists.results_limit',
  });
  await new Promise(resolve => setImmediate(resolve));
  t.deepEqual(fixture.calls.at(-1).opts.connections_settings, { results_limit: 3 });
});

test('codeblock render failures are shown at the Core view boundary', async t => {
  const fixture = await register_codeblock({});
  fixture.env.smart_components.render_component = async () => {
    throw new Error('retrieval failed');
  };
  await fixture.processor('{}', fixture.container, { sourcePath: fixture.target.key });
  await new Promise(resolve => setImmediate(resolve));
  t.is(fixture.container.children.length, 1);
  t.is(fixture.container.children[0].textContent, 'Unable to load connections: retrieval failed');
});

test('codeblock renders use unregistered list scopes instead of the sidebar list', async t => {
  const fixture = await register_codeblock({ results_limit: 1 });
  const first_scope = fixture.calls[0].scope;
  t.not(first_scope, fixture.list);
  t.is(first_scope.item, fixture.target);
  t.is(fixture.target.connections, fixture.list);
  t.deepEqual(fixture.collection.items, {});

  fixture.callbacks.get('settings:changed')({ path: ['connections_lists', 'results_limit'] });
  t.not(fixture.calls[1].scope, first_scope);
  t.is(fixture.calls[1].scope.item, fixture.target);
  t.is(fixture.target.connections, fixture.list);
});

test('same-note codeblocks and the sidebar keep different concurrent retrieval limits', async t => {
  const fixture = await register_codeblock({ results_limit: 1 });
  const container = create_node();
  container.empty = () => { container.children = []; };
  container.createEl = () => container.appendChild(create_node());
  await fixture.processor(JSON.stringify({ results_limit: 3 }), container, { sourcePath: fixture.target.key });
  const [first, second] = fixture.calls;
  t.not(first.scope, second.scope);
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  for (const scope of [first.scope, second.scope, fixture.list]) {
    scope.post_process = async results => { await blocked; return results; };
  }
  const requests = [first, second].map(({ scope, opts }) => scope.get_results(build_connections_query_params(scope, opts)));
  requests.push(fixture.list.get_results());
  release();
  const [first_results, second_results, sidebar_results] = await Promise.all(requests);
  t.is(first_results.length, 1);
  t.is(second_results.length, 3);
  t.is(sidebar_results.length, 2);
  t.is(first.scope._result_params.get(first_results).limit, 1);
  t.is(second.scope._result_params.get(second_results).limit, 3);
  t.is(fixture.collection.settings.results_limit, 2);
});
