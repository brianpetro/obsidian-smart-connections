import test from 'ava';
import {
  connections_list_copy_as_links,
  menus as copy_as_links_menus,
} from './copy_as_links.js';
import { connections_list_open_settings, menus as open_settings_menus } from './open_settings.js';
import { connections_list_refresh } from './refresh.js';
import {
  connections_list_send_to_context,
  menus as send_to_context_menus,
} from './send_to_context.js';
import {
  connections_list_send_to_smart_graph,
  menus as send_to_smart_graph_menus,
  SMART_GRAPH_URL,
} from './send_to_smart_graph.js';
import {
  connections_list_toggle_expanded,
  menus as toggle_expanded_menus,
} from './toggle_expanded.js';
import {
  connections_list_unhide_all,
  menus as unhide_all_menus,
} from './unhide_all.js';
import {
  connections_list_unpin_all,
  menus as unpin_all_menus,
} from './unpin_all.js';

function build_connections_list(params = {}) {
  const emitted = [];
  const added_items = [];
  const smart_context = {
    add_items(items) {
      added_items.push(...items);
    },
    emit_event(event_key) {
      emitted.push(event_key);
    },
  };
  const source_item = params.source_item || build_source_item(params);

  const connections_list = {
    item: source_item,
    results: params.results || [],
    env: {
      smart_contexts: {
        new_context() {
          return smart_context;
        },
      },
      events: {
        emit(event_key, event) {
          emitted.push({ event_key, event });
        },
      },
    },
    emit_event(event_key, event) {
      emitted.push(event ? { event_key, event } : event_key);
    },
  };

  return {
    connections_list,
    emitted,
    added_items,
  };
}

function build_source_item(params = {}) {
  const emitted = [];
  const calls = [];
  return {
    key: 'source.md',
    data: {
      connections: {
        ...(params.connections || {}),
      },
      hidden_connections: params.hidden_connections,
    },
    env: {
      events: {
        emit(event_key, event) {
          emitted.push({ event_key, event });
        },
      },
    },
    collection: {
      save() {
        calls.push('save');
      },
    },
    queue_save() {
      calls.push('queue_save');
    },
    emit_event(event_key, event) {
      emitted.push(event ? { event_key, event } : event_key);
    },
    emitted,
    calls,
  };
}

function build_class_el(params = {}) {
  const classes = new Set(params.classes || []);
  const children = params.children || [];
  return {
    classes,
    dataset: { ...(params.dataset || {}) },
    classList: {
      add(class_name) {
        classes.add(class_name);
      },
      remove(class_name) {
        classes.delete(class_name);
      },
      contains(class_name) {
        return classes.has(class_name);
      },
    },
    removeAttribute(attr_key) {
      if (attr_key.startsWith('data-')) {
        delete this.dataset[attr_key.slice(5)];
      }
    },
    closest(selector) {
      if (selector === '.sc-connections-view') return this;
      return null;
    },
    querySelector(selector) {
      if (selector === '[title="Refresh"]') return params.refresh_button || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.sc-result') return children;
      if (selector === '.sc-result[data-pinned]') return children;
      return [];
    },
  };
}

test('connections_list_refresh refreshes its scoped source and rerenders the view', async (t) => {
  const calls = [];
  const refresh_entity = {
    async read() {
      calls.push('read');
    },
    queue_import() {
      calls.push('queue_import');
    },
    collection: {
      async process_source_import_queue() {
        calls.push('process_source_import_queue');
      },
    },
  };
  const view = {
    async render_view(params) {
      calls.push({ render_view: params });
    },
  };

  const refreshed = await connections_list_refresh.call({ item: refresh_entity }, { view });

  t.true(refreshed);
  t.deepEqual(calls, [
    'read',
    'queue_import',
    'process_source_import_queue',
    { render_view: { connections_item: refresh_entity } },
  ]);
});

test('connections_list_send_to_context creates a Smart Context from visible results', (t) => {
  const { connections_list, emitted, added_items } = build_connections_list();
  const visible_results = [
    {
      item: {
        key: 'target.md',
        collection_key: 'smart_sources',
      },
    },
  ];

  const sent = connections_list_send_to_context.call(connections_list, {
    visible_results,
  });

  t.true(sent);
  t.true(added_items.length > 0);
  t.true(emitted.includes('context_selector:open'));
  t.true(emitted.includes('connections:sent_to_context'));
});

