#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AscClient } from "./client/ascClient.js";
import { AscRequestError } from "./client/ascClient.js";
import { ConfigError } from "./config.js";
import { loadTools, type ToolContext } from "./tools/registry.js";

const SERVER_NAME = "asc-mcp";
const SERVER_VERSION = "0.1.0";

async function main(): Promise<void> {
  const client = new AscClient();
  const ctx: ToolContext = { client };

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const tools = await loadTools();

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema ?? {},
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(args as never, ctx);
          return {
            content: [{ type: "text" as const, text: jsonText(result) }],
          };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: errorText(err) }],
          };
        }
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stay alive; the transport drives the process over stdio.
}

function jsonText(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function errorText(err: unknown): string {
  if (err instanceof ConfigError) return `Configuration error: ${err.message}`;
  if (err instanceof AscRequestError) {
    return `App Store Connect API error (HTTP ${err.statusCode}): ${err.message}`;
  }
  return `Error: ${err instanceof Error ? err.message : String(err)}`;
}

main().catch((err) => {
  console.error(`[asc-mcp] fatal: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
