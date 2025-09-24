import { promises as fs } from 'fs';
import { join } from 'path';

export class SmartCacheManager {
  private lastModifiedTimes: Map<string, number> = new Map();
  private ttlSeconds: number = 30;

  constructor(ttlSeconds: number = 30) {
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Check if Smart Connections data should be reloaded
   */
  async shouldReload(vaultPath: string): Promise<boolean> {
    const smartEnvPath = join(vaultPath, '.smart-env');

    try {
      // Check modification times of key Smart Connections files
      const sourcesPath = join(smartEnvPath, 'multi', 'smart_sources');
      const blocksPath = join(smartEnvPath, 'multi', 'smart_blocks');

      const [sourcesStat, blocksStat] = await Promise.all([
        fs.stat(sourcesPath).catch(() => null),
        fs.stat(blocksPath).catch(() => null),
      ]);

      const lastCheck = this.lastModifiedTimes.get(vaultPath) || 0;
      const now = Date.now();

      // Check if files have been modified since last check
      if (sourcesStat && sourcesStat.mtimeMs > lastCheck) {
        return true;
      }

      if (blocksStat && blocksStat.mtimeMs > lastCheck) {
        return true;
      }

      // Fallback to TTL if we can't check file times
      if (now - lastCheck > this.ttlSeconds * 1000) {
        return true;
      }

      return false;
    } catch (error) {
      // If we can't check files, use TTL fallback
      const lastCheck = this.lastModifiedTimes.get(vaultPath) || 0;
      return Date.now() - lastCheck > this.ttlSeconds * 1000;
    }
  }

  /**
   * Update cache timestamp for vault
   */
  updateCache(vaultPath: string): void {
    this.lastModifiedTimes.set(vaultPath, Date.now());
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(vaultPath: string) {
    const lastCheck = this.lastModifiedTimes.get(vaultPath) || 0;
    return {
      last_loaded: lastCheck,
      cache_age_seconds: (Date.now() - lastCheck) / 1000,
      vault_path: vaultPath,
    };
  }
}