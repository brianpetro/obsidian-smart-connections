/**
 * Returns a random connection for a given file path.
 * @param {Object} env - Smart environment instance.
 * @param {string} file_path - Path of the current file.
 * @param {Object} [options] - Optional settings.
 * @param {Function} [options.rng=Math.random] - Random number generator.
 * @returns {Promise<Object|null>} Random connection or null if unavailable.
 */
export async function get_random_connection(env, file_path, { rng = Math.random } = {}) {
  if (!env?.smart_sources || !file_path) return null;
  const entity = env.smart_sources.get(file_path);
  if (!entity?.should_embed) return null;
  const connections = await entity.find_connections({
    filter: { limit: 20 }
  });
  if (!Array.isArray(connections) || connections.length === 0) return null;
  const total_score = connections.reduce((sum, { score }) => sum + Math.max(0, score), 0);
  if (total_score === 0) return connections[0];
  const threshold = rng() * total_score;
  let cumulative = 0;
  for (const connection of connections) {
    cumulative += Math.max(0, connection.score);
    if (threshold < cumulative) return connection;
  }
  return connections.at(-1);
}
