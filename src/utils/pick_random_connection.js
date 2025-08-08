/**
 * Picks a random connection weighted by score.
 * @param {Array<{item:Object, score:number}>} connections - Connection results.
 * @param {Function} [rng=Math.random] - Random number generator.
 * @returns {Object|null} Randomly selected connection or null.
 */
export function pick_random_connection(connections, rng = Math.random) {
  if (!Array.isArray(connections) || connections.length === 0) return null;
  const total_score = connections.reduce((sum, { score }) => sum + Math.max(0, score), 0);
  if (total_score === 0) return connections[0] || null;
  const threshold = rng() * total_score;
  let cumulative = 0;
  for (const connection of connections) {
    cumulative += Math.max(0, connection.score);
    if (threshold < cumulative) return connection;
  }
  return connections.at(-1) || null;
}
