#!/usr/bin/env python3
"""
N8N-compatible MCP server for Snowflake
Provides both standard HTTP endpoints and SSE for N8N MCP Client
"""

import os
import json
import asyncio
from typing import Any, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
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

# Available tools definition
AVAILABLE_TOOLS = [
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

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Snowflake MCP Server", "protocol": "HTTP+SSE"}

@app.get("/tools")
async def list_tools():
    """List available MCP tools for N8N discovery"""
    return {
        "tools": AVAILABLE_TOOLS,
        "version": "1.0.0",
        "server": "snowflake-mcp"
    }

@app.get("/mcp/tools")
async def mcp_list_tools():
    """Alternative MCP tools endpoint"""
    return {"tools": AVAILABLE_TOOLS}

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
            response["result"] = {"tools": AVAILABLE_TOOLS}
            
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            if tool_name == "cortex_search":
                query = arguments.get("query", "")
                # Simulate search results for now
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

@app.post("/tools/call")
async def direct_tool_call(request: Request):
    """Direct tool call endpoint for N8N"""
    try:
        body = await request.json()
        tool_name = body.get("tool")
        arguments = body.get("arguments", {})
        
        if tool_name == "cortex_search":
            query = arguments.get("query", "")
            return {
                "success": True,
                "result": f"Search Results for '{query}': Found 3 companies with matching benefits.",
                "data": {
                    "companies": [
                        {"name": "Manufacturing Corp", "benefit": "Comprehensive wellness programs"},
                        {"name": "Industrial Solutions LLC", "benefit": "Mental health benefits"},
                        {"name": "Production Inc", "benefit": "Employee assistance programs"}
                    ]
                }
            }
        else:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
            
    except Exception as e:
        return {"success": False, "error": str(e)}

async def generate_sse_response():
    """Generate Server-Sent Events for MCP protocol"""
    
    # Send initial connection message
    yield f"data: {json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'server/ready'})}\\n\\n"
    
    # Send tools list immediately
    yield f"data: {json.dumps({'jsonrpc': '2.0', 'method': 'tools/list', 'result': {'tools': AVAILABLE_TOOLS}})}\\n\\n"
    
    # Keep connection alive with heartbeat
    while True:
        await asyncio.sleep(30)
        yield f"data: {json.dumps({'jsonrpc': '2.0', 'method': 'ping'})}\\n\\n"

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

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)