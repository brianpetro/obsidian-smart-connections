import { SmartEnv } from 'obsidian-smart-env';
import { AjsonMultiFileCollectionDataAdapter } from 'smart-collections/adapters/ajson_multi_file.js';

export class SmartEnvAdapter {
  private env: SmartEnv | null = null;
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  /**
   * Initialize Smart Connections environment using their exact libraries
   */
  async initialize(): Promise<void> {
    const smartEnvConfig = {
      env_path: this.vaultPath,
      env_data_dir: '.smart-env',
      collections: {
        smart_sources: {
          data_adapter: AjsonMultiFileCollectionDataAdapter,
        },
        smart_blocks: {
          data_adapter: AjsonMultiFileCollectionDataAdapter,
        }
      }
    };

    try {
      this.env = await SmartEnv.create(smartEnvConfig);
      console.log(`Smart Connections environment initialized for vault: ${this.vaultPath}`);
    } catch (error) {
      throw new Error(`Failed to initialize Smart Connections environment: ${error}`);
    }
  }

  /**
   * Get Smart Connections environment (direct access to their collections)
   */
  getEnv(): SmartEnv {
    if (!this.env) {
      throw new Error('SmartEnv not initialized. Call initialize() first.');
    }
    return this.env;
  }

  /**
   * Access smart_sources collection directly
   */
  get smartSources() {
    return this.getEnv().smart_sources;
  }

  /**
   * Access smart_blocks collection directly
   */
  get smartBlocks() {
    return this.getEnv().smart_blocks;
  }

  /**
   * Get collection stats
   */
  getStats() {
    if (!this.env) {
      return { error: 'Environment not initialized' };
    }

    const sourcesCount = this.smartSources ? Object.keys(this.smartSources.items || {}).length : 0;
    const blocksCount = this.smartBlocks ? Object.keys(this.smartBlocks.items || {}).length : 0;

    return {
      vault_path: this.vaultPath,
      sources_count: sourcesCount,
      blocks_count: blocksCount,
      total_items: sourcesCount + blocksCount,
      initialized: true,
    };
  }

  /**
   * Check if environment is initialized and ready
   */
  isReady(): boolean {
    return this.env !== null;
  }
}