/**
 * Select and render a Connections target in the current view.
 *
 * The view is an intentional host-surface target. Keeping this host-specific
 * effect in one action makes it independently replaceable without requiring a
 * controller abstraction.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.target_item]
 * @param {object} [params.view]
 * @param {string} [params.event_source]
 * @returns {Promise<boolean>}
 */
export async function connections_list_select_target(params = {}) {
  const target_item = params.target_item;
  const view = params.view;

  if (!target_item || typeof view?.render_view !== 'function') return false;

  view.paused = true;
  await view.render_view({
    connections_item: target_item,
    event_source: params.event_source || 'connections_list_select_target',
    force: true,
  });
  return true;
}

export const display_name = 'Select Connections target';

export const menus = {
  'connections:list_menu': {
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
        this.env.build_menu?.('connections:target_menu', submenu, this.scope, this.params);
        item.setDisabled?.(!(submenu.items?.length > 0));
      });
    },
  },
};
