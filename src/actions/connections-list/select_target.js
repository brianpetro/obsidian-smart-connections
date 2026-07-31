/**
 * Select and render a Connections target in the current item view.
 *
 * @this {import('../../views/connections_item_view.js').ConnectionsItemView}
 * @param {object} [params={}]
 * @param {object} [params.target_item]
 * @param {string} [params.event_source]
 * @returns {Promise<boolean>}
 */
export async function connections_list_select_target(params = {}) {
  const target_item = params.target_item;

  if (!target_item || !this?.select_target) return false;

  return await this.select_target(target_item, {
    event_source: params.event_source || 'connections_list_select_target',
  });
}

export const display_name = 'Select Connections target';

export const menus = {
  'connections:item_view_list_menu': {
    title: 'Change target',
    icon: 'crosshair',
    order: 15,
    build() {
      this.menu.addItem((item) => {
        item
          .setTitle('Change target')
          .setIcon('crosshair')
        ;

        const submenu = item.setSubmenu();
        this.env.build_menu?.('connections:target_menu', submenu, this.scope);
        item.setDisabled?.(!(submenu.items?.length > 0));
      });
    },
  },
};
