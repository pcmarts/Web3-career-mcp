import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Web3CareerService } from "./services/api.js";
import { registerTools } from "./tools/index.js";
import { logger } from "./utils/logger.js";

const server = new McpServer({
  name: "web3-career-mcp",
  version: "1.0.0",
});

const WEB3_CAREER_API_TOKEN = process.env.WEB3_CAREER_TOKEN;
if (!WEB3_CAREER_API_TOKEN) {
  throw new Error(
    "WEB3_CAREER_TOKEN environment variable is required. " +
    "Please set it in your MCP server configuration."
  );
}

// Initialize Service
const apiService = new Web3CareerService(WEB3_CAREER_API_TOKEN);

// Register Tools
registerTools(server, apiService);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Web3 Career MCP Server started", {
    version: "1.0.0",
    transport: "stdio",
  });
}

main().catch((error) => {
  logger.error("Fatal error in main()", {
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : { error: String(error) },
  });
  process.exit(1);
});
