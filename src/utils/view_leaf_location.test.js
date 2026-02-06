import test from 'ava';

import { get_leaf_location, is_descendant_of, should_relocate_leaf } from './view_leaf_location.js';

test('is_descendant_of returns true when node is nested under ancestor', t => {
  const ancestor = { parent: null };
  const child = { parent: ancestor };
  const grandchild = { parent: child };
  t.true(is_descendant_of(grandchild, ancestor));
});

test('get_leaf_location detects left and right leaf positions', t => {
  const left_split = { parent: null };
  const right_split = { parent: null };
  const left_leaf = { parent: { parent: left_split } };
  const right_leaf = { parent: { parent: right_split } };
  const workspace = { leftSplit: left_split, rightSplit: right_split };
  t.is(get_leaf_location({ workspace, leaf: left_leaf }), 'left');
  t.is(get_leaf_location({ workspace, leaf: right_leaf }), 'right');
});

test('should_relocate_leaf compares desired location with current leaf location', t => {
  const left_split = { parent: null };
  const right_split = { parent: null };
  const left_leaf = { parent: { parent: left_split } };
  const workspace = { leftSplit: left_split, rightSplit: right_split };
  t.false(should_relocate_leaf({ workspace, leaf: left_leaf, desired_location: 'left' }));
  t.true(should_relocate_leaf({ workspace, leaf: left_leaf, desired_location: 'right' }));
});
