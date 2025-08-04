import test from 'ava';
import { pick_random_connection } from './pick_random_connection.js';

test('returns null when no connections', t => {
  t.is(pick_random_connection([]), null);
});

test('selects from top half using provided rng', t => {
  const connections = [
    { item: { path: 'a' }, score: 0.9 },
    { item: { path: 'b' }, score: 0.8 },
    { item: { path: 'c' }, score: 0.1 }
  ];
  const rng = () => 0.6;
  const result = pick_random_connection(connections, rng);
  t.is(result.item.path, 'b');
});
