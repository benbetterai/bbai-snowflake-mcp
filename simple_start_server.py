#!/usr/bin/env python3
"""
Simple HTTP server for Snowflake MCP
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
            }
        ]
    }

@app.post("/search")
async def search_benefits(query: dict):
    """Search benefit guides"""
    return {
        "results": [
            {
                "company": "Test Company",
                "industry": "Manufacturing",
                "content": f"Found results for: {query.get('query', 'No query')}"
            }
        ]
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)