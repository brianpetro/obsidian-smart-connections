const HISTORY_LIMIT = 10;

/**
 * Return selectable recent Connections targets.
 *
 * This synchronous query keeps one target-provider module independently
 * includable while child selection delegates to the shared semantic action.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.view]
 * @returns {Array<object>}
 */
export function connections_target_history(params = {}) {
  const history = Array.isArray(params.view?.connections_target_history)
    ? params.view.connections_target_history
    : []
  ;

  return history
    .slice(0, HISTORY_LIMIT)
    .map((key) => this.env.smart_sources?.get?.(key) || this.env.smart_sources?.items?.[key])
    .filter(Boolean)
  ;
}

export const menus = {
  'connections:target_menu': {
    title: 'History',
    icon: 'history',
    order: 10,
    build() {
      const sources = resolve_target_candidates(this);

      this.menu.addItem((item) => {
        item
          .setTitle('History')
          .setIcon('history')
        ;

        const submenu = item.setSubmenu();
        item.setDisabled?.(!sources.length);

        sources.forEach((source) => {
          submenu.addItem((sub_item) => {
            sub_item
              .setTitle(source.key)
              .setIcon('file-text')
              .onClick(async () => {
                return await run_select_target(this, source);
              })
            ;
          });
        });
      });
    },
  },
};

function resolve_target_candidates(menu_ctx) {
  const action = menu_ctx.resolve_action?.();
  if (typeof action !== 'function') return [];

  const candidates = action(menu_ctx.params);
  return Array.isArray(candidates) ? candidates : [];
}

async function run_select_target(menu_ctx, target_item) {
  const action = menu_ctx.scope?.actions?.connections_list_select_target;
  if (typeof action !== 'function') return false;

  return await action({
    target_item,
    view: menu_ctx.params?.view,
    event_source: menu_ctx.event_source,
  });
}
