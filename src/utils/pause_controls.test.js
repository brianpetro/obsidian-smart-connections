import test from 'ava';

import { apply_pause_state, toggle_pause_state } from './pause_controls.js';

test('apply_pause_state coerces value to boolean', t => {
  const context = { paused: false, pause_controls: { update: () => {} } };
  const result = apply_pause_state(context, 'yes');
  t.true(result);
  t.true(context.paused);
});

test('apply_pause_state notifies controls when available', t => {
  let updated_value = null;
  const context = {
    paused: false,
    pause_controls: { update: value => { updated_value = value; } }
  };
  apply_pause_state(context, false);
  t.false(updated_value);
});

test('toggle_pause_state flips state and notifies controls', t => {
  let last_value = null;
  const context = {
    paused: false,
    pause_controls: { update: value => { last_value = value; } }
  };
  const first = toggle_pause_state(context);
  t.true(first);
  t.true(context.paused);
  t.true(last_value);
  const second = toggle_pause_state(context);
  t.false(second);
  t.false(context.paused);
  t.false(last_value);
});
