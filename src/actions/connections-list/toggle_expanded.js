/**
 * Toggle all rendered Connections results between expanded and collapsed.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.connections_settings]
 * @param {HTMLElement} [params.container]
 * @param {boolean} [params.expanded]
 * @returns {boolean}
 */
export function connections_list_toggle_expanded(params = {}) {
  const connections_settings = params.connections_settings ?? this?.settings;
  const current_expanded = Boolean(connections_settings?.expanded_view);
  const expanded = typeof params.expanded === 'boolean'
    ? params.expanded
    : !current_expanded
  ;

  if (connections_settings) connections_settings.expanded_view = expanded;

  params.container?.querySelectorAll('.sc-result').forEach((element) => {
    expanded
      ? element.classList.remove('sc-collapsed')
      : element.classList.add('sc-collapsed')
    ;
  });

  return true;
}

export const menus = {
  'connections:list_menu': {
    title() {
      const connections_settings = this.params.connections_settings ?? this.scope?.settings;
      return connections_settings?.expanded_view ? 'Collapse all results' : 'Expand all results';
    },
    icon() {
      const connections_settings = this.params.connections_settings ?? this.scope?.settings;
      return connections_settings?.expanded_view ? 'fold-vertical' : 'unfold-vertical';
    },
    order: 10,
  },
};
