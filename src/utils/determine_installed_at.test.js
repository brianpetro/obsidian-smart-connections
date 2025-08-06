import test from 'ava';
import { determine_installed_at } from './determine_installed_at.js';

test('returns current when data file time is null', t => {
  t.is(determine_installed_at(1000, null), 1000);
});

test('returns data file time when current missing', t => {
  t.is(determine_installed_at(null, 500), 500);
});

test('returns earliest time', t => {
  t.is(determine_installed_at(1000, 500), 500);
  t.is(determine_installed_at(500, 1000), 500);
});
