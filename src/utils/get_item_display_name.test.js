import test from 'ava';

import {
  get_item_display_name,
} from './get_item_display_name.js';

test('get_item_display_name respects show_full_path toggle', t => {
  const result = {item: { key: 'Folder/Note.md' }};
  const with_path = get_item_display_name(result.item, {});
  const without_path = get_item_display_name(result.item, { show_full_path: false });

  t.is(with_path, 'Folder › Note.md');
  t.is(without_path, 'Note.md');

  const block_result = {item: { key: 'Folder/Sub/Block.md#heading1#h3' }};
  const block_with_path = get_item_display_name(block_result.item, {});
  const block_without_path = get_item_display_name(block_result.item, { show_full_path: false });

  t.is(block_with_path, 'Folder › Sub › Block.md › heading1 › h3');
  t.is(block_without_path, 'Block.md › h3');
});
