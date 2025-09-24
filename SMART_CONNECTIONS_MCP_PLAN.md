# Smart Connections MCP Server Implementation Plan

This document outlines the implementation plan for an MCP (Model Context Protocol) server that integrates with Smart Connections' vector database, providing the exact same embedding and search capabilities via MCP tools.

## Overview

The goal is to create an MCP server that:
- Reads Smart Connections' existing `.smart-env/` vector database files
- Uses the exact same embedding model (`TaylorAI/bge-micro-v2`)
- Implements identical search algorithms and filtering
- Provides smart caching with file modification time checking
- Offers programmatic access to the knowledge base via MCP tools
- Optimized for on-demand/ephemeral execution (spawned per request)

## Technology Choice

**Language**: TypeScript/Node.js (chosen for direct compatibility with Smart Connections libraries)
**Deployment**: On-demand/ephemeral (spawned per MCP request)
**Caching Strategy**: File modification time checking with TTL fallback
**Key Insight**: Use Smart Connections' existing jsbrains libraries for 100% compatibility

## Research Findings

After analyzing the Smart Connections codebase, we discovered:

### Core Libraries (from jsbrains)
- **smart-collections**: Contains `AjsonMultiFileCollectionDataAdapter` for reading `.smart-env/multi/*.ajson` files
- **smart-utils**: Contains `cos_sim()` function for cosine similarity calculations
- **smart-embed-model**: Handles `TaylorAI/bge-micro-v2` embedding model
- **obsidian-smart-env**: Core environment management

### Key API Methods
- **`collection.lookup({hypotheticals, ...params})`**: Main search method
- **`cos_sim(item_a.vec, item_b.vec)`**: Cosine similarity calculation
- **`get_nearest_until_next_dev_exceeds_std_dev(results)`**: Statistical filtering algorithm

### Data Format Discovery
- **`.ajson` files**: Contain concatenated JSON objects (not comma-separated)
- **Vector access**: Items have `.vec` property with embedding arrays
- **Embedding structure**: `item.embeddings['TaylorAI/bge-micro-v2'].vec`

### Exact Algorithms Found
- **Statistical filtering**: Identical algorithm in `smart-chat-v0/actions/lookup.js:54-76`
- **Lookup flow**: `hypotheticals` → embed → cosine similarity → statistical filter → results

## Project Structure

```
smart-connections-mcp/
├── package.json                     # Node.js dependencies
├── tsconfig.json                    # TypeScript configuration
├── README.md
├── src/
│   ├── server.ts                    # Main MCP server entry point
│   ├── smart-env/
│   │   └── smart-env-adapter.ts     # Smart Connections environment integration
│   ├── tools/
│   │   ├── lookup.ts                # smart_connections_lookup tool
│   │   ├── embed.ts                 # smart_connections_embed tool
│   │   └── sync.ts                  # smart_connections_sync tool
│   └── utils/
│       └── cache-manager.ts         # Smart caching with mtime checking
├── node_modules/
│   └── jsbrains/                    # Direct import of Smart Connections libraries
│       ├── smart-collections/
│       ├── smart-utils/
│       ├── smart-embed-model/
│       └── obsidian-smart-env/
```

## Core Implementation Components

### 1. Smart Environment Integration (TypeScript)

**File: `src/smart-env/smart-env-adapter.ts`**

```typescript
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
          // Use their exact configuration
        },
        smart_blocks: {
          data_adapter: AjsonMultiFileCollectionDataAdapter,
        }
      }
    };

    this.env = await SmartEnv.create(smartEnvConfig);
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
}
```

### 2. MCP Tools Implementation

**File: `src/tools/lookup.ts`**

```typescript
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
  }

  /**
   * Calculate cosine similarity using Smart Connections' exact function
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    return cos_sim(vecA, vecB);
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
      }
    },
    required: ["hypotheticals", "vault_path"]
  }
};
```

**File: `src/tools/embed.ts`**

```typescript
export const SMART_CONNECTIONS_EMBED_TOOL = {
  name: "smart_connections_embed",
  description: "Generate embeddings using Smart Connections' exact model (TaylorAI/bge-micro-v2)",
  inputSchema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "Text content to embed"
      }
    },
    required: ["content"]
  }
};
```

### 3. Main MCP Server Implementation

**File: `src/server.ts`**

