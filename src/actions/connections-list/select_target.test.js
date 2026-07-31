import test from 'ava';
import {
  connections_list_select_target,
  menus as select_target_menus,
} from './select_target.js';
import {
  connections_list_toggle_paused,
  menus as toggle_paused_menus,
} from './toggle_paused.js';
import {
  connections_target_blocks,
  menus as block_menus,
} from '../connections-target/blocks.js';
import {
  connections_target_history,
  menus as history_menus,
} from '../connections-target/history.js';

const create_menu = () => {
  const items = [];
  return {
    items,
    addItem(callback) {
      const item = {
        disabled: false,
        icon: '',
        on_click: null,
        submenu: null,
        title: '',
        setDisabled(value) {
          this.disabled = value;
          return this;
        },
        setIcon(icon) {
          this.icon = icon;
          return this;
        },
        setSubmenu() {
          this.submenu = create_menu();
          return this.submenu;
        },
        setTitle(title) {
          this.title = title;
          return this;
        },
        onClick(handler) {
          this.on_click = handler;
          return this;
        },
      };
      callback(item);
      items.push(item);
      return this;
    },
  };
};

test('item-view lifecycle actions use the exact view scope', async t => {
  const calls = [];
  const target_item = { key: 'Target.md' };
  const view = {
    async select_target(next_target, params) {
      calls.push({ action: 'select_target', next_target, params });
      return true;
    },
    async toggle_paused(params) {
      calls.push({ action: 'toggle_paused', params });
      return false;
    },
  };

  t.true(await connections_list_toggle_paused.call(view, {
    event_source: 'test:pause',
  }));
  t.true(await connections_list_select_target.call(view, {
    target_item,
    event_source: 'test:target',
  }));
  t.deepEqual(calls, [
    {
      action: 'toggle_paused',
      params: {
        event_source: 'test:pause',
      },
    },
    {
      action: 'select_target',
      next_target: target_item,
      params: {
        event_source: 'test:target',
      },
    },
  ]);
});

test('item-view menu uses the view scope for lifecycle and target placements', t => {
  const menu = create_menu();
  const calls = [];
  const view = {
    paused: true,
  };
  const env = {
    build_menu(...args) {
      calls.push(args);
      return args[1];
    },
  };

  const toggle_spec = toggle_paused_menus['connections:item_view_list_menu'];
  t.is(toggle_spec.title.call({ scope: view }), 'Resume auto-refresh');
  t.is(toggle_spec.icon.call({ scope: view }), 'play-circle');

  select_target_menus['connections:item_view_list_menu'].build.call({
    env,
    menu,
    scope: view,
  });

  t.is(menu.items.length, 1);
  t.is(calls.length, 1);
  t.is(calls[0][0], 'connections:target_menu');
  t.is(calls[0][2], view);
});

test('target placements resolve candidates and select targets through the item view scope', async t => {
  const source = {
    key: 'Current.md',
    blocks: [
      { key: 'Current.md#Second', lines: [20], vec: [1] },
      { key: 'Current.md#First', lines: [10], vec: [1] },
    ],
  };
  const history_source = { key: 'History.md' };
  const runs = [];
  const env = {
    config: {
      actions: {
        connections_list_select_target: {
          action(params) {
            runs.push({ scope: this, params });
            return Promise.resolve(true);
          },
        },
      },
    },
    smart_sources: {
      get(key) {
        return {
          'Current.md': source,
          'History.md': history_source,
        }[key];
      },
    },
  };
  const view = {
    env,
    current: source,
    connections_target_history: ['History.md'],
  };
  const menu = create_menu();

  history_menus['connections:target_menu'].build.call({
    env,
    event_source: 'menu:connections:target_menu:connections_target_history',
    menu,
    params: {},
    resolve_action() {
      return connections_target_history.bind(view);
    },
    scope: view,
  });
  block_menus['connections:target_menu'].build.call({
    env,
    event_source: 'menu:connections:target_menu:connections_target_blocks',
    menu,
    params: {},
    resolve_action() {
      return connections_target_blocks.bind(view);
    },
    scope: view,
  });

  t.deepEqual(menu.items.map(item => item.title), ['History', 'Blocks']);
  t.deepEqual(menu.items[1].submenu.items.map(item => item.title), [
    'Current.md > First',
    'Current.md > Second',
  ]);

  await menu.items[0].submenu.items[0].on_click();
  await menu.items[1].submenu.items[0].on_click();

  t.is(runs[0].scope, view);
  t.is(runs[1].scope, view);
  t.deepEqual(runs.map(run => run.params), [
    {
      target_item: history_source,
      event_source: 'menu:connections:target_menu:connections_target_history',
    },
    {
      target_item: source.blocks[1],
      event_source: 'menu:connections:target_menu:connections_target_blocks',
    },
  ]);
});
