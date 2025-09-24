/**
 * Smart Connections Stats MCP Tool
 *
 * Provides information about plugin status, vault statistics, and environment state
 */

export class SmartConnectionsStatsTool {
  constructor(plugin) {
    this.plugin = plugin;
  }

  getToolDefinition() {
    return {
      name: "smart_connections_stats",
      description: "Get Smart Connections plugin statistics and status information",
      inputSchema: {
        type: "object",
        properties: {
          include_detailed_stats: {
            type: "boolean",
            default: false,
            description: "Include detailed collection statistics"
          }
        }
      }
    };
  }

  async execute(args) {
    const { include_detailed_stats = false } = args;

    try {
      const stats = {
        // Plugin status
        plugin_info: {
          version: this.plugin.manifest.version,
          name: this.plugin.manifest.name,
          loaded: true,
          env_ready: !!this.plugin.env,
        },

        // Vault information
        vault_info: {
          name: this.plugin.app.vault.getName(),
          path: typeof this.plugin.app.vault.adapter.path === 'string' ? this.plugin.app.vault.adapter.path : 'vault-path',
          file_count: this.plugin.app.vault.getAllLoadedFiles().length,
        },

        // Smart Connections environment
        environment: await this.getEnvironmentStats(include_detailed_stats),

        // MCP server status
        mcp_server: {
          running: true, // If we're responding, server is running
          tools_available: ['lookup', 'embed', 'stats'],
        },

        // Embedding model status
        embedding_model: this.getEmbeddingModelStats(),

        // Timestamp
        generated_at: new Date().toISOString(),
      };

      return stats;

    } catch (error) {
      console.error('Smart Connections stats error:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  async getEnvironmentStats(includeDetailed = false) {
    if (!this.plugin.env) {
      return {
        status: 'not_ready',
        message: 'Smart Connections environment not loaded'
      };
    }

    const env = this.plugin.env;
    const stats = {
      status: 'ready',
      collections: {}
    };

    // Smart Sources stats
    if (env.smart_sources) {
      const sourcesStats = {
        available: true,
        total_items: env.smart_sources.items ? Object.keys(env.smart_sources.items).length : 0,
      };

      if (includeDetailed && env.smart_sources.items) {
        sourcesStats.detailed = this.getDetailedCollectionStats(env.smart_sources.items);
      }

      stats.collections.smart_sources = sourcesStats;
    } else {
      stats.collections.smart_sources = { available: false };
    }

    // Smart Blocks stats
    if (env.smart_blocks) {
      const blocksStats = {
        available: true,
        total_items: env.smart_blocks.items ? Object.keys(env.smart_blocks.items).length : 0,
      };

      if (includeDetailed && env.smart_blocks.items) {
        blocksStats.detailed = this.getDetailedCollectionStats(env.smart_blocks.items);
      }

      stats.collections.smart_blocks = blocksStats;
    } else {
      stats.collections.smart_blocks = { available: false };
    }

    return stats;
  }

  getDetailedCollectionStats(items) {
    const stats = {
      with_embeddings: 0,
      without_embeddings: 0,
      file_types: {},
      size_distribution: {
        small: 0,  // < 1KB
        medium: 0, // 1KB - 10KB
        large: 0,  // > 10KB
      }
    };

    for (const [key, item] of Object.entries(items)) {
      // Check for embeddings
      if (item.vec || (item.embeddings && Object.keys(item.embeddings).length > 0)) {
        stats.with_embeddings++;
      } else {
        stats.without_embeddings++;
      }

      // File type analysis
      const extension = key.split('.').pop()?.toLowerCase() || 'unknown';
      stats.file_types[extension] = (stats.file_types[extension] || 0) + 1;

      // Size distribution
      const size = item.size || (item.content ? item.content.length : 0);
      if (size < 1024) {
        stats.size_distribution.small++;
      } else if (size < 10240) {
        stats.size_distribution.medium++;
      } else {
        stats.size_distribution.large++;
      }
    }

    return stats;
  }

  getEmbeddingModelStats() {
    if (!this.plugin.env || !this.plugin.env.smart_embed_model) {
      return {
        available: false,
        status: 'not_available'
      };
    }

    const model = this.plugin.env.smart_embed_model;
    return {
      available: true,
      loaded: !!model.model_loaded,
      model_name: typeof model.model_name === 'string' ? model.model_name : 'TaylorAI/bge-micro-v2',
      model_path: typeof model.model_path === 'string' ? model.model_path : 'unknown',
      max_input_length: typeof model.max_input_length === 'number' ? model.max_input_length : 'unknown',
      dimensions: typeof model.dimensions === 'number' ? model.dimensions : 'unknown',
    };
  }
}