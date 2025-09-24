import { SmartEnvAdapter } from '../smart-env/smart-env-adapter.js';
import { cos_sim } from 'smart-utils';
import { get_nearest_until_next_dev_exceeds_std_dev } from 'smart-utils';

export class SmartConnectionsLookup {
  private envAdapter: SmartEnvAdapter;

  constructor(envAdapter: SmartEnvAdapter) {
    this.envAdapter = envAdapter;
  }

  /**
   * Perform lookup using Smart Connections' exact lookup method
   */
  async lookup(params: {
    hypotheticals: string[];
    filter?: {
      limit?: number;
      key_starts_with?: string;
      key_starts_with_any?: string[];
    };
  }) {
    const { hypotheticals, filter = {} } = params;

    if (!this.envAdapter.isReady()) {
      throw new Error('SmartEnv not initialized');
    }

    try {
      // Use Smart Connections' exact lookup method
      const collection = this.envAdapter.smartSources;
      const results = await collection.lookup({
        hypotheticals,
        ...filter
      });

      // Apply statistical filtering using their exact algorithm
      const filteredResults = get_nearest_until_next_dev_exceeds_std_dev(results);

      // Apply limit if specified
      const limit = filter.limit || 10;
      return filteredResults.slice(0, limit);
    } catch (error) {
      console.error('Lookup error:', error);
      throw new Error(`Smart Connections lookup failed: ${error}`);
    }
  }

  /**
   * Calculate cosine similarity using Smart Connections' exact function
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    return cos_sim(vecA, vecB);
  }

  /**
   * Search both sources and blocks collections
   */
  async searchAll(params: {
    hypotheticals: string[];
    filter?: {
      limit?: number;
      key_starts_with?: string;
      key_starts_with_any?: string[];
    };
  }) {
    const { hypotheticals, filter = {} } = params;

    if (!this.envAdapter.isReady()) {
      throw new Error('SmartEnv not initialized');
    }

    try {
      // Search sources and blocks in parallel
      const [sourcesResults, blocksResults] = await Promise.all([
        this.lookupInCollection(this.envAdapter.smartSources, { hypotheticals, filter }),
        this.lookupInCollection(this.envAdapter.smartBlocks, { hypotheticals, filter })
      ]);

      // Combine results
      const allResults = [...sourcesResults, ...blocksResults];

      // Apply statistical filtering to combined results
      const filteredResults = get_nearest_until_next_dev_exceeds_std_dev(allResults);

      // Apply limit
      const limit = filter.limit || 10;
      return filteredResults.slice(0, limit);
    } catch (error) {
      console.error('Search all error:', error);
      throw new Error(`Smart Connections search failed: ${error}`);
    }
  }

  /**
   * Helper method to lookup in a specific collection
   */
  private async lookupInCollection(collection: any, params: any) {
    if (!collection || !collection.lookup) {
      return [];
    }

    try {
      return await collection.lookup(params);
    } catch (error) {
      console.warn('Collection lookup failed:', error);
      return [];
    }
  }
}

export const SMART_CONNECTIONS_LOOKUP_TOOL = {
  name: "smart_connections_lookup",
  description: "Search Smart Connections vector database using exact same algorithms",
  inputSchema: {
    type: "object",
    properties: {
      hypotheticals: {
        type: "array",
        items: { type: "string" },
        description: "Hypothetical relevant content (minimum 2 required)",
        minItems: 2
      },
      vault_path: {
        type: "string",
        description: "Path to Obsidian vault containing .smart-env/"
      },
      filter: {
        type: "object",
        properties: {
          limit: { type: "number", default: 10, maximum: 50 },
          key_starts_with: { type: "string" },
          key_starts_with_any: { type: "array", items: { type: "string" } }
        }
      },
      search_both: {
        type: "boolean",
        default: true,
        description: "Search both sources and blocks collections"
      }
    },
    required: ["hypotheticals", "vault_path"]
  }
};