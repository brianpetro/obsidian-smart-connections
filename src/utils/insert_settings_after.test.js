import test from 'ava';
import { insert_settings_after } from './insert_settings_after.js';

test('insert_settings_after merges entries after anchor key', t => {
  const config = { a: 1, b: 2, c: 3 };
  const merged = insert_settings_after('b', config, { x: 9, y: 8 });
  t.deepEqual(Object.keys(merged), ['a', 'b', 'x', 'y', 'c']);
  t.is(merged.x, 9);
  t.is(merged.y, 8);
});