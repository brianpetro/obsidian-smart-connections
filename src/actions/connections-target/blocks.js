import { get_block_display_name } from 'obsidian-smart-env/src/utils/get_block_display_name.js';

/**
 * Return selectable blocks from the current Connections source.
 *
 * This synchronous query keeps one target-provider module independently
 * includable while child selection delegates to the shared semantic action.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @returns {Array<object>}
 */
export function connections_target_blocks() {
  const current_key = this.item?.key || '';
  const source_key = current_key.split('#')[0];
  const source = this.env.smart_sources?.get?.(source_key)
    || this.env.smart_sources?.items?.[source_key]
  ;
  const blocks = Array.isArray(source?.blocks) ? [...source.blocks] : [];

  return blocks.sort((left, right) => {
    const left_line = get_block_first_line(left);
    const right_line = get_block_first_line(right);
    if (left_line !== right_line) return left_line - right_line;
    return String(left?.key || '').localeCompare(String(right?.key || ''));
  });
}

export const menus = {
  'connections:target_menu': {
    title: 'Blocks',
    icon: 'blocks',
    order: 20,
    build() {
      const blocks = resolve_target_candidates(this);

      this.menu.addItem((item) => {
        item
          .setTitle('Blocks')
          .setIcon('blocks')
        ;

        const submenu = item.setSubmenu();
        item.setDisabled?.(!blocks.length);

        blocks.forEach((block) => {
          submenu.addItem((sub_item) => {
            sub_item
              .setTitle(get_block_title(block))
              .setDisabled(!block?.vec)
              .onClick(async () => {
                return await run_select_target(this, block);
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

function get_block_first_line(block) {
  return Array.isArray(block?.lines) && Number.isFinite(block.lines[0])
    ? block.lines[0]
    : Number.POSITIVE_INFINITY
  ;
}

function get_block_title(block) {
  return get_block_display_name(block, { show_full_path: false })
    || block?.key
    || 'Block'
  ;
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
