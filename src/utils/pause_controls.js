/**
 * Apply a paused state to a target and notify any registered controls.
 * @param {{ paused: boolean, pause_controls?: { update?: (value: boolean) => void } }} target
 * @param {boolean} paused
 * @returns {boolean}
 */
export function apply_pause_state(target, paused) {
  const value = Boolean(paused);
  target.paused = value;
  target.pause_controls?.update?.(value);
  return value;
}

/**
 * Toggle the paused state and notify controls.
 * @param {{ paused: boolean, pause_controls?: { update?: (value: boolean) => void } }} target
 * @returns {boolean}
 */
export function toggle_pause_state(target) {
  const next = !target.paused;
  target.paused = next;
  target.pause_controls?.update?.(next);
  return next;
}
