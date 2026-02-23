import test from 'ava';
import { is_hover_preview_eligible, resolve_drag_item } from './v1.util.js';

test('resolve_drag_item returns null when node is missing', (t) => {
  t.is(resolve_drag_item(null), null);
  t.is(resolve_drag_item(undefined), null);
});

test('resolve_drag_item returns null when item is incomplete', (t) => {
  const base_item = { env: { obsidian_app: {} } };
  t.is(resolve_drag_item({ item: base_item }), null);
  t.is(resolve_drag_item({ item: { ...base_item, collection_key: 'smart_sources' } }), null);
  t.is(resolve_drag_item({ item: { ...base_item, key: 'note.md' } }), null);
  t.is(resolve_drag_item({ item: { collection_key: 'smart_sources', key: 'note.md' } }), null);
});

test('resolve_drag_item returns item when required fields exist', (t) => {
  const item = {
    collection_key: 'smart_sources',
    key: 'note.md',
    env: { obsidian_app: {} },
  };
  t.is(resolve_drag_item({ item }), item);
});

test('is_hover_preview_eligible returns false when node is missing or incomplete', (t) => {
  t.false(is_hover_preview_eligible());
  t.false(is_hover_preview_eligible(null));
  t.false(is_hover_preview_eligible({}));
  t.false(is_hover_preview_eligible({ item: {} }));
  t.false(is_hover_preview_eligible({ item: { collection_key: 'smart_sources' } }));
  t.false(is_hover_preview_eligible({ item: { key: 'note.md' } }));
});

test('is_hover_preview_eligible returns false for center nodes', (t) => {
  const item = { collection_key: 'smart_sources', key: 'note.md' };
  t.false(is_hover_preview_eligible({ item, isCenter: true }));
});

test('is_hover_preview_eligible returns true for non-center nodes with item keys', (t) => {
  const item = { collection_key: 'smart_sources', key: 'note.md' };
  t.true(is_hover_preview_eligible({ item }));
  t.true(is_hover_preview_eligible({ item, isCenter: false }));
});

test('is_hover_preview_eligible returns true for block keys', (t) => {
  const item = { collection_key: 'smart_blocks', key: 'note.md#h1{1}' };
  t.true(is_hover_preview_eligible({ item }));
});