test('connections_list_send_to_context emits empty warning when there are no visible results', (t) => {
  const { connections_list, emitted, added_items } = build_connections_list();

  const sent = connections_list_send_to_context.call(connections_list, {
    visible_results: [],
  });

  t.false(sent);
  t.deepEqual(added_items, []);
  t.is(emitted[0].event_key, 'connections:send_to_context_empty');
});

test('send-to-context menu metadata disables empty result sets', (t) => {
  const disabled = send_to_context_menus['connections:list_menu'].disabled.call({
    scope: { item: { key: 'source.md' } },
    params: { visible_results: [] },
  });

  t.true(disabled);
});

test('connections_list_send_to_smart_graph opens the Smart Graph canonical page', (t) => {
  const opened = [];
  const previous_active_window = globalThis.activeWindow;
  globalThis.activeWindow = {
    open(url, target) {
      opened.push({ url, target });
    },
  };

  try {
    connections_list_send_to_smart_graph.call({});

    t.deepEqual(opened, [
      {
        url: SMART_GRAPH_URL,
        target: '_external',
      },
    ]);
    t.true(SMART_GRAPH_URL.endsWith('/smart-graph/'));
  } finally {
    if (previous_active_window) {
      globalThis.activeWindow = previous_active_window;
    } else {
      delete globalThis.activeWindow;
    }
  }
});

test('send-to-smart-graph placeholder menu metadata is registered', (t) => {
  t.deepEqual(send_to_smart_graph_menus['connections:list_menu'], {
    title: 'Explore in Smart Graph',
    icon: 'smart-graph',
    order: 30,
    when: send_to_smart_graph_menus['connections:list_menu'].when,
  });
});

test('connections_list_toggle_expanded toggles setting and rendered result classes', (t) => {
  const result_a = build_class_el();
  const result_b = build_class_el();
  const container = build_class_el({ children: [result_a, result_b] });
  const connections_settings = { expanded_view: true };

  const toggled = connections_list_toggle_expanded({
    connections_settings,
    container,
  });

  t.true(toggled);
  t.false(connections_settings.expanded_view);
  t.true(result_a.classList.contains('sc-collapsed'));
  t.true(result_b.classList.contains('sc-collapsed'));
});

test('toggle-expanded menu metadata reflects current expanded state', (t) => {
  const menu_ctx = {
    scope: null,
    params: {
      connections_settings: { expanded_view: false },
    },
  };

  t.is(toggle_expanded_menus['connections:list_menu'].title.call(menu_ctx), 'Expand all results');
  t.is(toggle_expanded_menus['connections:list_menu'].icon.call(menu_ctx), 'unfold-vertical');

  menu_ctx.params.connections_settings.expanded_view = true;

  t.is(toggle_expanded_menus['connections:list_menu'].title.call(menu_ctx), 'Collapse all results');
  t.is(toggle_expanded_menus['connections:list_menu'].icon.call(menu_ctx), 'fold-vertical');
});

test.serial('connections_list_copy_as_links emits events after clipboard success', async (t) => {
  const previous_navigator_descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const copied_text = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        async writeText(text) {
          copied_text.push(text);
        },
      },
    },
  });

  try {
    const { connections_list, emitted } = build_connections_list();
    const copied = await connections_list_copy_as_links.call(connections_list, {
      visible_results: [{ item: { key: 'Folder/Target.md' } }],
    });

    t.true(copied);
    t.deepEqual(copied_text, ['- [[Target]]']);
    t.true(emitted.includes('connections:copied_list'));
    t.true(emitted.some((entry) => entry?.event_key === 'connections:list_copied'));
  } finally {
    if (previous_navigator_descriptor) {
      Object.defineProperty(globalThis, 'navigator', previous_navigator_descriptor);
    } else {
      delete globalThis.navigator;
    }
  }
});

test('copy-as-links menu metadata disables when visible result links are empty', (t) => {
  const { connections_list } = build_connections_list();

  t.true(copy_as_links_menus['connections:list_menu'].disabled.call({
    scope: connections_list,
    params: { visible_results: [] },
  }));

  t.false(copy_as_links_menus['connections:list_menu'].disabled.call({
    scope: connections_list,
    params: { visible_results: [{ item: { key: 'Folder/Target.md' } }] },
  }));
});


