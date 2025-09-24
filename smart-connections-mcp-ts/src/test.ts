#!/usr/bin/env node
/**
 * Simple test script to verify Smart Connections MCP server functionality
 */

import { SmartConnectionsMCPServer } from './server.js';

async function testMCPServer() {
  console.log('🧪 Testing Smart Connections MCP Server...');

  try {
    // Test server instantiation
    const server = new SmartConnectionsMCPServer();
    console.log('✅ Server instantiated successfully');

    // Note: We can't easily test the full server without setting up stdio
    // and a proper MCP client, so we'll just verify it can be created
    console.log('✅ Basic MCP server test passed');

    console.log('\n📋 Available tools:');
    console.log('  • smart_connections_lookup - Search Smart Connections vector database');
    console.log('  • smart_connections_embed - Generate embeddings using Smart Connections model');

    console.log('\n🚀 To run the server:');
    console.log('  npm run dev');
    console.log('  or');
    console.log('  npm run build && npm run start');

    console.log('\n📖 Example usage (via MCP client):');
    console.log('  Tool: smart_connections_lookup');
    console.log('  Args: {');
    console.log('    "vault_path": "/path/to/obsidian/vault",');
    console.log('    "hypotheticals": ["example query", "related content"],');
    console.log('    "filter": { "limit": 10 }');
    console.log('  }');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testMCPServer().catch(console.error);
}