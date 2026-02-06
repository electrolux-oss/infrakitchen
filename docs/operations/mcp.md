# MCP Support

InfraKitchen optionally supports the Model Context Protocol (MCP), exposing a streamable HTTP MCP server for easy integration with your favorite MCP client, such as Claude Cursor, or any MCP-compatible agent.

## Configuration

MCP is disabled by default. To enable it, set `MCP_ENABLED` in your environment or `.env` file:

```env
MCP_ENABLED=true

This exposes a streamable HTTP MCP endpoint at /api/mcp.
Authentication

The MCP endpoint requires authentication via a service account. The data and actions available through MCP mirror the permissions of the authenticating service account.
