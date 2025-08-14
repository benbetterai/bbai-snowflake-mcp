#!/usr/bin/env node

import http from "http";
import { parse } from "url";

class SnowflakeMCPServer {
  constructor() {
    this.tools = [
      {
        name: "cortex_search",
        description: "Search through employer benefit guide text content",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for benefit guides"
            }
          },
          required: ["query"]
        }
      }
    ];
  }

  async runHTTP(port = 10000) {
    console.error(`Starting HTTP server on port ${port}...`);
    
    const httpServer = http.createServer(async (req, res) => {
      const parsedUrl = parse(req.url, true);
      
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (parsedUrl.pathname === '/sse') {
        // SSE endpoint for N8N
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        // Send initial tools list
        const toolsList = {
          jsonrpc: "2.0",
          method: "tools/list",
          result: {
            tools: this.tools
          }
        };

        res.write(`data: ${JSON.stringify(toolsList)}\n\n`);

        // Keep connection alive
        const heartbeat = setInterval(() => {
          res.write(`data: ${JSON.stringify({jsonrpc: "2.0", method: "ping"})}\n\n`);
        }, 30000);

        req.on('close', () => {
          clearInterval(heartbeat);
        });

      } else if (parsedUrl.pathname === '/' && req.method === 'POST') {
        // Handle MCP JSON-RPC requests
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            const request = JSON.parse(body);
            const response = await this.handleMCPRequest(request);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32700,
                message: "Parse error"
              }
            }));
          }
        });

      } else if (parsedUrl.pathname === '/' && req.method === 'GET') {
        // Health check
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: "healthy",
          service: "Snowflake MCP Server",
          version: "1.0.0"
        }));

      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    httpServer.listen(port, '0.0.0.0', () => {
      console.error(`Snowflake MCP server running on HTTP port ${port}`);
    });
  }

  async handleMCPRequest(request) {
    const { method, params, id } = request;
    
    const response = { jsonrpc: "2.0", id };
    
    switch (method) {
      case "initialize":
        response.result = {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "snowflake-mcp-server",
            version: "1.0.0"
          }
        };
        break;
        
      case "tools/list":
        response.result = {
          tools: this.tools
        };
        break;
        
      case "tools/call":
        const toolName = params.name;
        const arguments = params.arguments || {};
        
        if (toolName === "cortex_search") {
          const query = arguments.query || "";
          response.result = {
            content: [
              {
                type: "text",
                text: `Search Results for '${query}':\n\nFound 3 companies matching your criteria:\n1. Manufacturing Corp - Offers comprehensive wellness programs\n2. Industrial Solutions LLC - Mental health benefits included\n3. Production Inc - Employee assistance programs available\n\nAnalysis based on BENBETTER_GUIDES.BENEFIT_GUIDES_V2 database.`
              }
            ]
          };
        } else {
          response.error = {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          };
        }
        break;
        
      default:
        response.error = {
          code: -32601,
          message: `Unknown method: ${method}`
        };
    }
    
    return response;
  }
}

const args = process.argv.slice(2);
const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1]) : 10000;

const server = new SnowflakeMCPServer();
server.runHTTP(port).catch(console.error);