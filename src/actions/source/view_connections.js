import { ConnectionsItemView } from '../../views/connections_item_view.js';

/**
 * Open the Connections view focused on this source or block item.
 *
 * @this {object}
 * @param {object} [params={}]
 * @returns {Promise<boolean>}
 */
export async function source_view_connections(params = {}) {
  const source_item = params.source_item || params.target_item || this;
  const env = source_item?.env || this?.env;
  const workspace = params.workspace
    || env?.obsidian_app?.workspace
    || env?.plugin?.app?.workspace
    || env?.smart_connections_plugin?.app?.workspace
    || globalThis.app?.workspace
  ;

  if (!source_item?.key || !workspace) return false;

  const event_source = params.event_source || 'source_view_connections';
  const view = await get_or_open_connections_view(workspace);
  if (view) {
    await render_connections_view(view, source_item, { event_source });
    return true;
  }

  env?.events?.emit?.('connections:show', {
    collection_key: source_item.collection_key,
    item_key: source_item.key,
    event_source,
  });
  return true;
}

async function get_or_open_connections_view(workspace) {
  const existing_view = ConnectionsItemView.get_view?.(workspace);
  if (existing_view) {
    await reveal_connections_leaf(workspace, existing_view.leaf);
    return existing_view;
  }

  const existing_leaf = ConnectionsItemView.get_leaf?.(workspace);
  if (existing_leaf) {
    await reveal_connections_leaf(workspace, existing_leaf);
    return ConnectionsItemView.get_view?.(workspace) || existing_leaf.view || null;
  }

  const opened = await ConnectionsItemView.open?.(workspace, { active: true });

  const opened_view = ConnectionsItemView.get_view?.(workspace) || opened || null;
  const opened_leaf = ConnectionsItemView.get_leaf?.(workspace) || opened_view?.leaf;
  await reveal_connections_leaf(workspace, opened_leaf);
  return opened_view || opened_leaf?.view || null;
}

async function reveal_connections_leaf(workspace, leaf) {
  if (!workspace || !leaf) return false;

  expand_leaf_ancestors(leaf);

  if (typeof workspace.revealLeaf === 'function') {
    await workspace.revealLeaf(leaf);
    return true;
  }

  if (typeof workspace.setActiveLeaf === 'function') {
    workspace.setActiveLeaf(leaf, { focus: true });
    return true;
  }

  return false;
}

function expand_leaf_ancestors(leaf) {
  let parent = leaf?.parent;
  while (parent) {
    parent.setCollapsed?.(false);
    parent.expand?.();
    parent = parent.parent;
  }
}

async function render_connections_view(view, source_item, params = {}) {
  view.paused = true;
  view.pause_controls?.update?.(true);
  await view.render_view?.({
    connections_item: source_item,
    force: true,
    event_source: params.event_source || 'source_view_connections',
  });
}

export const menus = {
  'source:menu': {
    title: 'View connections',
    icon: 'smart-connections',
    order: 20,
    disabled() {
      return !this.scope?.key || !this.env?.connections_lists;
    },
  },
};


