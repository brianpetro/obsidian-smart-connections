/**
 * Smart Connections MCP Server
 *
 * Runs embedded within the Smart Connections Obsidian plugin
 * Provides MCP tools with direct access to plugin environment
 */

import { HttpMCPTransport } from './transport/http.js';

import { SmartConnectionsLookupTool } from './tools/lookup.js';
import { SmartConnectionsEmbedTool } from './tools/embed.js';
import { SmartConnectionsStatsTool } from './tools/stats.js';

export class SmartConnectionsMCPServer {
  constructor(plugin, options = {}) {
    this.plugin = plugin;
    this.transport = null;
    this.tools = {};
    this.port = options.port || 3456;

    // Initialize tools with plugin access
    this.tools.lookup = new SmartConnectionsLookupTool(plugin);
    this.tools.embed = new SmartConnectionsEmbedTool(plugin);
    this.tools.stats = new SmartConnectionsStatsTool(plugin);
  }

  async start() {
    try {
      // Create HTTP transport
      this.transport = new HttpMCPTransport({ port: this.port, https: false, plugin: this.plugin });

      // Start the HTTP server
      await this.transport.start(this);

      console.log(`Smart Connections MCP Server started on http://localhost:${this.port}`);

      // Update plugin status
      if (this.plugin.mcp_status_el) {
        this.plugin.mcp_status_el.textContent = `MCP: Running on :${this.port}`;
        this.plugin.mcp_status_el.addClass('sc-mcp-status-running');
      }

    } catch (error) {
      console.error('Failed to start Smart Connections MCP Server:', error);

      // Update plugin status
      if (this.plugin.mcp_status_el) {
        this.plugin.mcp_status_el.textContent = 'MCP: Error';
        this.plugin.mcp_status_el.addClass('sc-mcp-status-error');
      }

      throw error;
    }
  }

  async stop() {
    try {
      if (this.transport) {
        await this.transport.stop();
        this.transport = null;
      }

      console.log('Smart Connections MCP Server stopped');

      // Update plugin status
      if (this.plugin.mcp_status_el) {
        this.plugin.mcp_status_el.textContent = 'MCP: Stopped';
        this.plugin.mcp_status_el.removeClass('sc-mcp-status-running');
        this.plugin.mcp_status_el.removeClass('sc-mcp-status-error');
      }

    } catch (error) {
      console.error('Error stopping Smart Connections MCP Server:', error);
    }
  }

  // Simple handlers for HTTP transport
  async handleInitialize(request) {
    const { params } = request;

    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        logging: {}
      },
      serverInfo: {
        name: "Smart Connections MCP Server",
        version: "1.0.0"
      }
    };
  }

  async handleListTools() {
    return {
      tools: [
        this.tools.lookup.getToolDefinition(),
        this.tools.embed.getToolDefinition(),
        this.tools.stats.getToolDefinition(),
      ],
    };
  }

  async handleToolCall(request) {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case 'smart_connections_lookup':
          result = await this.tools.lookup.execute(args);
          break;

        case 'smart_connections_embed':
          result = await this.tools.embed.execute(args);
          break;

        case 'smart_connections_stats':
          result = await this.tools.stats.execute(args);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };

    } catch (error) {
      console.error(`Smart Connections MCP Tool ${name} error:`, error);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              type: error.constructor.name,
              tool: name,
              plugin_status: {
                env_loaded: !!this.plugin.env,
                sources_count: this.plugin.env?.smart_sources?.items ? Object.keys(this.plugin.env.smart_sources.items).length : 0,
              }
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  // Get server status for plugin UI
  getStatus() {
    return {
      running: !!this.server,
      tools_count: Object.keys(this.tools).length,
      plugin_env_ready: !!this.plugin.env,
    };
  }
}