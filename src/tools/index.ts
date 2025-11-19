import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Web3CareerService } from "../services/api.js";
import { AVAILABLE_TAGS } from "../constants.js";
import { logger } from "../utils/logger.js";
import axios from "axios";

export function registerTools(server: McpServer, apiService: Web3CareerService) {
  
  // get_available_tags tool
  server.tool(
    "get_available_tags",
    `Get the list of valid tags/skills for filtering jobs.
    
    This tool is READ-ONLY and IDEMPOTENT - it only retrieves data and can be safely called multiple times.
    It returns a static list of available tags that can be used with the 'get_web3_jobs' tool.
    
    Returns: An array of tag strings (e.g., ["react", "solidity", "marketing", "defi"]).`,
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

  // get_web3_jobs tool
  const getWeb3JobsSchema = {
    remote: z.boolean().optional().describe("Show only remote jobs"),
    limit: z.number().min(1).max(100).optional().default(20).describe("Number of jobs to return (default 20, max 100)"),
    country: z.string().optional().describe("Filter by country slug (e.g., 'united-states'). Use slugs, not full names."),
    tag: z.string().optional().describe("Filter by a SINGLE specific tag, skill, or category (e.g., 'marketing' for Marketing jobs, 'react' for React jobs). Use 'get_available_tags' to see all options."),
    show_description: z.boolean().optional().default(true).describe("Show job description (default true)"),
  };

  // Type-safe interface matching the schema
  interface GetWeb3JobsArgs {
    remote?: boolean;
    limit?: number;
    country?: string;
    tag?: string;
    show_description?: boolean;
  }

  server.tool(
    "get_web3_jobs",
    `Get the latest web3 jobs from web3.career with optional filters.
    
    This tool is READ-ONLY and IDEMPOTENT - it only retrieves data and can be safely called multiple times.
    It interacts with the external web3.career API to fetch job listings.
    
    Examples:
    - Get 10 remote jobs: {"remote": true, "limit": 10}
    - Get Solidity jobs in United States: {"tag": "solidity", "country": "united-states", "limit": 20}
    - Get all marketing jobs: {"tag": "marketing", "limit": 50}
    - Get React jobs without descriptions: {"tag": "react", "show_description": false}
    
    Returns: An array of job objects with fields like title, company, location, description, tags, and url.`,
    getWeb3JobsSchema,
    // @ts-expect-error - MCP SDK type complexity with Zod defaults causes TS2589
    async (args: GetWeb3JobsArgs) => {
      const { remote, limit, country, tag, show_description } = args;
      
      logger.info("get_web3_jobs tool invoked", {
        filters: {
          remote: remote ?? false,
          limit: limit ?? 20,
          country: country ?? null,
          tag: tag ?? null,
          show_description: show_description ?? true,
        },
      });

      try {
        const jobs = await apiService.getJobs({
          remote,
          limit,
          country,
          tag,
          show_description
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobs, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error("Error fetching jobs", {
          error: axios.isAxiosError(error) ? {
            status: error.response?.status,
            message: error.message,
            url: error.config?.url,
          } : {
            message: error instanceof Error ? error.message : String(error),
          },
        });

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const statusText = error.response?.statusText;

          if (status === 401) {
            return {
              content: [{ type: "text", text: `Authentication failed (401 Unauthorized).\n\nThe API token is invalid or missing. Please check:\n1. Ensure WEB3_CAREER_TOKEN environment variable is set\n2. Verify the token is correct\n3. Get a new token from https://web3.career/web3-jobs-api` }],
              isError: true,
            };
          }
          if (status === 403) {
             return {
              content: [{ type: "text", text: `Access forbidden (403 Forbidden).\n\nCheck token permissions.` }],
              isError: true,
            };
          }
          if (status === 429) {
            return {
              content: [{ type: "text", text: `Rate limit exceeded (429 Too Many Requests).\n\nPlease wait before trying again.` }],
              isError: true,
            };
          }
          if (status !== undefined && status >= 500) {
             return {
              content: [{ type: "text", text: `Server error (${status} ${statusText}).\n\nThe web3.career API is experiencing issues.` }],
              isError: true,
            };
          }
          if (status !== undefined && status >= 400) {
            return {
              content: [{ type: "text", text: `Client error (${status} ${statusText}).\n\nCheck your filter parameters.` }],
              isError: true,
            };
          }
          if (!error.response && error.request) {
             return {
              content: [{ type: "text", text: `Network error: Unable to reach the web3.career API.` }],
              isError: true,
            };
          }
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Unexpected error while fetching jobs: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

