const DEFAULT_RESULTS_LIMIT = 20;

/**
 * Returns a random connection for a given file path.
 * @param {Object} env - Smart environment instance.
 * @param {string} file_path - Path of the current file.
 * @param {Object} [opts]
 * @param {Function} [opts.rng=Math.random]
 * @returns {Promise<Object|null>}
 */
export async function get_random_connection(env, file_path, { rng = Math.random } = {}) {
  if (!env?.smart_sources || !file_path) return null;
  const source = env.smart_sources.get(file_path);
  if (!source?.should_embed) return null;

  const connections = await source.connections.get_results({ limit: DEFAULT_RESULTS_LIMIT });
  if (!Array.isArray(connections) || connections.length === 0) return null;

  return pick_weighted_connection(connections, { rng });
}

function pick_weighted_connection(connections, { rng }) {
  const scored_connections = connections.map(connection => ({
    connection,
    score: Math.max(0, typeof connection?.score === 'number' ? connection.score : 0),
  }));
  const total_score = scored_connections.reduce((sum, { score }) => sum + score, 0);
  if (total_score === 0) return connections[0];

  const threshold = rng() * total_score;
  let cumulative = 0;
  for (const { connection, score } of scored_connections) {
    cumulative += score;
    if (threshold < cumulative) return connection;
  }
  return connections.at(-1);
}