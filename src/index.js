#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Snowflake MCP server running on stdio");
  }
}

const server = new SnowflakeMCPServer();
server.run().catch(console.error);