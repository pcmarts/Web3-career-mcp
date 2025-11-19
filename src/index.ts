import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios, { AxiosError, AxiosResponse } from "axios";

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
const BASE_URL = "https://web3.career/api/v1";

// Structured logging utility
// MCP servers should log to stderr (console.error) to avoid interfering with JSON-RPC communication
type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  data?: Record<string, unknown>;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "web3-career-mcp",
    ...(data && { data }),
  };
  
  // Output as JSON to stderr for structured logging
  console.error(JSON.stringify(logEntry));
}

// Convenience functions
const logger = {
  info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
  debug: (message: string, data?: Record<string, unknown>) => log("debug", message, data),
};

// Data models - normalized interfaces for API responses
interface Web3Job {
  id?: string;
  title?: string;
  company?: string;
  location?: string;
  remote?: boolean;
  description?: string;
  tags?: string[];
  url?: string;
  salary?: string;
  postedAt?: string;
  [key: string]: unknown; // Allow additional fields from API
}

interface Web3CareerApiResponse {
  data: unknown; // The API response structure may vary
}

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 10000; // 10 seconds

/**
 * Determines if an error is retryable (should trigger a retry)
 */
function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    // Retry on rate limits (429) and server errors (5xx)
    if (status === 429 || (status !== undefined && status >= 500)) {
      return true;
    }
    // Retry on network errors (no response)
    if (!error.response && error.request) {
      return true;
    }
  }
  return false;
}

/**
 * Fetches data from the API with retry logic and exponential backoff
 */
async function fetchWithRetry<T>(
  url: string,
  params: Record<string, string | number | boolean>,
  maxRetries: number = MAX_RETRIES
): Promise<AxiosResponse<T>> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get<T>(url, { params });
      return response;
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Calculate exponential backoff delay with jitter
      const baseDelay = Math.min(
        INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt),
        MAX_RETRY_DELAY_MS
      );
      // Add jitter (±20%) to prevent thundering herd
      const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.floor(baseDelay + jitter);

      // Log retry attempt with structured logging
      logger.warn("API request failed, retrying", {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delayMs: delay,
        error: axios.isAxiosError(error) ? {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
        } : { message: error instanceof Error ? error.message : String(error) },
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

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

// Define schema with proper Zod types for validation
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

// Note: TypeScript has issues with deeply nested Zod types (especially with .default())
// when used with MCP SDK. The schema is still properly validated at runtime by Zod.
// We use a type assertion here to work around the type system limitation while
// maintaining type safety for the callback arguments.
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
    
    // Log tool invocation
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
      const params: Record<string, string | number | boolean> = {
        token: WEB3_CAREER_API_TOKEN,
      };

      if (remote) params.remote = "true";
      if (limit) params.limit = limit;
      if (country) params.country = country;
      if (tag) params.tag = tag;
      if (show_description === false) params.show_description = "false";

      const response = await fetchWithRetry(BASE_URL, params);
      
      logger.debug("API request successful", {
        status: response.status,
        dataSize: Array.isArray(response.data) ? response.data.length : "unknown",
      });
      
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
      let jobs: unknown = data.find((item: unknown) => Array.isArray(item));

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

      // Post-process jobs to reduce response size with type safety
      const processedJobs: Web3Job[] = jobs.map((job: unknown) => {
        // Type guard to ensure job is an object
        if (typeof job !== 'object' || job === null) {
          return {} as Web3Job;
        }

        const jobObj = job as Record<string, unknown>;
        const processed: Web3Job = {
          id: typeof jobObj.id === 'string' ? jobObj.id : undefined,
          title: typeof jobObj.title === 'string' ? jobObj.title : undefined,
          company: typeof jobObj.company === 'string' ? jobObj.company : undefined,
          location: typeof jobObj.location === 'string' ? jobObj.location : undefined,
          remote: typeof jobObj.remote === 'boolean' ? jobObj.remote : undefined,
          url: typeof jobObj.url === 'string' ? jobObj.url : undefined,
          salary: typeof jobObj.salary === 'string' ? jobObj.salary : undefined,
          postedAt: typeof jobObj.postedAt === 'string' ? jobObj.postedAt : undefined,
          tags: Array.isArray(jobObj.tags) ? jobObj.tags.filter((t): t is string => typeof t === 'string') : undefined,
        };

        // Process description with HTML stripping and truncation
        let description: string | undefined;
        if (typeof jobObj.description === 'string') {
          description = jobObj.description
            .replace(/<[^>]+>/g, ' ') // Strip HTML tags
            .replace(/\s+/g, ' ') // Collapse whitespace
            .trim();
          
          // Truncate to 500 characters
          if (description.length > 500) {
            description = description.substring(0, 500) + "...";
          }
        }
        processed.description = description;

        // Preserve other fields that might be useful
        Object.keys(jobObj).forEach((key) => {
          if (!(key in processed)) {
            processed[key] = jobObj[key];
          }
        });

        return processed;
      });

      logger.info("Jobs processed successfully", {
        jobCount: processedJobs.length,
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
      // Log error with context
      logger.error("Error fetching jobs", {
        error: axios.isAxiosError(error) ? {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          url: error.config?.url,
        } : {
          message: error instanceof Error ? error.message : String(error),
        },
      });

      // Provide user-friendly error messages with actionable guidance
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;

        if (status === 401) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Authentication failed (401 Unauthorized).

The API token is invalid or missing. Please check:
1. Ensure WEB3_CAREER_TOKEN environment variable is set in your MCP server configuration
2. Verify the token is correct and hasn't expired
3. Get a new token from https://web3.career/web3-jobs-api if needed

Error details: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        if (status === 403) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Access forbidden (403 Forbidden).

Your API token doesn't have permission to access this resource. Please:
1. Check if your token has the required permissions
2. Contact web3.career support if you believe this is an error
3. Verify your token hasn't been revoked

Error details: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        if (status === 429) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Rate limit exceeded (429 Too Many Requests).

The API rate limit has been reached. The request was automatically retried but still failed.
Please wait a few moments before trying again.

Error details: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        if (status !== undefined && status >= 500) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Server error (${status} ${statusText || "Internal Server Error"}).

The web3.career API is experiencing issues. The request was automatically retried but still failed.
Please try again in a few moments. If the problem persists, the API may be temporarily unavailable.

Error details: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        if (status !== undefined && status >= 400) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Client error (${status} ${statusText || "Bad Request"}).

The request was invalid. Please check:
1. Verify filter parameters are correct (e.g., country slugs, tag names)
2. Use 'get_available_tags' to see valid tag options
3. Ensure limit is between 1 and 100

Error details: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        // Network errors (no response received)
        if (!error.response && error.request) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Network error: Unable to reach the web3.career API.

The request was automatically retried but failed to connect. Please check:
1. Your internet connection
2. Whether the web3.career API is accessible
3. Try again in a few moments

Error details: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }

      // Fallback for non-Axios errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Unexpected error while fetching jobs: ${errorMessage}

If this problem persists, please check:
1. Your MCP server configuration
2. The web3.career API status
3. Review the error details above for more information`,
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
