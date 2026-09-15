import test from 'ava';
import { build_menu } from 'obsidian-smart-env/src/utils/menu_actions.js';
import { create_feedback_fixture } from '../../../test/fixtures/connections_feedback.js';
import { create_graph_fixture } from '../../../test/fixtures/connections_graph.js';
import { create_node, install_components, load_component, presenter } from '../../../test/fixtures/presentation_surface.js';
import { get_visible_connections_results } from '../../utils/get_visible_connections_results.js';
import * as feedback_utils from '../../utils/connections_list_item_state.js';
import { ConnectionsLists } from '../../collections/connections_lists.js';
import {
  connections_list_open_settings,
  menus as settings_menus,
} from './open_settings.js';
import {
  connections_list_set_graph_component,
  menus as graph_menus,
} from './set_graph_component.js';

function create_menu() {
  return {
    items: [],
    addItem(callback) {
      const item = {
        setTitle(value) { this.title = value; return this; },
        setIcon(value) { this.icon = value; return this; },
        setDisabled(value) { this.disabled = value; return this; },
        setChecked(value) { this.checked = value; return this; },
        onClick(callback) { this.on_click = callback; return this; },
        setSubmenu() { this.submenu = create_menu(); return this.submenu; },
      };
      callback(item);
      this.items.push(item);
      return this;
    },
  };
}

function create_fixture() {
  const saved = [];
  const rendered = [];
  const opened = [];
  const env = {
    config: {
      components: {
        connections_graph_v1: { display_name: '2D similarity map' },
        connections_graph_3d: { display_name: '3D semantic neighborhood (Pro)' },
        connections_graph_anchored: { display_name: '2D semantic neighborhood (Pro)' },
        connections_list: {},
      },
      actions: {
        connections_list_open_settings: { action: connections_list_open_settings, menus: settings_menus },
        connections_list_set_graph_component: { action: connections_list_set_graph_component, menus: graph_menus },
      },
    },
    smart_settings: { async save() { saved.push(true); } },
    smart_connections_plugin: {
      manifest: { id: 'smart-connections' },
      app: { setting: {
        async open() { opened.push('open'); },
        async openTabById(id) { opened.push(id); },
      } },
    },
  };
  env.build_menu = (key, menu, scope, params) => build_menu(env, key, menu, scope, params);
  const collection = {
    env,
    settings: {
      connections_graph_component_key: 'connections_graph_v1',
      footer_connections_graph_component_key: 'connections_graph_anchored',
    },
    get_connections_graph_component_options: ConnectionsLists.prototype.get_connections_graph_component_options,
  };
  const scope = { env, collection, item: { key: 'Current.md' } };
  const params = { async render_connections(options) { rendered.push(options); } };
  const menu = create_menu();
  return { env, collection, scope, params, menu, saved, rendered, opened };
}

test('list menu groups configuration under Settings without changing the action scope or params', async t => {
  const fixture = create_fixture();
  const received = [];
  fixture.env.config.actions.extra_setting = {
    action(params) { received.push({ scope: this, params }); },
    menus: { 'connections:settings_menu': { title: 'Extra setting', order: 80 } },
  };
  fixture.params.footer = true;
  build_menu(fixture.env, 'connections:list_menu', fixture.menu, fixture.scope, fixture.params);
  t.deepEqual(fixture.menu.items.map(item => item.title), ['Settings']);
  const children = fixture.menu.items[0].submenu.items;
  t.deepEqual(children.map(item => item.title), ['Graph style', 'Extra setting', 'All Connections settings']);
  await children[1].on_click();
  t.is(received[0].scope, fixture.scope);
  t.true(received[0].params.footer);
  t.is(received[0].params.render_connections, fixture.params.render_connections);
  t.is(received[0].params.event_source, 'menu:connections:settings_menu:extra_setting');
  await children[2].on_click();
  t.deepEqual(fixture.opened, ['open', 'smart-connections']);
});

