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

test('select-target action pauses and renders the requested target', async t => {
  const rendered = [];
  const target_item = { key: 'Target.md' };
  const view = {
    paused: false,
    async render_view(params) {
      rendered.push(params);
    },
  };

  t.true(await connections_list_select_target.call({}, {
    target_item,
    view,
    event_source: 'test:target',
  }));
  t.true(view.paused);
  t.deepEqual(rendered, [{
    connections_item: target_item,
    event_source: 'test:target',
    force: true,
  }]);
});

test('target placement modules route history and block selections through the semantic action', async t => {
  const source = {
    key: 'Current.md',
    blocks: [
      { key: 'Current.md#Second', lines: [20], vec: [1] },
      { key: 'Current.md#First', lines: [10], vec: [1] },
    ],
  };
  const history_source = { key: 'History.md' };
  const view = {
    connections_target_history: ['History.md'],
  };
  const env = {
    smart_sources: {
      get(key) {
        return {
          'Current.md': source,
          'History.md': history_source,
        }[key];
      },
    },
  };
  const runs = [];
  const scope = {
    env,
    item: source,
    actions: {
      connections_list_select_target(params) {
        runs.push(params);
        return Promise.resolve(true);
      },
    },
  };
  const menu = create_menu();

  history_menus['connections:target_menu'].build.call({
    env,
    event_source: 'menu:connections:target_menu:connections_target_history',
    menu,
    params: { view },
    resolve_action() {
      return connections_target_history.bind(scope);
    },
    scope,
  });
  block_menus['connections:target_menu'].build.call({
    env,
    event_source: 'menu:connections:target_menu:connections_target_blocks',
    menu,
    params: { view },
    resolve_action() {
      return connections_target_blocks.bind(scope);
    },
    scope,
  });

  t.deepEqual(menu.items.map(item => item.title), ['History', 'Blocks']);
  t.deepEqual(menu.items[1].submenu.items.map(item => item.title), [
    'Current.md > First',
    'Current.md > Second',
  ]);

  await menu.items[0].submenu.items[0].on_click();
  await menu.items[1].submenu.items[0].on_click();

  t.deepEqual(runs, [
    {
      target_item: history_source,
      view,
      event_source: 'menu:connections:target_menu:connections_target_history',
    },
    {
      target_item: source.blocks[1],
      view,
      event_source: 'menu:connections:target_menu:connections_target_blocks',
    },
  ]);
});
