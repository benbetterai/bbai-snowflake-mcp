# Dockerfile for Snowflake MCP Server on Render
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uvx (recommended by Snowflake MCP)
RUN pip install uv

# Copy configuration files
COPY tools_config.yaml /app/
COPY requirements.txt /app/
COPY start_server.py /app/

# Install Python dependencies
RUN pip install -r requirements.txt

# Install Snowflake MCP server
RUN uvx --from "git+https://github.com/Snowflake-Labs/mcp" mcp-server-snowflake --help || true

# Expose port for Render
EXPOSE $PORT

# Start the server
CMD ["python", "start_server.py"]