#!/usr/bin/env python3
"""
HTTP wrapper for Snowflake MCP Server
Allows N8N to connect via HTTP endpoint
"""

import os
import asyncio
import subprocess
import json
from typing import Any, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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

class MCPRequest(BaseModel):
    method: str
    params: Dict[str, Any] = {}

class MCPResponse(BaseModel):
    result: Any = None
    error: str = None

# Store MCP process
mcp_process = None

def get_snowflake_config():
    """Get Snowflake connection config from environment variables"""
    return {
        "account": os.getenv("SNOWFLAKE_ACCOUNT", "NKELRFK-NB90244"),
        "user": os.getenv("SNOWFLAKE_USER", "N8N_SERVICE_USER"),
        "password": os.getenv("SNOWFLAKE_PASSWORD"),
        "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE", "BENBETTER_WH"),
        "database": os.getenv("SNOWFLAKE_DATABASE", "BENBETTER_GUIDES"),
        "schema": os.getenv("SNOWFLAKE_SCHEMA", "BENEFIT_GUIDES_V2"),
        "role": os.getenv("SNOWFLAKE_ROLE", "N8N_ROLE")
    }

@app.on_event("startup")
async def startup_event():
    """Start the MCP server on startup"""
    global mcp_process
    
    config = get_snowflake_config()
    
    # Build command to start MCP server
    cmd = [
        "uvx", "--from", "git+https://github.com/Snowflake-Labs/mcp",
        "mcp-server-snowflake",
        "--service-config-file", "/app/tools_config.yaml",
        "--account", config["account"],
        "--user", config["user"],
        "--warehouse", config["warehouse"],
        "--database", config["database"],
        "--schema", config["schema"],
        "--role", config["role"]
    ]
    
    if config["password"]:
        cmd.extend(["--password", config["password"]])
    
    print(f"Starting MCP server with command: {' '.join(cmd)}")
    
    try:
        # Start MCP server as subprocess
        mcp_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print("MCP server started successfully")
    except Exception as e:
        print(f"Failed to start MCP server: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean shutdown"""
    global mcp_process
    if mcp_process:
        mcp_process.terminate()
        mcp_process.wait()

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Snowflake MCP Server"}

@app.get("/tools")
async def list_tools():
    """List available MCP tools"""
    return {
        "tools": [
            {
                "name": "cortex_search",
                "description": "Search through benefit guide text content",
                "database": "BENBETTER_GUIDES",
                "schema": "BENEFIT_GUIDES_V2"
            },
            {
                "name": "cortex_analyst", 
                "description": "Natural language queries on structured benefit data",
                "database": "BENBETTER_GUIDES",
                "schema": "BENEFIT_GUIDES_V2"
            }
        ]
    }

@app.post("/query")
async def execute_query(request: MCPRequest):
    """Execute MCP query"""
    try:
        # This would interact with the MCP server
        # For now, return a simple response
        return MCPResponse(
            result=f"Executed {request.method} with params: {request.params}"
        )
    except Exception as e:
        return MCPResponse(error=str(e))

@app.post("/search")
async def search_benefits(query: dict):
    """Search benefit guides using Cortex Search"""
    try:
        search_query = query.get("query", "")
        
        # This would call the actual Cortex Search
        return {
            "results": [
                {
                    "company": "Example Company",
                    "industry": "Manufacturing", 
                    "relevance_score": 0.95,
                    "content_excerpt": f"Found content related to: {search_query}"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_data(query: dict):
    """Analyze structured data using Cortex Analyst"""
    try:
        natural_language_query = query.get("query", "")
        
        # This would call the actual Cortex Analyst
        return {
            "sql_generated": "SELECT COUNT(*) FROM EMPLOYER_BENEFIT_GUIDES WHERE...",
            "results": [{"metric": "example", "value": 123}],
            "interpretation": f"Analysis for: {natural_language_query}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)