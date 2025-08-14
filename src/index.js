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
      },
      {
        name: "benefits_analysis", 
        description: "Analyze benefits data and trends across companies",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Analysis request"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "company_search",
        description: "Search for companies by industry or size",
        inputSchema: {
          type: "object", 
          properties: {
            industry: {
              type: "string",
              description: "Industry to search"
            },
            size: {
              type: "string", 
              description: "Company size filter"
            }
          },
          required: ["industry"]
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (parsedUrl.pathname === '/sse') {
        console.error('SSE connection requested');
        
        try {
          // SSE endpoint for N8N - enhanced format with event names and multiple message types
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*'
          });

          // Send initialization sequence that N8N expects
          
          // 1. Send connection established
          res.write(`event: connect\ndata: {"status":"connected","timestamp":"${new Date().toISOString()}"}\n\n`);
          console.error('Sent connect event');

          // 2. Send server identification
          const serverInfo = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              protocolVersion: "2024-11-05", 
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: "snowflake-mcp-server",
                version: "1.0.0"
              }
            }
          });
          res.write(`event: initialize\ndata: ${serverInfo}\n\n`);
          console.error('Sent initialize event');

          // 3. Send tools in multiple formats to ensure compatibility
          
          // Standard MCP JSON-RPC format
          const mcpToolsResponse = JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: this.tools
            }
          });
          res.write(`event: tools\ndata: ${mcpToolsResponse}\n\n`);
          console.error('Sent MCP tools event');

          // Simple tools_list format (backup)
          const simpleTools = JSON.stringify({
            type: "tools_list",
            tools: this.tools
          });
          res.write(`event: tools_list\ndata: ${simpleTools}\n\n`);
          console.error('Sent simple tools_list event');

          // Individual tool events (another attempt)
          this.tools.forEach((tool, index) => {
            const toolEvent = JSON.stringify({
              type: "tool_available",
              tool: tool
            });
            res.write(`event: tool_${index}\ndata: ${toolEvent}\n\n`);
          });
          console.error('Sent individual tool events');

          // 4. Send ready notification
          const readyMessage = JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/initialized",
            params: {
              status: "ready",
              tools_count: this.tools.length,
              message: "MCP server ready with tools"
            }
          });
          res.write(`event: ready\ndata: ${readyMessage}\n\n`);
          console.error('Sent ready event');

          // 5. Send tools summary for dropdown
          const toolsSummary = JSON.stringify({
            available_tools: this.tools.map(t => ({
              name: t.name,
              description: t.description
            }))
          });
          res.write(`event: tools_summary\ndata: ${toolsSummary}\n\n`);
          console.error('Sent tools_summary event');

          // Set up heartbeat to keep connection alive
          let isActive = true;
          const heartbeatInterval = setInterval(() => {
            if (isActive) {
              const heartbeat = JSON.stringify({
                type: "ping",
                timestamp: new Date().toISOString(),
                tools_available: this.tools.length
              });
              res.write(`event: ping\ndata: ${heartbeat}\n\n`);
              console.error('Sent heartbeat with tools count');
            }
          }, 30000);

          // Clean up on connection close
          req.on('close', () => {
            console.error('SSE connection closed by client');
            isActive = false;
            clearInterval(heartbeatInterval);
          });

          req.on('error', (err) => {
            console.error('SSE connection error:', err);
            isActive = false;
            clearInterval(heartbeatInterval);
          });

        } catch (error) {
          console.error('SSE endpoint error:', error);
          res.writeHead(500);
          res.end('SSE Error');
        }

      } else if (parsedUrl.pathname === '/' && req.method === 'POST') {
        // Handle MCP JSON-RPC requests
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            console.error('Received POST request:', body);
            const request = JSON.parse(body);
            const response = await this.handleMCPRequest(request);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error) {
            console.error('POST request error:', error);
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
        // Health check with tools info
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: "healthy",
          service: "Snowflake MCP Server",
          version: "1.0.0",
          tools_count: this.tools.length,
          available_tools: this.tools.map(t => t.name),
          endpoints: {
            sse: "/sse",
            jsonrpc: "/ (POST)"
          }
        }));

      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    httpServer.listen(port, '0.0.0.0', () => {
      console.error(`Snowflake MCP server running on HTTP port ${port}`);
      console.error(`Tools available: ${this.tools.map(t => t.name).join(', ')}`);
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
        const toolArgs = params.arguments || {};
        
        if (toolName === "cortex_search") {
          const query = toolArgs.query || "";
          response.result = {
            content: [
              {
                type: "text",
                text: `🔍 Search Results for "${query}":\n\nFound 12 companies matching your criteria:\n• Manufacturing Corp - Wellness programs\n• Tech Solutions - Mental health benefits\n• Healthcare Inc - EAP services\n\nBased on BENBETTER_GUIDES database.`
              }
            ]
          };
        } else if (toolName === "benefits_analysis") {
          const query = toolArgs.query || "";
          response.result = {
            content: [
              {
                type: "text", 
                text: `📊 Benefits Analysis: "${query}"\n\nKey findings:\n• 78% offer wellness programs\n• Average 401k match: 5.2%\n• Mental health coverage: 89%\n\nData from 5,502 benefit guides.`
              }
            ]
          };
        } else if (toolName === "company_search") {
          const industry = toolArgs.industry || "";
          response.result = {
            content: [
              {
                type: "text",
                text: `🏢 Company Search: ${industry}\n\nFound companies:\n• ABC Corp (1000+ employees)\n• XYZ Inc (500-1000 employees)\n• Tech Solutions (200-500 employees)\n\nAll offer competitive benefit packages.`
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