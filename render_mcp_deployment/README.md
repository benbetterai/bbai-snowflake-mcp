# Snowflake MCP Server Deployment for Render

This deploys a Snowflake MCP (Model Context Protocol) server on Render to provide HTTP endpoints for N8N integration.

## 🚀 Quick Deploy to Render

1. **Create new Render service:**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Web Service"
   - Connect your GitHub repo with these files

2. **Set Environment Variables:**
   ```
   SNOWFLAKE_ACCOUNT=NKELRFK-NB90244
   SNOWFLAKE_USER=N8N_SERVICE_USER
   SNOWFLAKE_PASSWORD=[your-password]
   SNOWFLAKE_WAREHOUSE=BENBETTER_WH
   SNOWFLAKE_DATABASE=BENBETTER_GUIDES
   SNOWFLAKE_SCHEMA=BENEFIT_GUIDES_V2
   SNOWFLAKE_ROLE=N8N_ROLE
   ```

3. **Deploy Configuration:**
   - Environment: Docker
   - Plan: Starter ($7/month)
   - Region: Oregon (or closest to you)

## 📡 Endpoints

Once deployed, your service will have these endpoints:

- `GET /` - Health check
- `GET /tools` - List available MCP tools
- `POST /search` - Search benefit guides using Cortex Search
- `POST /analyze` - Analyze data using Cortex Analyst
- `POST /query` - General MCP query endpoint

## 🔗 N8N Integration

Use the Render URL in your N8N MCP node:
```
https://your-service-name.onrender.com
```

## 🛠 Local Testing

```bash
cd render_mcp_deployment
python start_server.py
```

Then test endpoints:
```bash
curl http://localhost:8000/
curl http://localhost:8000/tools
```

## 🔒 Security Notes

- Uses read-only N8N_SERVICE_USER credentials
- All Snowflake credentials stored as Render secrets
- CORS enabled for N8N access
- No persistent data storage on Render

## 📊 Example Queries

**Search for companies with wellness programs:**
```json
POST /search
{
  "query": "wellness program mental health"
}
```

**Analyze benefit trends:**
```json
POST /analyze  
{
  "query": "What are the average deductibles by industry?"
}
```