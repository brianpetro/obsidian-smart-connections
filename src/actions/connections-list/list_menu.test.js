import test from 'ava';
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

  const connections_list = {
    item: params.source_item || { key: 'source.md' },
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
    emit_event(event_key) {
      emitted.push(event_key);
    },
  };

  return {
    connections_list,
    emitted,
    added_items,
  };
}

function build_class_el() {
  const classes = new Set();
  return {
    classes,
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
  };
}

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
  const previous_open = globalThis.open;
  globalThis.open = (url, target) => {
    opened.push({ url, target });
  };

  try {
    const opened_page = connections_list_send_to_smart_graph.call({});

    t.true(opened_page);
    t.deepEqual(opened, [
      {
        url: SMART_GRAPH_URL,
        target: '_external',
      },
    ]);
    t.true(SMART_GRAPH_URL.endsWith('/smart-graph/'));
  } finally {
    if (typeof previous_open === 'function') {
      globalThis.open = previous_open;
    } else {
      delete globalThis.open;
    }
  }
});

test('send-to-smart-graph placeholder menu metadata is registered', (t) => {
  t.deepEqual(send_to_smart_graph_menus['connections:list_menu'], {
    title: 'Send to Smart Graph',
    icon: 'smart-graph',
    order: 25,
  });
});

test('connections_list_toggle_expanded toggles setting and rendered result classes', (t) => {
  const result_a = build_class_el();
  const result_b = build_class_el();
  const container = {
    querySelectorAll(selector) {
      return selector === '.sc-result' ? [result_a, result_b] : [];
    },
  };
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