```typescript
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
import { SMART_CONNECTIONS_EMBED_TOOL } from './tools/embed.js';
import { SmartCacheManager } from './utils/cache-manager.js';

export class SmartConnectionsMCPServer {
  private server: Server;
  private envAdapters: Map<string, SmartEnvAdapter> = new Map();
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
        await adapter.initialize();
      }

      return adapter;
    }

    // Create new adapter
    const adapter = new SmartEnvAdapter(vaultPath);
    await adapter.initialize();

    this.envAdapters.set(vaultPath, adapter);
    this.cacheManager.updateCache(vaultPath);

    return adapter;
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
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                type: error instanceof Error ? error.constructor.name : 'UnknownError',
              }, null, 2),
            },
          ],
        };
      }
    });
  }

  private async handleLookup(args: any) {
    const { vault_path, hypotheticals, filter } = args;

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
    const results = await lookup.lookup({ hypotheticals, filter });

    const response = {
      results: results.map(result => ({
        key: result.key,
        score: result.score,
        content: result.content || result.data?.content,
      })),
      count: results.length,
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

    // Use Smart Connections' embedding model directly
    // This would typically require access to their embed model instance
    // For now, we'll show the interface structure
    const response = {
      error: 'Embedding functionality requires Smart Connections embed model integration',
      note: 'This would use their exact TaylorAI/bge-micro-v2 model with their preprocessing',
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

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
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
```

### 4. Smart Cache Manager

**File: `src/utils/cache-manager.ts`**

```typescript
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
```

## Package Dependencies

**File: `package.json`**

```json
{
  "name": "smart-connections-mcp",
  "version": "1.0.0",
  "description": "MCP server for Smart Connections vector database integration",
  "type": "module",
  "main": "dist/server.js",
  "bin": {
    "smart-connections-mcp": "dist/server.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx src/server.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "smart-collections": "file:../node_modules/jsbrains/smart-collections",
    "smart-utils": "file:../node_modules/jsbrains/smart-utils",
    "smart-embed-model": "file:../node_modules/jsbrains/smart-embed-model",
    "obsidian-smart-env": "file:../node_modules/jsbrains/obsidian-smart-env"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**File: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Updated Implementation Strategy

### Using Smart Connections Libraries Directly

The key insight is to use Smart Connections' existing jsbrains libraries for 100% compatibility:

1. **Collection Lookup**: Use `collection.lookup({hypotheticals, ...params})` directly
2. **Statistical Filtering**: Import `get_nearest_until_next_dev_exceeds_std_dev` from smart-utils
3. **Cosine Similarity**: Use `cos_sim` from smart-utils
4. **Data Adapters**: Use `AjsonMultiFileCollectionDataAdapter` for reading .ajson files
5. **Environment Management**: Use `SmartEnv` from obsidian-smart-env

### Dependencies Installation

Since Smart Connections uses the jsbrains libraries, we'll need to:

1. **Link to existing libraries**:
   ```bash
   # In the Smart Connections repository
   cd node_modules/jsbrains
   npm link smart-collections smart-utils smart-embed-model obsidian-smart-env

   # In our MCP project
   npm link smart-collections smart-utils smart-embed-model obsidian-smart-env
   ```

2. **Or copy the libraries locally**:
   ```bash
   cp -r /path/to/smart-connections/node_modules/jsbrains ./node_modules/
   ```

### Key Benefits of TypeScript Approach

1. **Direct Compatibility**: Uses Smart Connections' exact libraries and methods
2. **Type Safety**: TypeScript provides better development experience
3. **Performance**: Native Node.js performance without Python overhead
4. **Maintenance**: Easier to maintain compatibility as Smart Connections evolves
5. **Integration**: Natural fit with existing Smart Connections TypeScript codebase

## Next Steps

### Immediate Actions

1. **Set up TypeScript environment**:
   ```bash
   mkdir smart-connections-mcp
   cd smart-connections-mcp
   npm init -y
   npm install typescript @types/node tsx --save-dev
   npm install @modelcontextprotocol/sdk
   ```

2. **Link Smart Connections libraries**:
   ```bash
   # Copy or link jsbrains modules from Smart Connections
   mkdir -p node_modules/jsbrains
   # ... copy libraries
   ```

3. **Start with core adapter**:
   - Implement `SmartEnvAdapter` using their exact `SmartEnv.create()` method
   - Test with actual Smart Connections `.smart-env/` data
   - Verify `collection.lookup()` returns identical results

### Testing Strategy

- **Integration Tests**: Compare MCP results with Smart Connections plugin results
- **Performance Tests**: Measure startup time and query latency
- **Compatibility Tests**: Ensure identical search results across different content types

### Success Criteria

- **Identical Results**: MCP server returns same results as Smart Connections plugin
- **Fast Startup**: Sub-2-second cold start for on-demand execution
- **Real-time Sync**: Automatically picks up Smart Connections data changes
- **Type Safety**: Full TypeScript coverage with proper error handling

This TypeScript implementation leverages Smart Connections' exact libraries for guaranteed compatibility while providing a robust MCP server architecture.