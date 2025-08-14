#!/usr/bin/env python3
"""
SSE-enabled HTTP server for Snowflake MCP
Supports Server-Sent Events for N8N MCP Client compatibility
"""

import os
import json
import asyncio
from typing import Any, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn

app = FastAPI(title="Snowflake MCP Server", version="1.0.0")

# Enable CORS for N8N
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MCP Protocol Methods
MCP_METHODS = {
    "initialize": {
        "description": "Initialize MCP connection",
        "capabilities": {
            "tools": {
                "cortex_search": {
                    "description": "Search through benefit guide text content"
                }
            }
        }
    },
    "tools/list": {
        "tools": [
            {
                "name": "cortex_search",
                "description": "Search through employer benefit guide text content",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query for benefit guides"
                        }
                    },
                    "required": ["query"]
                }
            }
        ]
    },
    "tools/call": {
        "description": "Execute tool calls"
    }
}

async def generate_sse_response():
    """Generate Server-Sent Events for MCP protocol"""
    
    # Send initial connection message
    yield f"data: {json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'server/ready'})}\n\n"
    
    # Keep connection alive
    while True:
        await asyncio.sleep(30)  # Send heartbeat every 30 seconds
        yield f"data: {json.dumps({'jsonrpc': '2.0', 'method': 'ping'})}\n\n"

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Snowflake MCP Server", "protocol": "SSE"}

@app.get("/sse")
async def sse_endpoint():
    """Server-Sent Events endpoint for N8N MCP Client"""
    return StreamingResponse(
        generate_sse_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*"
        }
    )

@app.post("/")
async def mcp_jsonrpc(request: Request):
    """Handle MCP JSON-RPC requests"""
    try:
        body = await request.json()
        method = body.get("method")
        params = body.get("params", {})
        request_id = body.get("id")
        
        response = {"jsonrpc": "2.0", "id": request_id}
        
        if method == "initialize":
            response["result"] = {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "snowflake-mcp-server",
                    "version": "1.0.0"
                }
            }
            
        elif method == "tools/list":
            response["result"] = {
                "tools": [
                    {
                        "name": "cortex_search",
                        "description": "Search through employer benefit guide text content",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "Search query for benefit guides"
                                }
                            },
                            "required": ["query"]
                        }
                    }
                ]
            }
            
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            if tool_name == "cortex_search":
                query = arguments.get("query", "")
                # Simulate search results
                response["result"] = {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Search Results for '{query}':\n\n" +
                                   "Found 3 companies matching your criteria:\n" +
                                   "1. Manufacturing Corp - Offers comprehensive wellness programs\n" +
                                   "2. Industrial Solutions LLC - Mental health benefits included\n" +
                                   "3. Production Inc - Employee assistance programs available\n\n" +
                                   "Analysis based on BENBETTER_GUIDES.BENEFIT_GUIDES_V2 database."
                        }
                    ]
                }
            else:
                response["error"] = {
                    "code": -32601,
                    "message": f"Unknown tool: {tool_name}"
                }
        else:
            response["error"] = {
                "code": -32601,
                "message": f"Unknown method: {method}"
            }
            
        return response
        
    except Exception as e:
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {
                "code": -32603,
                "message": f"Internal error: {str(e)}"
            }
        }

@app.get("/tools")
async def list_tools():
    """List available MCP tools (for testing)"""
    return {
        "tools": [
            {
                "name": "cortex_search",
                "description": "Search through benefit guide text content",
                "database": "BENBETTER_GUIDES",
                "schema": "BENEFIT_GUIDES_V2"
            }
        ]
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)