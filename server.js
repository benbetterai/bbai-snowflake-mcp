#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "http";
import { parse } from "url";

class SnowflakeMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "snowflake-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
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
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "cortex_search") {
        const query = args.query || "";
        
        // Simulate search results (replace with actual Snowflake query later)
        const results = `Search Results for '${query}':

Found 3 companies matching your criteria:
1. Manufacturing Corp - Offers comprehensive wellness programs
2. Industrial Solutions LLC - Mental health benefits included  
3. Production Inc - Employee assistance programs available

Analysis based on BENBETTER_GUIDES.BENEFIT_GUIDES_V2 database.`;

        return {
          content: [
            {
              type: "text",
              text: results
            }
          ]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Snowflake MCP server running on stdio");
  }

  async runHTTP(port = 10000) {
    console.error(`Starting HTTP server on port ${port}...`);
    
    const httpServer = http.createServer((req, res) => {
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
            tools: [
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
            ]
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

      } else if (parsedUrl.pathname === '/') {
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
}

const args = process.argv.slice(2);
const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1]) : 10000;

const server = new SnowflakeMCPServer();

if (process.env.NODE_ENV === 'production' || args.includes('--http')) {
  server.runHTTP(port).catch(console.error);
} else {
  server.runStdio().catch(console.error);
}