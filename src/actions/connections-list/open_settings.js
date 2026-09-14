/**
 * Open Smart Connections settings.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @returns {Promise<boolean>}
 */
export async function connections_list_open_settings() {
  const plugin = this.env?.smart_connections_plugin || this.env?.plugin || this.env?.main;
  const app = plugin?.app || this.env?.obsidian_app;
  if (!app?.setting) return false;

  await app.setting.open?.();
  await app.setting.openTabById?.(plugin?.manifest?.id || 'smart-connections');
  return true;
}

export const menus = {
  'connections:list_menu': {
    title: 'Settings',
    icon: 'settings',
    order: 90,
    build() {
      this.menu.addItem((item) => {
        item
          .setTitle('Settings')
          .setIcon('settings')
        ;
        this.env.build_menu(
          'connections:settings_menu',
          item.setSubmenu(),
          this.scope,
          this.params,
        );
      });
    },
  },
  'connections:settings_menu': {
    title: 'All Connections settings',
    icon: 'settings',
    order: 90,
  },
};
