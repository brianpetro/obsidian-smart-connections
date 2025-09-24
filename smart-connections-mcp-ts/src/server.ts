#!/usr/bin/env node
/**
 * Smart Connections MCP Server
 *
 * Provides programmatic access to Smart Connections' vector database
 * via Model Context Protocol tools using their exact libraries.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SmartEnvAdapter } from './smart-env/smart-env-adapter.js';
import { SmartConnectionsLookup, SMART_CONNECTIONS_LOOKUP_TOOL } from './tools/lookup.js';
import { SmartConnectionsEmbed, SMART_CONNECTIONS_EMBED_TOOL } from './tools/embed.js';
import { SmartCacheManager } from './utils/cache-manager.js';

export class SmartConnectionsMCPServer {
  private server: Server;
  private envAdapters: Map<string, SmartEnvAdapter> = new Map();
  private embedService: SmartConnectionsEmbed | null = null;
  private cacheManager: SmartCacheManager;

  constructor() {
    this.server = new Server(
      {
        name: 'smart-connections-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.cacheManager = new SmartCacheManager();
    this.setupHandlers();
  }

  private async getEnvAdapter(vaultPath: string): Promise<SmartEnvAdapter> {
    // Check cache first
    if (this.envAdapters.has(vaultPath)) {
      const adapter = this.envAdapters.get(vaultPath)!;

      // Check if we need to refresh based on file modification time
      if (await this.cacheManager.shouldReload(vaultPath)) {
        console.log(`Reloading Smart Connections data for vault: ${vaultPath}`);
        await adapter.initialize();
        this.cacheManager.updateCache(vaultPath);
      }

      return adapter;
    }

    // Create new adapter
    console.log(`Initializing Smart Connections for vault: ${vaultPath}`);
    const adapter = new SmartEnvAdapter(vaultPath);
    await adapter.initialize();

    this.envAdapters.set(vaultPath, adapter);
    this.cacheManager.updateCache(vaultPath);

    return adapter;
  }

  private async getEmbedService(): Promise<SmartConnectionsEmbed> {
    if (!this.embedService) {
      console.log('Initializing Smart Connections embedding service');
      this.embedService = new SmartConnectionsEmbed();
      await this.embedService.initialize();
    }

    return this.embedService;
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          SMART_CONNECTIONS_LOOKUP_TOOL,
          SMART_CONNECTIONS_EMBED_TOOL,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'smart_connections_lookup':
            return await this.handleLookup(args);
          case 'smart_connections_embed':
            return await this.handleEmbed(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Tool ${name} error:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                type: error instanceof Error ? error.constructor.name : 'UnknownError',
                tool: name,
              }, null, 2),
            },
          ],
        };
      }
    });
  }

  private async handleLookup(args: any) {
    const { vault_path, hypotheticals, filter, search_both = true } = args;

    if (!vault_path) {
      throw new Error('vault_path is required');
    }

    if (!hypotheticals || !Array.isArray(hypotheticals) || hypotheticals.length < 2) {
      throw new Error('hypotheticals must be an array with at least 2 items');
    }

    // Get Smart Connections environment adapter
    const envAdapter = await this.getEnvAdapter(vault_path);

    // Perform lookup using their exact methods
    const lookup = new SmartConnectionsLookup(envAdapter);

    const results = search_both
      ? await lookup.searchAll({ hypotheticals, filter })
      : await lookup.lookup({ hypotheticals, filter });

    const response = {
      results: results.map((result: any) => ({
        key: result.key || result.id,
        score: result.score || result.sim || 0,
        content: result.content || result.data?.content || result.text,
        path: result.path,
        type: result.constructor?.name || 'SmartItem',
      })),
      count: results.length,
      search_params: {
        hypotheticals,
        filter,
        search_both,
      },
      vault_stats: envAdapter.getStats(),
      cache_stats: this.cacheManager.getCacheStats(vault_path),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  private async handleEmbed(args: any) {
    const { content } = args;

    if (!content) {
      throw new Error('content is required');
    }

    try {
      // Get embedding service
      const embedService = await this.getEmbedService();

      // Generate embedding using Smart Connections' exact model
      const embedding = await embedService.embed(content);

      const response = {
        embedding: embedding,
        model: 'TaylorAI/bge-micro-v2',
        content_length: content.length,
        embedding_dim: embedding.length,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      // Fallback response if embedding model fails
      const response = {
        error: 'Embedding model not available',
        message: 'Smart Connections embedding model could not be loaded',
        suggestion: 'Use Smart Connections plugin to generate embeddings first',
        details: error instanceof Error ? error.message : String(error),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Smart Connections MCP Server is running...');
  }
}

// Main execution
async function main() {
  const server = new SmartConnectionsMCPServer();
  await server.run();
}

if (require.main === module) {
  main().catch(console.error);
}