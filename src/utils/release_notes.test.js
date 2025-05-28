import test from 'ava';
import {
  get_last_known_version,
  set_last_known_version,
  should_show_release_notes
} from './release_notes.js';

function create_storage() {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
}

test.beforeEach(() => {
  global.localStorage = create_storage();
});

test('set and get last known version', (t) => {
  set_last_known_version('1.0.0');
  t.is(get_last_known_version(), '1.0.0');
});

test('should_show_release_notes detects upgrade', (t) => {
  set_last_known_version('1.0.0');
  t.true(should_show_release_notes('1.1.0'));
});

test('should_show_release_notes ignores same version', (t) => {
  set_last_known_version('1.0.0');
  t.false(should_show_release_notes('1.0.0'));
});
