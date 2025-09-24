/**
 * Simple test script to verify MCP server components work
 * This tests the MCP tools without requiring the full Obsidian environment
 */

import { SmartConnectionsLookupTool } from './src/mcp/tools/lookup.js';
import { SmartConnectionsEmbedTool } from './src/mcp/tools/embed.js';
import { SmartConnectionsStatsTool } from './src/mcp/tools/stats.js';
import { HttpMCPTransport } from './src/mcp/transport/http.js';

// Mock plugin object for testing
const mockPlugin = {
  env: {
    smart_sources: {
      async lookup(params) {
        console.log('Mock sources lookup called with:', params);
        return [
          {
            key: 'test-note.md',
            content: 'This is a test note for MCP server testing.',
            score: 0.95,
            path: 'test-note.md'
          }
        ];
      },
      items: {
        'test-note.md': { content: 'Test content' },
        'another-note.md': { content: 'Another test' }
      }
    },
    smart_blocks: {
      async lookup(params) {
        console.log('Mock blocks lookup called with:', params);
        return [
          {
            key: 'block1#123',
            content: 'This is a test block for MCP server testing.',
            score: 0.88,
            path: 'block1'
          }
        ];
      },
      items: {
        'block1': { content: 'Block content 1' },
        'block2': { content: 'Block content 2' }
      }
    },
    smart_embed_model: {
      model_loaded: true,
      model_name: 'TaylorAI/bge-micro-v2',
      async embed(content) {
        console.log('Mock embed called with:', content.substring(0, 50) + '...');
        // Return a mock embedding vector
        return new Array(384).fill(0).map(() => Math.random() - 0.5);
      }
    }
  },
  app: {
    vault: {
      getName() {
        return 'test-vault';
      },
      getAllLoadedFiles() {
        return ['test-note.md', 'another-note.md'];
      },
      adapter: {
        path: '/path/to/test-vault'
      }
    }
  },
  manifest: {
    name: 'Smart Connections',
    version: '3.0.80'
  },
  settings: {
    mcp_server_enabled: true,
    mcp_server_port: 3001
  }
};

async function testMCPComponents() {
  console.log('🧪 Testing Smart Connections MCP Server Components...\n');

  try {
    // Test Lookup Tool
    console.log('1. Testing Lookup Tool');
    const lookupTool = new SmartConnectionsLookupTool(mockPlugin);
    const lookupDefinition = lookupTool.getToolDefinition();
    console.log('   ✅ Lookup tool definition:', lookupDefinition.name);

    const lookupResult = await lookupTool.execute({
      hypotheticals: ['test query', 'example search']
    });
    console.log('   ✅ Lookup tool execution successful, found', lookupResult.results.length, 'results');

    // Test Embed Tool
    console.log('\n2. Testing Embed Tool');
    const embedTool = new SmartConnectionsEmbedTool(mockPlugin);
    const embedDefinition = embedTool.getToolDefinition();
    console.log('   ✅ Embed tool definition:', embedDefinition.name);

    const embedResult = await embedTool.execute({
      content: 'This is a test sentence for embedding.'
    });
    console.log('   ✅ Embed tool execution successful, embedding dimensions:', embedResult.embedding.length);

    // Test Stats Tool
    console.log('\n3. Testing Stats Tool');
    const statsTool = new SmartConnectionsStatsTool(mockPlugin);
    const statsDefinition = statsTool.getToolDefinition();
    console.log('   ✅ Stats tool definition:', statsDefinition.name);

    const statsResult = await statsTool.execute({});
    console.log('   ✅ Stats tool execution successful');
    console.log('   📊 Vault info:', statsResult.vault_info);
    console.log('   📊 Collections:', Object.keys(statsResult.environment.collections));

    // Test HTTP Transport (basic instantiation)
    console.log('\n4. Testing HTTP Transport');
    const httpTransport = new HttpMCPTransport({ port: 3001 });
    console.log('   ✅ HTTP transport created successfully on port 3001');
    console.log('   🌐 Server URL would be:', httpTransport.getServerUrl());

    console.log('\n✅ All MCP server components test successfully!');
    console.log('\n🚀 Ready for integration with Smart Connections plugin');

    console.log('\n📋 Usage Instructions:');
    console.log('1. Enable Smart Connections plugin in Obsidian');
    console.log('2. MCP server will start automatically on http://localhost:3000');
    console.log('3. Configure your AI assistant to use the MCP endpoint');
    console.log('4. Available tools: smart_connections_lookup, smart_connections_embed, smart_connections_stats');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testMCPComponents().catch(console.error);