test('connections_list_open_settings uses view helper before app fallback', async (t) => {
  const calls = [];
  const { connections_list } = build_connections_list();

  const opened_from_view = await connections_list_open_settings.call(connections_list, {
    view: {
      async open_settings() {
        calls.push('view.open_settings');
      },
    },
  });

  t.true(opened_from_view);
  t.deepEqual(calls, ['view.open_settings']);

  const fallback_calls = [];
  connections_list.env.smart_connections_plugin = {
    manifest: { id: 'smart-connections' },
    app: {
      setting: {
        async open() {
          fallback_calls.push('open');
        },
        async openTabById(plugin_id) {
          fallback_calls.push(plugin_id);
        },
      },
    },
  };

  const opened_from_app = await connections_list_open_settings.call(connections_list);

  t.true(opened_from_app);
  t.deepEqual(fallback_calls, ['open', 'smart-connections']);
  t.is(open_settings_menus['connections:list_menu'].title, 'Connections settings');
});

test('connections_list_unhide_all clears hidden state and requests refresh', (t) => {
  const refresh_calls = [];
  const refresh_button = {
    click() {
      refresh_calls.push('click');
    },
  };
  const source_item = build_source_item({
    connections: {
      'smart_sources:hidden.md': { hidden: 1 },
      'smart_sources:pinned.md': { pinned: 2 },
    },
    hidden_connections: {
      'hidden.md': 1,
    },
  });
  const { connections_list } = build_connections_list({ source_item });
  const container = build_class_el({ refresh_button });

  const unhidden = connections_list_unhide_all.call(connections_list, { container });

  t.true(unhidden);
  t.deepEqual(source_item.data.connections, {
    'smart_sources:pinned.md': { pinned: 2 },
  });
  t.false('hidden_connections' in source_item.data);
  t.deepEqual(refresh_calls, ['click']);
  t.deepEqual(source_item.calls, ['queue_save', 'save']);
});


test('connections_list_unhide_all refreshes through view when provided', (t) => {
  const render_calls = [];
  const source_item = build_source_item({
    connections: {
      'smart_sources:hidden.md': { hidden: 1 },
    },
  });
  const { connections_list } = build_connections_list({ source_item });

  const unhidden = connections_list_unhide_all.call(connections_list, {
    view: {
      render_view(params) {
        render_calls.push(params);
      },
    },
  });

  t.true(unhidden);
  t.deepEqual(render_calls, [{ connections_item: source_item, force: true }]);
});

test('connections_list_unpin_all clears pinned state and rendered pinned markers', (t) => {
  const result_a = build_class_el({ classes: ['sc-result-pinned'], dataset: { pinned: 'true' } });
  const result_b = build_class_el({ classes: ['sc-result-pinned'], dataset: { pinned: 'true' } });
  const container = build_class_el({ children: [result_a, result_b] });
  const source_item = build_source_item({
    connections: {
      'smart_sources:hidden.md': { hidden: 1 },
      'smart_sources:pinned.md': { pinned: 2 },
      'smart_sources:both.md': { hidden: 3, pinned: 4 },
    },
  });
  const { connections_list } = build_connections_list({ source_item });

  const unpinned = connections_list_unpin_all.call(connections_list, { container });

  t.true(unpinned);
  t.deepEqual(source_item.data.connections, {
    'smart_sources:hidden.md': { hidden: 1 },
    'smart_sources:both.md': { hidden: 3 },
  });
  t.false(result_a.classList.contains('sc-result-pinned'));
  t.false(result_b.classList.contains('sc-result-pinned'));
  t.false(Object.prototype.hasOwnProperty.call(result_a.dataset, 'pinned'));
  t.false(Object.prototype.hasOwnProperty.call(result_b.dataset, 'pinned'));
  t.deepEqual(source_item.calls, ['queue_save', 'save']);
});

test('bulk list menu metadata derives counts from list scope', (t) => {
  const source_item = build_source_item({
    connections: {
      'smart_sources:pinned.md': { pinned: 1 },
      'smart_sources:hidden.md': { hidden: 2 },
    },
  });
  const { connections_list } = build_connections_list({ source_item });
  const menu_ctx = {
    scope: connections_list,
    params: {},
  };

  t.is(unhide_all_menus['connections:list_menu'].title.call(menu_ctx), 'Unhide All (1)');
  t.false(unhide_all_menus['connections:list_menu'].disabled.call(menu_ctx));
  t.is(unpin_all_menus['connections:list_menu'].title.call(menu_ctx), 'Unpin All (1)');
  t.false(unpin_all_menus['connections:list_menu'].disabled.call(menu_ctx));
});

