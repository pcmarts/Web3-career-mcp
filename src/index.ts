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

const AVAILABLE_TAGS = [
  "ai", "analyst", "backend", "bitcoin", "blockchain", "community-manager", 
  "crypto", "cryptography", "cto", "customer-support", "dao", "data-science", 
  "defi", "design", "developer-relations", "devops", "discord", "economy-designer", 
  "entry-level", "erc", "erc-20", "evm", "front-end", "full-stack", "gaming", 
  "ganache", "golang", "hardhat", "intern", "java", "javascript", "layer-2", 
  "marketing", "mobile", "moderator", "nft", "node", "non-tech", "open-source", 
  "openzeppelin", "pay-in-crypto", "product-manager", "project-manager", 
  "react", "refi", "research", "ruby", "rust", "sales", "smart-contract", 
  "solana", "solidity", "truffle", "web3-py", "web3js", "zero-knowledge"
];

server.tool(
  "get_available_tags",
  "Get the list of valid tags/skills for filtering jobs",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(AVAILABLE_TAGS, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_web3_jobs",
  "Get the latest web3 jobs from web3.career with optional filters",
  {
    remote: z.boolean().optional().describe("Show only remote jobs"),
    limit: z.number().min(1).max(100).optional().default(20).describe("Number of jobs to return (default 20, max 100)"),
    country: z.string().optional().describe("Filter by country slug (e.g., 'united-states'). Use slugs, not full names."),
    tag: z.string().optional().describe("Filter by a SINGLE specific tag, skill, or category (e.g., 'marketing' for Marketing jobs, 'react' for React jobs). Use 'get_available_tags' to see all options."),
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
      
      if (!Array.isArray(data)) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Unexpected API response format. Response is not an array.",
            },
          ],
          isError: true,
        };
      }

      // The API usually returns [string, string, jobsArray]. 
      // We look for the first array element in the response.
      let jobs = data.find((item: any) => Array.isArray(item));

      // Fallback: checks if the root array itself contains job objects (if API structure changed drastically)
      if (!jobs && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
         jobs = data;
      }

      if (!jobs || !Array.isArray(jobs)) {
         const preview = JSON.stringify(data).substring(0, 500);
         return {
          content: [
            {
              type: "text" as const,
              text: `Error: Unexpected API response format. Could not find jobs array. Response preview: ${preview}`,
            },
          ],
          isError: true,
        };
      }

      // Post-process jobs to reduce response size
      const processedJobs = jobs.map((job: any) => {
        let description = job.description;
        if (description) {
           // Strip HTML tags and collapse whitespace
           description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
           // Truncate to 500 characters
           if (description.length > 500) {
             description = description.substring(0, 500) + "...";
           }
        }
        return { ...job, description };
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(processedJobs, null, 2),
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
