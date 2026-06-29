const HISTORY_LIMIT = 10;

/**
 * Menu-only action for recent Connections targets.
 *
 * @returns {boolean}
 */
export function connections_target_history() {
  return false;
}

export const menus = {
  'connections:target_menu': {
    title: 'History',
    icon: 'history',
    order: 10,
    build() {
      const sources = get_history_sources(this);

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
                await select_connections_target(this, source, 'connections_target_history');
              })
            ;
          });
        });
      });
    },
  },
};

function get_history_sources(menu_ctx) {
  const history = Array.isArray(menu_ctx.params?.view?.connections_target_history)
    ? menu_ctx.params.view.connections_target_history
    : []
  ;

  return history
    .slice(0, HISTORY_LIMIT)
    .map((key) => menu_ctx.env.smart_sources?.get?.(key) || menu_ctx.env.smart_sources?.items?.[key])
    .filter(Boolean)
  ;
}

async function select_connections_target(menu_ctx, target_item, event_source) {
  const view = menu_ctx.params?.view;
  if (!target_item || typeof view?.render_view !== 'function') return false;

  view.paused = true;
  await view.render_view({
    connections_item: target_item,
    event_source,
    force: true,
  });
  return true;
}
