import test from 'ava';
import { ConnectionsLists } from './collections/connections_lists.js';
import { deep_merge_no_overwrite } from 'smart-environment/utils/deep_merge_no_overwrite.js';
import { create_plugin_fixture } from '../test/fixtures/plugin_initialization.js';

function create_env(saved_settings = {}) {
  const env = {
    config: { components: {} },
    settings: { connections_lists: saved_settings },
    create_env_getter(scope) { scope.env = this; },
  };
  // Match SmartEnv.init_collections: defaults are merged before construction.
  deep_merge_no_overwrite(env.settings, { connections_lists: ConnectionsLists.default_settings });
  new ConnectionsLists(env);
  return env;
}

test('display migration waits for SmartEnv and runs once before registering Connections surfaces', async t => {
  const env = create_env({ connections_list_component_key: 'connections_list_v3' });
  let release_env;
  const ready = new Promise(resolve => { release_env = resolve; });
  const { plugin, calls } = create_plugin_fixture(env, async conditions => {
    t.deepEqual(conditions, { loaded: true });
    await ready;
  });
  const initializing = plugin.initialize();
  t.deepEqual(calls, []);
  t.is(env.connections_lists.settings.connections_list_component_key, 'connections_list_v3');
  release_env();
  await initializing;
  t.deepEqual(calls, ['display_migration', 'hidden_migration', 'commands', 'view', 'codeblock', 'footer']);
  t.false(env.connections_lists.settings.show_connections_graph);
  t.is(env.connections_lists.settings.components.connections_list.connections_list_item_component_key, 'connections_list_item_v3');
  t.false('connections_list_component_key' in env.connections_lists.settings);
});

test('collection construction does not migrate or prefill display defaults over saved layouts', async t => {
  const env = create_env({
    connections_list_component_key: 'connections_list_v3',
    footer_connections_list_component_key: 'connections_list_v4_2',
  });
  t.is(env.connections_lists.settings.show_connections_graph, undefined);
  t.is(env.connections_lists.settings.footer_show_connections_graph, undefined);
  t.deepEqual(env.connections_lists.settings.components.connections_list, {});
  await create_plugin_fixture(env).plugin.initialize();
  t.false(env.connections_lists.settings.show_connections_graph);
  t.true(env.connections_lists.settings.footer_show_connections_graph);
});

test('plugin initialization retains explicit new preferences over legacy choices', async t => {
  const env = create_env({
    connections_list_component_key: 'connections_list_v3',
    footer_connections_list_component_key: 'connections_list_v4_2',
    show_connections_graph: true,
    footer_show_connections_graph: false,
    connections_graph_component_key: 'connections_graph_future',
    components: { connections_list: { connections_list_item_component_key: 'chosen_row' } },
  });
  await create_plugin_fixture(env).plugin.initialize();
  t.true(env.connections_lists.settings.show_connections_graph);
  t.false(env.connections_lists.settings.footer_show_connections_graph);
  t.is(env.connections_lists.settings.connections_graph_component_key, 'connections_graph_future');
  t.is(env.connections_lists.settings.components.connections_list.connections_list_item_component_key, 'chosen_row');
});
