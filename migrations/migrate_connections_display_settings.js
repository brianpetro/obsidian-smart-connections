/**
 * Replace legacy layout selections with independent graph and result settings.
 * Run once from plugin initialization after SmartEnv loads. New settings win.
 * Apply display defaults here: SmartEnv merges collection defaults before plugin
 * initialization, which would otherwise mask saved legacy choices.
 * @param {object} settings - Persisted connections_lists settings.
 * @param {string} [default_item_key] - Default result style supplied by Pro.
 */
export function migrate_connections_display_settings(settings, default_item_key) {
  const legacy_list_key = settings.connections_list_component_key;
  let legacy_item_key = settings.components?.connections_list_v4_2?.connections_list_item_component_key
    ?? settings.connections_list_item_component_key;
  // The main layout determines result style; footers now share that preference.
  if (legacy_list_key === 'connections_list_v3' || legacy_list_key === 'connections_list_v4') {
    legacy_item_key = 'connections_list_item_v3';
  } else if (legacy_list_key === 'connections_list_v4_2') {
    legacy_item_key ??= 'connections_list_item_v4';
  }

  for (const [list_key, show_key, graph_key, default_show_graph] of [
    ['connections_list_component_key', 'show_connections_graph', 'connections_graph_component_key', true],
    ['footer_connections_list_component_key', 'footer_show_connections_graph', 'footer_connections_graph_component_key', false],
  ]) {
    const legacy_key = settings[list_key];
    settings[show_key] ??= legacy_key ? legacy_key !== 'connections_list_v3' : default_show_graph;
    settings[graph_key] ??= 'connections_graph_v1';
    if (settings[graph_key] === 'connections_graph_v2') settings[graph_key] = 'connections_graph_v1';
    delete settings[list_key];
  }

  const item_key = legacy_item_key ?? default_item_key;
  if (item_key) {
    settings.components ??= {};
    settings.components.connections_list ??= {};
    settings.components.connections_list.connections_list_item_component_key ??= item_key;
  }
  delete settings.connections_list_item_component_key;

  // Retired list components have no remaining settings consumers.
  for (const component_key of ['connections_list_v3', 'connections_list_v4', 'connections_list_v4_2']) {
    delete settings.components?.[component_key];
  }
}
