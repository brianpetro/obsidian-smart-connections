/**
 * Menu-only action for rendering `connections:target_menu` as a submenu inside
 * `connections:list_menu`.
 *
 * @returns {boolean}
 */
export function connections_list_target_menu() {
  return false;
}

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
