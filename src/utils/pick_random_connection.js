/**
 * Picks a random connection favoring higher scores.
 * @param {Array<{item:Object, score:number}>} connections - Connection results.
 * @param {Function} [rng=Math.random] - Random number generator.
 * @returns {Object|null} Randomly selected connection or null.
 */
export function pick_random_connection(connections, rng = Math.random) {
  if (!Array.isArray(connections) || connections.length === 0) return null;
  const limit = Math.ceil(connections.length / 2);
  const index = Math.floor(rng() * limit);
  return connections[index] || null;
}
