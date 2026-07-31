import test from 'ava';
import { connections_list_select_target } from './select_target.js';
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

test('select-target action uses the item view as its scope', async t => {
  const selected = [];
  const target_item = { key: 'Target.md' };
  const view = {
    paused: false,
    async select_target(next_target, params) {
      selected.push({ next_target, params });
      return true;
    },
  };

  t.true(await connections_list_select_target.call(view, {
    target_item,
    event_source: 'test:target',
  }));
  t.false(view.paused);
  t.deepEqual(selected, [{
    next_target: target_item,
    params: {
      event_source: 'test:target',
    },
  }]);
});

test('target placement modules use the same item view scope', async t => {
  const source = {
    key: 'Current.md',
    blocks: [
      { key: 'Current.md#Second', lines: [20], vec: [1] },
      { key: 'Current.md#First', lines: [10], vec: [1] },
    ],
  };
  const history_source = { key: 'History.md' };
  const selected = [];
  const env = {
    config: {
      actions: {
        connections_list_select_target: {
          action: connections_list_select_target,
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
    async select_target(target_item, params) {
      selected.push({ target_item, params, scope: this });
      return true;
    },
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

  t.is(selected.length, 2);
  t.is(selected[0].scope, view);
  t.is(selected[1].scope, view);
  t.deepEqual(selected.map(({ target_item, params }) => ({
    target_item,
    params,
  })), [
    {
      target_item: history_source,
      params: {
        event_source: 'menu:connections:target_menu:connections_target_history',
      },
    },
    {
      target_item: source.blocks[1],
      params: {
        event_source: 'menu:connections:target_menu:connections_target_blocks',
      },
    },
  ]);
});
