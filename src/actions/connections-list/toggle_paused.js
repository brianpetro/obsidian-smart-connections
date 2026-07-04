/**
 * Toggle Connections auto-refresh for the current view.
 * When resuming, refresh the view target to the current active note.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.view]
 * @returns {Promise<boolean>}
 */
export async function connections_list_toggle_paused(params = {}) {
  const view = params.view;
  if (!view) return false;

  const next_paused = apply_view_pause_state(view, !view.paused);

  if (!next_paused) {
    await refresh_target_to_active_note(this, params);
  }

  return true;
}

export function apply_view_pause_state(view, paused) {
  if (!view) return false;
  const value = Boolean(paused);
  view.paused = value;
  view.pause_controls?.update?.(value);
  return value;
}

async function refresh_target_to_active_note(connections_list, params = {}) {
  const view = params.view;
  if (typeof view?.render_view !== 'function') return false;

  const env = connections_list?.env || view.env;
  const active_file = view.plugin?.app?.workspace?.getActiveFile?.()
    || env?.obsidian_app?.workspace?.getActiveFile?.()
  ;
  if (!active_file?.path) return false;

  const active_item = env?.smart_sources?.get?.(active_file.path)
    || env?.smart_sources?.items?.[active_file.path]
  ;
  if (!active_item) return false;

  await view.render_view({
    connections_item: active_item,
    force: true,
    event_source: params.event_source || 'connections_list_toggle_paused',
  });
  return true;
}

export const menus = {
  'connections:list_menu': {
    title() {
      return this.params?.view?.paused ? 'Resume auto-refresh' : 'Pause auto-refresh';
    },
    icon() {
      return this.params?.view?.paused ? 'play-circle' : 'pause-circle';
    },
    order: 0,
    when() {
      return Boolean(this.params?.view);
    },
  },
};


