/**
 * Builds a prefixed connection key when needed.
 * @param {string} collection_key
 * @param {string} item_key
 * @returns {string}
 */
export function build_prefixed_connection_key(collection_key, item_key) {
  if (typeof item_key !== 'string' || !item_key.length) return item_key;
  if (item_key.includes(':')) return item_key;
  if (typeof collection_key !== 'string' || !collection_key.length) return item_key;
  return `${collection_key}:${item_key}`;
}

/**
 * Applies the hidden flag to a connection entry.
 * @param {Record<string, Record<string, number>>} connections
 * @param {string} prefixed_key
 * @param {number} [hidden_at]
 * @returns {Record<string, Record<string, number>>}
 */
export function apply_hidden_state(connections, prefixed_key, hidden_at = Date.now()) {
  if (!connections || typeof connections !== 'object') return connections;
  if (typeof prefixed_key !== 'string' || !prefixed_key.length) return connections;
  const state = connections[prefixed_key] || {};
  state.hidden = hidden_at;
  connections[prefixed_key] = state;
  return connections;
}

/**
 * Applies the pinned flag to a connection entry.
 * @param {Record<string, Record<string, number>>} connections
 * @param {string} prefixed_key
 * @param {number} [pinned_at]
 * @returns {Record<string, Record<string, number>>}
 */
export function apply_pinned_state(connections, prefixed_key, pinned_at = Date.now()) {
  if (!connections || typeof connections !== 'object') return connections;
  if (typeof prefixed_key !== 'string' || !prefixed_key.length) return connections;
  const state = connections[prefixed_key] || {};
  state.pinned = pinned_at;
  connections[prefixed_key] = state;
  return connections;
}

/**
 * Removes the hidden flag from a connection entry.
 * @param {Record<string, Record<string, number>>} connections
 * @param {string} prefixed_key
 * @returns {Record<string, Record<string, number>>}
 */
export function remove_hidden_state(connections, prefixed_key) {
  if (!connections || typeof connections !== 'object') return connections;
  if (typeof prefixed_key !== 'string' || !prefixed_key.length) return connections;
  const state = connections[prefixed_key];
  if (!state || typeof state !== 'object') return connections;
  delete state.hidden;
  if (!Object.keys(state).length) delete connections[prefixed_key];
  return connections;
}

/**
 * Removes the pinned flag from a connection entry.
 * @param {Record<string, Record<string, number>>} connections
 * @param {string} prefixed_key
 * @returns {Record<string, Record<string, number>>}
 */
export function remove_pinned_state(connections, prefixed_key) {
  if (!connections || typeof connections !== 'object') return connections;
  if (typeof prefixed_key !== 'string' || !prefixed_key.length) return connections;
  const state = connections[prefixed_key];
  if (!state || typeof state !== 'object') return connections;
  delete state.pinned;
  if (!Object.keys(state).length) delete connections[prefixed_key];
  return connections;
}

/**
 * Removes hidden flags from all connection entries.
 * @param {Record<string, Record<string, number>>} connections
 * @returns {boolean} true when at least one hidden flag removed
 */
export function remove_all_hidden_states(connections) {
  if (!connections || typeof connections !== 'object') return false;
  let changed = false;
  Object.entries(connections).forEach(([key, state]) => {
    if (!state || typeof state !== 'object') return;
    if (state.hidden === undefined || state.hidden === null) return;
    delete state.hidden;
    if (!Object.keys(state).length) delete connections[key];
    changed = true;
  });
  return changed;
}

/**
 * Removes pinned flags from all connection entries.
 * @param {Record<string, Record<string, number>>} connections
 * @returns {boolean} true when at least one pinned flag removed
 */
export function remove_all_pinned_states(connections) {
  if (!connections || typeof connections !== 'object') return false;
  let changed = false;
  Object.entries(connections).forEach(([key, state]) => {
    if (!state || typeof state !== 'object') return;
    if (state.pinned === undefined || state.pinned === null) return;
    delete state.pinned;
    if (!Object.keys(state).length) delete connections[key];
    changed = true;
  });
  return changed;
}

/**
 * Counts the number of connections with hidden flags.
 * @param {Record<string, Record<string, number>>} connections
 * @returns {number}
 */
export function count_hidden_connections(connections) {
  if (!connections || typeof connections !== 'object') return 0;
  return Object.values(connections).reduce((count, state) => {
    if (state && typeof state === 'object' && state.hidden !== undefined && state.hidden !== null) {
      return count + 1;
    }
    return count;
  }, 0);
}

/**
 * Counts the number of connections with pinned flags.
 * @param {Record<string, Record<string, number>>} connections
 * @returns {number}
 */
export function count_pinned_connections(connections) {
  if (!connections || typeof connections !== 'object') return 0;
  return Object.values(connections).reduce((count, state) => {
    if (state && typeof state === 'object' && state.pinned !== undefined && state.pinned !== null) {
      return count + 1;
    }
    return count;
  }, 0);
}

/**
 * Determines whether a connection entry is pinned.
 * @param {Record<string, Record<string, number>>} connections
 * @param {string} prefixed_key
 * @returns {boolean}
 */
export function is_connection_pinned(connections, prefixed_key) {
  if (!connections || typeof connections !== 'object') return false;
  if (typeof prefixed_key !== 'string' || !prefixed_key.length) return false;
  const state = connections[prefixed_key];
  if (!state || typeof state !== 'object') return false;
  return state.pinned !== undefined && state.pinned !== null;
}

/**
 * Determines whether a connection entry is hidden.
 * @param {Record<string, Record<string, number>>} connections
 * @param {string} prefixed_key
 * @returns {boolean}
 */
export function is_connection_hidden(connections, prefixed_key) {
  if (!connections || typeof connections !== 'object') return false;
  if (typeof prefixed_key !== 'string' || !prefixed_key.length) return false;
  const state = connections[prefixed_key];
  if (!state || typeof state !== 'object') return false;
  return state.hidden !== undefined && state.hidden !== null;
}
