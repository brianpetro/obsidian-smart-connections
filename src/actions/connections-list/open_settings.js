/**
 * Open Smart Connections settings.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.view]
 * @returns {Promise<boolean>}
 */
export async function connections_list_open_settings(params = {}) {
  if (typeof params.view?.open_settings === 'function') {
    await params.view.open_settings();
    return true;
  }

  const plugin = this.env?.smart_connections_plugin || this.env?.plugin || this.env?.main;
  const app = plugin?.app || this.env?.obsidian_app;
  if (!app?.setting) return false;

  await app.setting.open?.();
  await app.setting.openTabById?.(plugin?.manifest?.id || 'smart-connections');
  return true;
}

export const menus = {
  'connections:list_menu': {
    title: 'Connections settings',
    icon: 'settings',
    order: 90,
  },
};