for (const menu_key of ['connections:settings_menu', 'connections:graph_menu']) {
  test(`${menu_key} lists available graph components and checks only the selected style`, t => {
    const fixture = create_fixture();
    fixture.env.config.components.connections_graph_future = { display_name: 'Future graph' };
    fixture.collection.settings.connections_graph_component_key = 'connections_graph_future';
    build_menu(fixture.env, menu_key, fixture.menu, fixture.scope, fixture.params);
    t.false(fixture.menu.items.some(item => item.title === 'Show graph'));
    const children = fixture.menu.items[0].submenu.items;
    t.deepEqual(children.map(item => item.title), [
      'None', '2D similarity map', '3D semantic neighborhood (Pro)', '2D semantic neighborhood (Pro)', 'Future graph',
    ]);
    t.deepEqual(children.map(item => item.checked), [false, false, false, false, true]);
  });

  test(`${menu_key} invokes the graph action and preserves the render callback`, async t => {
    const fixture = create_fixture();
    build_menu(fixture.env, menu_key, fixture.menu, fixture.scope, fixture.params);
    t.true(await fixture.menu.items[0].submenu.items[2].on_click());
    t.is(fixture.collection.settings.connections_graph_component_key, 'connections_graph_3d');
    t.is(fixture.collection.settings.footer_connections_graph_component_key, 'connections_graph_anchored');
    t.is(fixture.saved.length, 1);
    t.deepEqual(fixture.rendered, [{
      connections_item: fixture.scope.item,
      force: true,
      event_source: `menu:${menu_key}:connections_list_set_graph_component`,
    }]);
    const reopened = create_menu();
    build_menu(fixture.env, menu_key, reopened, fixture.scope, fixture.params);
    t.deepEqual(reopened.items[0].submenu.items.map(item => item.checked), [false, false, true, false]);
  });
}

test('footer graph selection reads and updates only the footer preference', async t => {
  const fixture = create_fixture();
  fixture.params.footer = true;
  build_menu(fixture.env, 'connections:list_menu', fixture.menu, fixture.scope, fixture.params);
  const children = fixture.menu.items[0].submenu.items[0].submenu.items;
  t.deepEqual(children.map(item => item.checked), [false, false, false, true]);
  t.true(await children[2].on_click());
  t.is(fixture.collection.settings.footer_connections_graph_component_key, 'connections_graph_3d');
  t.is(fixture.collection.settings.connections_graph_component_key, 'connections_graph_v1');
  t.is(fixture.saved.length, 1);
  t.is(fixture.rendered.length, 1);
});

for (const requested_key of [undefined, 'connections_graph_unavailable']) {
  test(`graph menu checks the rendered fallback for a missing or unavailable preference: ${requested_key}`, t => {
    const fixture = create_fixture();
    fixture.collection.settings.connections_graph_component_key = requested_key;
    build_menu(fixture.env, 'connections:graph_menu', fixture.menu, fixture.scope, fixture.params);
    t.deepEqual(fixture.menu.items[0].submenu.items.map(item => item.checked), [false, true, false, false]);
  });
}

test('selecting the current graph is a no-op without saving or rerendering', async t => {
  const fixture = create_fixture();
  build_menu(fixture.env, 'connections:graph_menu', fixture.menu, fixture.scope, fixture.params);
  t.false(await fixture.menu.items[0].submenu.items[1].on_click());
  t.deepEqual(fixture.saved, []);
  t.deepEqual(fixture.rendered, []);
});

test('graph action rejects missing, unrelated, and unavailable component keys', async t => {
  const fixture = create_fixture();
  for (const graph_component_key of [undefined, '', 'connections_list', 'connections_graph_unavailable']) {
    t.false(await connections_list_set_graph_component.call(fixture.scope, { ...fixture.params, graph_component_key }));
  }
  t.is(fixture.collection.settings.connections_graph_component_key, 'connections_graph_v1');
  t.deepEqual(fixture.saved, []);
  t.deepEqual(fixture.rendered, []);
});

test('an empty component registry keeps None as the only graph option', t => {
  const fixture = create_fixture();
  fixture.env.config.components = {};
  fixture.collection.settings.connections_graph_component_key = 'none';
  build_menu(fixture.env, 'connections:graph_menu', fixture.menu, fixture.scope, fixture.params);
  t.deepEqual(fixture.menu.items.map(item => item.title), ['Graph style']);
  t.deepEqual(fixture.menu.items[0].submenu.items.map(item => item.title), ['None']);
  t.true(fixture.menu.items[0].submenu.items[0].checked);
});

