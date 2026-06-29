import { get_block_display_name } from 'obsidian-smart-env/src/utils/get_block_display_name.js';

/**
 * Menu-only action for blocks in the current Connections source.
 *
 * @returns {boolean}
 */
export function connections_target_blocks() {
  return false;
}

export const menus = {
  'connections:target_menu': {
    title: 'Blocks',
    icon: 'blocks',
    order: 20,
    build() {
      const blocks = get_current_source_blocks(this);

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
                await select_connections_target(this, block, 'connections_target_blocks');
              })
            ;
          });
        });
      });
    },
  },
};

function get_current_source_blocks(menu_ctx) {
  const current_key = menu_ctx.scope?.item?.key || '';
  const source_key = current_key.split('#')[0];
  const source = menu_ctx.env.smart_sources?.get?.(source_key)
    || menu_ctx.env.smart_sources?.items?.[source_key]
  ;
  const blocks = Array.isArray(source?.blocks) ? [...source.blocks] : [];

  return blocks.sort((left, right) => {
    const left_line = get_block_first_line(left);
    const right_line = get_block_first_line(right);
    if (left_line !== right_line) return left_line - right_line;
    return String(left?.key || '').localeCompare(String(right?.key || ''));
  });
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
