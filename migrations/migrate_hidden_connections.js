const BLOCK_KEY_MARKER = '#';
const COLLECTION_SEPARATOR = ':';
const SOURCE_COLLECTION = 'smart_sources';
const BLOCK_COLLECTION = 'smart_blocks';

function is_plain_object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function select_hidden_entries(hidden_connections) {
  if (!is_plain_object(hidden_connections)) return [];
  return Object.entries(hidden_connections).filter(([, timestamp]) => timestamp !== undefined && timestamp !== null);
}

function get_collection_prefix(key) {
  return key.includes(BLOCK_KEY_MARKER) ? BLOCK_COLLECTION : SOURCE_COLLECTION;
}

function ensure_prefixed_key(key) {
  if (typeof key !== 'string') return key;
  if (key.includes(COLLECTION_SEPARATOR)) return key;
  return `${get_collection_prefix(key)}${COLLECTION_SEPARATOR}${key}`;
}

export function migrate_hidden_connections(source) {
  const hidden_entries = select_hidden_entries(source?.data?.hidden_connections);
  if (!hidden_entries.length) return false;

  if (!is_plain_object(source.data.connections)) {
    source.data.connections = {};
  }

  let migrated = false;

  hidden_entries.forEach(([key, timestamp]) => {
    const prefixed_key = ensure_prefixed_key(key);
    if (typeof prefixed_key !== 'string') return;
    const connection_state = source.data.connections[prefixed_key] || {};
    if (connection_state.hidden === undefined || connection_state.hidden === null) {
      connection_state.hidden = timestamp;
      migrated = true;
    }
    source.data.connections[prefixed_key] = connection_state;
  });

  if (migrated) {
    delete source.data.hidden_connections;
  }
  return migrated || hidden_entries.length > 0;
}

export default migrate_hidden_connections;