test('selecting a graph from None enables that component without creating a visibility setting', async t => {
  const fixture = create_fixture();
  fixture.collection.settings.connections_graph_component_key = 'none';
  t.true(await connections_list_set_graph_component.call(fixture.scope, { graph_component_key: 'connections_graph_3d' }));
  t.is(fixture.collection.settings.connections_graph_component_key, 'connections_graph_3d');
  t.false('show_connections_graph' in fixture.collection.settings);
  t.is(fixture.saved.length, 1);
});

test('opening Connections settings directly still opens the existing plugin settings tab', async t => {
  const fixture = create_fixture();
  t.true(await connections_list_open_settings.call(fixture.scope));
  t.deepEqual(fixture.opened, ['open', 'smart-connections']);
});


test('the shared presenter passes footer context and rerender callback to both graph and list', async t => {
  const fixture = create_feedback_fixture();
  fixture.collection.settings.footer_connections_graph_component_key = 'connections_graph_v1';
  const calls = install_components(fixture);
  const render_connections = () => {};
  await fixture.env.smart_components.render_component('connections_results', fixture.list, { footer: true, render_connections });
  for (const key of ['connections_graph_v1', 'connections_list_item_v3']) {
    const call = calls.find(call => call.key === key);
    t.true(call.options.footer);
    t.is(call.options.render_connections, render_connections);
  }
});

test('Core graph menus retain footer context and the rerender callback', async t => {
  const fixture = create_graph_fixture(new URL('../../components/connections-graph/v1.js', import.meta.url));
  t.teardown(() => fixture.dispose());
  const calls = [];
  const render_connections = () => {};
  fixture.env.build_menu = (key, menu, scope, params) => { calls.push({ key, scope, params }); };
  await fixture.graph.render.call(fixture.view, fixture.list, { results: [], footer: true, render_connections });
  fixture.container.listeners.contextmenu({ preventDefault() {}, stopPropagation() {} });
  t.is(calls[0].key, 'connections:graph_menu');
  t.is(calls[0].scope, fixture.list);
  t.true(calls[0].params.footer);
  t.is(calls[0].params.render_connections, render_connections);
});

test('Core result menus retain footer context and the rerender callback', async t => {
  const fixture = create_feedback_fixture();
  const calls = [];
  fixture.env.smart_connections_plugin = { app: {}, registerDomEvent(node, name, callback) { node.listeners[name] = callback; } };
  fixture.env.build_menu = (key, menu, scope, params) => { calls.push({ key, scope, params }); };
  const row = create_node(['sc-collapsed']);
  row.selectors['.header .svg-icon.right-triangle'] = create_node();
  const results = await get_visible_connections_results(fixture.list);
  const render_connections = () => {};
  const { post_process } = load_component(new URL('../../components/connections-list-item/v3.js', import.meta.url), ['post_process'], {
    ...feedback_utils,
    get_item_display_name: item => item.key,
    register_item_drag() {}, register_item_hover_popover() {}, open_source() {},
    MutationObserver: class { observe() {} },
  });
  await post_process.call(presenter, results[0], row, { visible_results: results, footer: true, render_connections });
  row.listeners.contextmenu({ preventDefault() {}, stopPropagation() {} });
  const call = calls.find(call => call.key === 'connections:list_menu');
  t.is(call.scope, fixture.list);
  t.true(call.params.footer);
  t.is(call.params.render_connections, render_connections);
});

