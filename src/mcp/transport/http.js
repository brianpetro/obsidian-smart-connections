/**
 * HTTP Transport for Smart Connections MCP Server
 *
 * Simple HTTP server that handles MCP protocol over HTTP
 * Runs on localhost for easy connection from AI assistants
 */

import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export class HttpMCPTransport {
  constructor(options = {}) {
    this.port = options.port || 3456;
    this.host = options.host || 'localhost';
    this.useHttps = options.https || false;
    this.plugin = options.plugin; // Need plugin reference to get data directory
    this.server = null;
    this.mcpServer = null;
  }

  async start(mcpServer) {
    this.mcpServer = mcpServer;

    return new Promise((resolve, reject) => {
      if (this.useHttps) {
        try {
          // Get the plugin directory from the plugin's manifest
          const adapter = this.plugin.app.vault.adapter;
          const vaultPath = adapter.basePath || adapter.path;
          const pluginDir = join(vaultPath, '.obsidian', 'plugins', 'smart-connections');
          const certPath = join(pluginDir, 'cert.pem');
          const keyPath = join(pluginDir, 'key.pem');

          console.log('MCP HTTPS: Looking for certificates in:', pluginDir);

          const options = {
            cert: readFileSync(certPath),
            key: readFileSync(keyPath)
          };

          this.server = createHttpsServer(options, (req, res) => {
            this.handleRequest(req, res);
          });
        } catch (error) {
          console.error('Failed to load HTTPS certificates:', error);
          reject(error);
          return;
        }
      } else {
        this.server = createServer((req, res) => {
          this.handleRequest(req, res);
        });
      }

      this.server.on('error', (error) => {
        console.error('MCP HTTP server error:', error);
        reject(error);
      });

      this.server.listen(this.port, this.host, () => {
        const protocol = this.useHttps ? 'https' : 'http';
        console.log(`Smart Connections MCP Server running on ${protocol}://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('Smart Connections MCP HTTP server stopped');
          resolve();
        });
      });
    }
  }

  async handleRequest(req, res) {
    // Set CORS headers for browser compatibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'GET') {
      // Simple status endpoint
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({
        name: 'Smart Connections MCP Server',
        version: '1.0.0',
        status: 'running',
        endpoint: '/mcp',
        tools: ['smart_connections_lookup', 'smart_connections_embed', 'smart_connections_stats']
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/mcp') {
      await this.handleMCPRequest(req, res);
      return;
    }

    // 404 for other paths
    res.writeHead(404);
    res.end('Not Found');
  }

  async handleMCPRequest(req, res) {
    try {
      // Parse request body
      const body = await this.parseRequestBody(req);
      const mcpRequest = JSON.parse(body);

      let mcpResponse;

      // Route to appropriate MCP handler
      if (mcpRequest.method === 'initialize') {
        mcpResponse = await this.mcpServer.handleInitialize(mcpRequest);
      } else if (mcpRequest.method === 'notifications/initialized') {
        // Handle initialized notification - no response needed for notifications
        res.writeHead(200);
        res.end();
        return;
      } else if (mcpRequest.method === 'tools/list') {
        mcpResponse = await this.mcpServer.handleListTools();
      } else if (mcpRequest.method === 'tools/call') {
        // Create proper request context for tool calls
        const requestContext = {
          params: mcpRequest.params
        };
        mcpResponse = await this.mcpServer.handleToolCall(requestContext);
      } else {
        throw new Error(`Unsupported MCP method: ${mcpRequest.method}`);
      }

      // Wrap MCP response in JSON-RPC 2.0 format
      const jsonRpcResponse = {
        jsonrpc: "2.0",
        id: mcpRequest.id !== undefined ? mcpRequest.id : 1,
        result: mcpResponse
      };

      // Send successful response
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(jsonRpcResponse));

    } catch (error) {
      console.error('MCP HTTP request error:', error);

      // Parse request to get ID for error response
      let requestId = 1;
      try {
        const body = await this.parseRequestBody(req);
        const parsedRequest = JSON.parse(body);
        requestId = parsedRequest.id !== undefined ? parsedRequest.id : 1;
      } catch (parseError) {
        // Use default ID if parsing fails
      }

      // Wrap error in JSON-RPC 2.0 format
      const jsonRpcError = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          code: error.message?.includes('Unknown tool') ? -32601 :
                error.message?.includes('Invalid') ? -32602 : -32603,
          message: error.message,
          data: {
            type: error.constructor.name
          }
        }
      };

      // Send error response
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(500);
      res.end(JSON.stringify(jsonRpcError));
    }
  }

  parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        resolve(body);
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  getServerUrl() {
    const protocol = this.useHttps ? 'https' : 'http';
    return `${protocol}://${this.host}:${this.port}`;
  }
}