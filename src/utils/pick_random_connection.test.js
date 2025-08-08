import test from 'ava';
import { pick_random_connection } from './pick_random_connection.js';

test('returns null when no connections', t => {
  t.is(pick_random_connection([]), null);
});

test('weights selection by score using provided rng', t => {
  const connections = [
    { item: { path: 'a' }, score: 2 },
    { item: { path: 'b' }, score: 1 }
  ];
  const rngA = () => 0.1; // threshold 0.3 -> selects 'a'
  t.is(pick_random_connection(connections, rngA).item.path, 'a');

  const rngB = () => 0.9; // threshold 2.7 -> selects 'b'
  t.is(pick_random_connection(connections, rngB).item.path, 'b');
});