for (const menu_key of ['connections:settings_menu', 'connections:graph_menu']) {
  for (const footer of [false, true]) {
    test(`${menu_key} None and component selections change only the ${footer ? 'footer' : 'sidebar'} preference`, async t => {
      const fixture = create_fixture();
      const setting_key = footer ? 'footer_connections_graph_component_key' : 'connections_graph_component_key';
      const other_key = footer ? 'connections_graph_component_key' : 'footer_connections_graph_component_key';
      const other_value = fixture.collection.settings[other_key];
      fixture.params.footer = footer;
      build_menu(fixture.env, menu_key, fixture.menu, fixture.scope, fixture.params);
      t.is(fixture.menu.items[0].title, 'Graph style');
      t.false(fixture.menu.items.some(item => item.title === 'Show graph'));
      t.true(await fixture.menu.items[0].submenu.items[0].on_click());
      t.is(fixture.collection.settings[setting_key], 'none');
      t.is(fixture.collection.settings[other_key], other_value);
      const hidden_menu = create_menu();
      build_menu(fixture.env, menu_key, hidden_menu, fixture.scope, fixture.params);
      t.false(hidden_menu.items.some(item => item.title === 'Show graph'));
      t.deepEqual(hidden_menu.items[0].submenu.items.map(item => item.checked), [true, false, false, false]);
      t.false(await hidden_menu.items[0].submenu.items[0].on_click());
      t.is(fixture.saved.length, 1);
      t.true(await hidden_menu.items[0].submenu.items[2].on_click());
      t.is(fixture.collection.settings[setting_key], 'connections_graph_3d');
      t.is(fixture.collection.settings[other_key], other_value);
      t.is(fixture.saved.length, 2);
      t.is(fixture.rendered.length, 2);
      t.false('show_connections_graph' in fixture.collection.settings);
      t.false('footer_show_connections_graph' in fixture.collection.settings);
      const shown_menu = create_menu();
      build_menu(fixture.env, menu_key, shown_menu, fixture.scope, fixture.params);
      t.deepEqual(shown_menu.items[0].submenu.items.map(item => item.checked), [false, false, true, false]);
    });

    test(`${menu_key} selecting None hides only the ${footer ? 'footer' : 'sidebar'} graph`, async t => {
      const fixture = create_fixture();
      fixture.params.footer = footer;
      const before = { ...fixture.collection.settings };
      const setting_key = footer ? 'footer_connections_graph_component_key' : 'connections_graph_component_key';
      build_menu(fixture.env, menu_key, fixture.menu, fixture.scope, fixture.params);
      t.true(await fixture.menu.items[0].submenu.items[0].on_click());
      t.deepEqual(fixture.collection.settings, { ...before, [setting_key]: 'none' });
      t.is(fixture.saved.length, 1);
      t.is(fixture.rendered.length, 1);
    });
  }
}

test('an unset footer preference checks None instead of the sidebar default', t => {
  const fixture = create_fixture();
  delete fixture.collection.settings.footer_connections_graph_component_key;
  fixture.params.footer = true;
  build_menu(fixture.env, 'connections:settings_menu', fixture.menu, fixture.scope, fixture.params);
  t.true(fixture.menu.items[0].submenu.items[0].checked);
});

test('graph selection from None works when the default implementation is absent', async t => {
  const fixture = create_fixture();
  delete fixture.env.config.components.connections_graph_v1;
  fixture.collection.settings.connections_graph_component_key = 'none';
  build_menu(fixture.env, 'connections:settings_menu', fixture.menu, fixture.scope, fixture.params);
  t.true(await fixture.menu.items[0].submenu.items[1].on_click());
  t.is(fixture.collection.settings.connections_graph_component_key, 'connections_graph_3d');
});

for (const footer of [false, true]) {
  test(`the graph action rerenders the ${footer ? 'footer' : 'sidebar'} from visible to None and back`, async t => {
    const fixture = create_feedback_fixture();
    Object.assign(fixture.collection.settings, {
      connections_graph_component_key: 'connections_graph_v1',
      footer_connections_graph_component_key: 'connections_graph_v1',
    });
    fixture.collection.get_connections_graph_component_options = ConnectionsLists.prototype.get_connections_graph_component_options;
    fixture.env.config.components = { connections_graph_v1: {} };
    install_components(fixture);
    let root;
    const params = { footer, async render_connections() {
      root = await fixture.env.smart_components.render_component('connections_results', fixture.list, { footer });
    } };
    await params.render_connections();
    t.is(root.querySelector('.connections-graph-container').children.length, 1);
    t.true(await connections_list_set_graph_component.call(fixture.list, { ...params, graph_component_key: 'none' }));
    t.is(root.querySelector('.connections-graph-container').children.length, 0);
    t.is(root.querySelector('.connections-list').children.length, 2);
    const other_root = await fixture.env.smart_components.render_component('connections_results', fixture.list, { footer: !footer });
    t.is(other_root.querySelector('.connections-graph-container').children.length, 1);
    t.true(await connections_list_set_graph_component.call(fixture.list, { ...params, graph_component_key: 'connections_graph_v1' }));
    t.is(root.querySelector('.connections-graph-container').children.length, 1);
  });
}
