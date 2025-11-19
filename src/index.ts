import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

const server = new McpServer({
  name: "web3-career-mcp",
  version: "1.0.0",
});

const WEB3_CAREER_API_TOKEN = process.env.WEB3_CAREER_TOKEN || "99utwADPU3UL4NWtSDk2LPBHnQ7BaAeW";
const BASE_URL = "https://web3.career/api/v1";

server.tool(
  "get_web3_jobs",
  "Get the latest web3 jobs from web3.career with optional filters",
  {
    remote: z.boolean().optional().describe("Show only remote jobs"),
    limit: z.number().min(1).max(100).optional().default(50).describe("Number of jobs to return (default 50, max 100)"),
    country: z.string().optional().describe("Filter by country slug (e.g., 'united-states')"),
    tag: z.string().optional().describe("Filter by tag/skill (e.g., 'react')"),
    show_description: z.boolean().optional().default(true).describe("Show job description (default true)"),
  } as any,
  async (args: any) => {
    const { remote, limit, country, tag, show_description } = args;
    try {
      const params: Record<string, string | number | boolean> = {
        token: WEB3_CAREER_API_TOKEN,
      };

      if (remote) params.remote = "true";
      if (limit) params.limit = limit;
      if (country) params.country = country;
      if (tag) params.tag = tag;
      if (show_description === false) params.show_description = "false";

      const response = await axios.get(BASE_URL, { params });
      
      const data = response.data;
      
      if (!Array.isArray(data) || data.length < 3) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Unexpected API response format. Expected an array with at least 3 elements.",
            },
          ],
          isError: true,
        };
      }

      const jobs = data[2];

      if (!Array.isArray(jobs)) {
         return {
          content: [
            {
              type: "text" as const,
              text: "Error: Unexpected API response format. Index 2 is not an array of jobs.",
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(jobs, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching jobs: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Web3 Career MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
