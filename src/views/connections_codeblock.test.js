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
  container.createEl = () => container.appendChild(create_node());
  const { register_smart_connections_codeblock } = load_component(new URL('./connections_codeblock.js', import.meta.url), ['register_smart_connections_codeblock']);
  await register_smart_connections_codeblock(plugin);
  await processor(JSON.stringify(settings), container, { sourcePath: fixture.target.key });
  await new Promise(resolve => setImmediate(resolve));
  return { ...fixture, calls, callbacks };
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
