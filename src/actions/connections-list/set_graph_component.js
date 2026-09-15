/**
 * Select a graph component, or none, for Connections views or footer connections.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {string} [params.graph_component_key] - Registered component key or 'none'.
 * @param {boolean} [params.footer=false]
 * @param {(params?: object) => Promise<void>|void} [params.render_connections]
 * @param {string} [params.event_source]
 * @returns {Promise<boolean>}
 */
export async function connections_list_set_graph_component(params = {}) {
  const collection = this.collection;
  const graph_component_key = params.graph_component_key;
  const setting_key = params.footer ? 'footer_connections_graph_component_key' : 'connections_graph_component_key';
  const options = collection.get_connections_graph_component_options();

  if (
    !options.some((option) => option.value === graph_component_key)
    || graph_component_key === collection.settings[setting_key]
  ) return false;

  const event_source = params.event_source || 'connections_list_set_graph_component';
  collection.settings[setting_key] = graph_component_key;
  await collection.env?.smart_settings?.save?.();
  await params.render_connections?.({
    connections_item: this.item,
    force: true,
    event_source,
  });
  return true;
}

export const display_name = 'Set graph style';

const graph_menu = {
  title: 'Graph style',
  icon: 'network',
  order: 70,
  build() {
    const collection = this.scope.collection;
    const options = collection.get_connections_graph_component_options();
    const setting_key = this.params.footer ? 'footer_connections_graph_component_key' : 'connections_graph_component_key';
    const requested_key = collection.settings[setting_key] ?? (this.params.footer ? 'none' : 'connections_graph_v1');
    const current_key = options.some((option) => option.value === requested_key)
      ? requested_key
      : 'connections_graph_v1';

    this.menu.addItem((item) => {
      item
        .setTitle('Graph style')
        .setIcon('network')
      ;
      const submenu = item.setSubmenu();
      options.forEach((option) => {
        submenu.addItem((sub_item) => {
          sub_item
            .setTitle(option.name)
            .setChecked(option.value === current_key)
            .onClick(() => this.run({ graph_component_key: option.value }))
          ;
        });
      });
    });
  },
};

export const menus = {
  'connections:settings_menu': graph_menu,
  'connections:graph_menu': graph_menu,
};
