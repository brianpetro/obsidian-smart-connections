import test from 'ava';
import { migrate_connections_display_settings } from './migrate_connections_display_settings.js';

for (const [legacy_key, show_graph, item_key] of [
  ['connections_list_v3', false, 'connections_list_item_v3'],
  ['connections_list_v4', true, 'connections_list_item_v3'],
  ['connections_list_v4_2', true, 'connections_list_item_v4'],
]) {
  test(`migrate ${legacy_key} into independent graph settings and its original result style`, t => {
    const settings = {
      connections_list_component_key: legacy_key,
      footer_connections_list_component_key: legacy_key,
    };
    migrate_connections_display_settings(settings, 'connections_list_item_v4');
    t.is(settings.show_connections_graph, show_graph);
    t.is(settings.footer_show_connections_graph, show_graph);
    t.is(settings.connections_graph_component_key, 'connections_graph_v1');
    t.is(settings.footer_connections_graph_component_key, 'connections_graph_v1');
    t.is(settings.components.connections_list.connections_list_item_component_key, item_key);
    t.false('connections_list_component_key' in settings);
    t.false('footer_connections_list_component_key' in settings);
    const migrated = structuredClone(settings);
    migrate_connections_display_settings(settings, 'connections_list_item_v4');
    t.deepEqual(settings, migrated);
  });
}

for (const legacy_key of ['connections_list_v3', 'connections_list_v4']) {
  test(`${legacy_key} retains Classic instead of an unused v4.2 result preference`, t => {
    const settings = {
      connections_list_component_key: legacy_key,
      connections_list_item_component_key: 'top_level_row',
      components: { connections_list_v4_2: { connections_list_item_component_key: 'unused_row' } },
    };
    migrate_connections_display_settings(settings, 'connections_list_item_v4');
    t.is(settings.components.connections_list.connections_list_item_component_key, 'connections_list_item_v3');
  });
}

for (const main_key of ['connections_list_v3', 'connections_list_v4', 'connections_list_v4_2']) {
  for (const footer_key of ['connections_list_v3', 'connections_list_v4', 'connections_list_v4_2']) {
    test(`main ${main_key} determines result style independently of footer ${footer_key}`, t => {
      const settings = {
        connections_list_component_key: main_key,
        footer_connections_list_component_key: footer_key,
      };
      migrate_connections_display_settings(settings);
      t.is(settings.show_connections_graph, main_key !== 'connections_list_v3');
      t.is(settings.footer_show_connections_graph, footer_key !== 'connections_list_v3');
      t.is(settings.components.connections_list.connections_list_item_component_key,
        main_key === 'connections_list_v4_2' ? 'connections_list_item_v4' : 'connections_list_item_v3');
    });
  }
}

test('new graph preferences take precedence over legacy layouts and removed graph keys migrate', t => {
  const settings = {
    connections_list_component_key: 'connections_list_v4',
    footer_connections_list_component_key: 'connections_list_v3',
    show_connections_graph: false,
    footer_show_connections_graph: true,
    connections_graph_component_key: 'custom_graph',
    footer_connections_graph_component_key: 'connections_graph_v2',
  };
  migrate_connections_display_settings(settings);
  t.false(settings.show_connections_graph);
  t.true(settings.footer_show_connections_graph);
  t.is(settings.connections_graph_component_key, 'custom_graph');
  t.is(settings.footer_connections_graph_component_key, 'connections_graph_v1');
  t.is(settings.components.connections_list.connections_list_item_component_key, 'connections_list_item_v3');
});

test('fresh settings receive graph defaults and only Pro supplies a result default', t => {
  for (const default_item_key of [undefined, 'connections_list_item_v4']) {
    const settings = { results_limit: 5 };
    migrate_connections_display_settings(settings, default_item_key);
    t.true(settings.show_connections_graph);
    t.false(settings.footer_show_connections_graph);
    t.is(settings.connections_graph_component_key, 'connections_graph_v1');
    t.is(settings.footer_connections_graph_component_key, 'connections_graph_v1');
    t.is(settings.components?.connections_list?.connections_list_item_component_key, default_item_key);
    t.is(settings.results_limit, 5);
  }
});

test('migrate legacy result style into the canonical list settings', t => {
  const settings = { connections_list_item_component_key: 'connections_list_item_v3' };
  migrate_connections_display_settings(settings, 'connections_list_item_v4');
  t.is(settings.components.connections_list.connections_list_item_component_key, 'connections_list_item_v3');
  t.false('connections_list_item_component_key' in settings);
});

test('v4.2 scoped result style wins over its top-level style and Previews default', t => {
  for (const scoped_key of [undefined, 'scoped_row']) {
    const settings = {
      connections_list_component_key: 'connections_list_v4_2',
      connections_list_item_component_key: 'top_level_row',
      components: { connections_list_v4_2: { connections_list_item_component_key: scoped_key } },
    };
    migrate_connections_display_settings(settings);
    t.is(settings.components.connections_list.connections_list_item_component_key, scoped_key ?? 'top_level_row');
  }
});

test('canonical result style wins over every legacy layout and result preference', t => {
  for (const legacy_key of ['connections_list_v3', 'connections_list_v4', 'connections_list_v4_2']) {
    const settings = {
      connections_list_component_key: legacy_key,
      connections_list_item_component_key: 'top_level_row',
      components: {
        connections_list_v4_2: { connections_list_item_component_key: 'scoped_row' },
        connections_list: { connections_list_item_component_key: 'chosen_row', other_setting: true },
      },
    };
    migrate_connections_display_settings(settings, 'connections_list_item_v4');
    t.deepEqual(settings.components.connections_list, { connections_list_item_component_key: 'chosen_row', other_setting: true });
  }
});

test('retired list settings are consumed once without replacing unrelated settings objects', t => {
  const row_settings = { render_markdown: false, show_full_path: true };
  const other_settings = { enabled: true };
  const settings = {
    components: {
      connections_list_v3: {},
      connections_list_v4: {},
      connections_list_v4_2: { connections_list_item_component_key: 'connections_list_item_v3' },
      connections_list_item_v3: row_settings,
      other_component: other_settings,
    },
  };
  const components = settings.components;
  migrate_connections_display_settings(settings);
  t.deepEqual(Object.keys(settings.components).sort(), ['connections_list', 'connections_list_item_v3', 'other_component']);
  t.is(settings.components, components);
  t.is(settings.components.connections_list.connections_list_item_component_key, 'connections_list_item_v3');
  t.is(settings.components.connections_list_item_v3, row_settings);
  t.is(settings.components.other_component, other_settings);
  const list_settings = components.connections_list;
  migrate_connections_display_settings(settings);
  t.is(settings.components, components);
  t.is(settings.components.connections_list, list_settings);
});

test('v2 graph selections normalize without changing explicit visibility', t => {
  const settings = {
    show_connections_graph: false,
    footer_show_connections_graph: true,
    connections_graph_component_key: 'connections_graph_v2',
    footer_connections_graph_component_key: 'connections_graph_v2',
  };
  migrate_connections_display_settings(settings);
  t.deepEqual(settings, {
    show_connections_graph: false,
    footer_show_connections_graph: true,
    connections_graph_component_key: 'connections_graph_v1',
    footer_connections_graph_component_key: 'connections_graph_v1',
  });
});

test('a footer-only legacy selection does not set the shared result style', t => {
  const settings = { footer_connections_list_component_key: 'connections_list_v3' };
  migrate_connections_display_settings(settings, 'connections_list_item_v4');
  t.false(settings.footer_show_connections_graph);
  t.is(settings.components.connections_list.connections_list_item_component_key, 'connections_list_item_v4');
});
