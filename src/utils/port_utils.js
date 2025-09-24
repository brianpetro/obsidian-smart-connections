/**
 * Port allocation utilities for MCP server
 */

import { createServer } from 'net';

/**
 * Check if a port is available for use
 * @param {number} port - Port number to check
 * @param {string} host - Host to check (default: 'localhost')
 * @returns {Promise<boolean>} - True if port is available
 */
export function isPortAvailable(port, host = 'localhost') {
  return new Promise((resolve) => {
    const server = createServer();

    server.listen(port, host, () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find an available port in the specified range
 * @param {number} startPort - Starting port to check (default: 8000)
 * @param {number} endPort - Ending port to check (default: 9999)
 * @param {string} host - Host to check (default: 'localhost')
 * @returns {Promise<number>} - Available port number
 * @throws {Error} - If no available port is found in range
 */
export async function findAvailablePort(startPort = 8000, endPort = 9999, host = 'localhost') {
  for (let port = startPort; port <= endPort; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }

  throw new Error(`No available port found in range ${startPort}-${endPort}`);
}

/**
 * Get a random port in the higher range to start searching from
 * This helps distribute port usage across the range
 * @param {number} startPort - Starting port of range (default: 8000)
 * @param {number} endPort - Ending port of range (default: 9999)
 * @returns {number} - Random port in range
 */
export function getRandomStartPort(startPort = 8000, endPort = 9999) {
  return Math.floor(Math.random() * (endPort - startPort + 1)) + startPort;
}

/**
 * Find an available port starting from a random position in the range
 * This helps avoid port conflicts when multiple instances start simultaneously
 * @param {number} startPort - Starting port of range (default: 8000)
 * @param {number} endPort - Ending port of range (default: 9999)
 * @param {string} host - Host to check (default: 'localhost')
 * @returns {Promise<number>} - Available port number
 */
export async function findAvailablePortRandom(startPort = 8000, endPort = 9999, host = 'localhost') {
  const randomStart = getRandomStartPort(startPort, endPort);

  // Try from random start to end of range
  for (let port = randomStart; port <= endPort; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }

  // Try from beginning of range to random start
  for (let port = startPort; port < randomStart; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }

  throw new Error(`No available port found in range ${startPort}-${endPort}`);
}