import axios, { AxiosResponse } from "axios";
import { logger } from "../utils/logger.js";
import { SimpleCache } from "./cache.js";
import { Web3Job, JobFilters } from "../types/index.js";

const BASE_URL = "https://web3.career/api/v1";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class Web3CareerService {
  private token: string;
  private cache: SimpleCache<Web3Job[]>;

  constructor(token: string) {
    this.token = token;
    this.cache = new SimpleCache<Web3Job[]>(CACHE_TTL_MS);
  }

  private isRetryableError(error: unknown): boolean {
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

  private async fetchWithRetry<T>(
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

        if (attempt === maxRetries || !this.isRetryableError(error)) {
          throw error;
        }

        const baseDelay = Math.min(
          INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt),
          MAX_RETRY_DELAY_MS
        );
        const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
        const delay = Math.floor(baseDelay + jitter);

        logger.warn("API request failed, retrying", {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delayMs: delay,
          error: axios.isAxiosError(error) ? {
            status: error.response?.status,
            message: error.message,
          } : { message: String(error) },
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async getJobs(filters: JobFilters): Promise<Web3Job[]> {
    const cacheKey = JSON.stringify(filters);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      logger.debug("Returning cached jobs", { count: cached.length });
      return cached;
    }

    const params: Record<string, string | number | boolean> = {
      token: this.token,
    };

    if (filters.remote) params.remote = "true";
    if (filters.limit) params.limit = filters.limit;
    if (filters.country) params.country = filters.country;
    if (filters.tag) params.tag = filters.tag;
    if (filters.show_description === false) params.show_description = "false";

    const response = await this.fetchWithRetry<any>(BASE_URL, params);
    const data = response.data;

    if (!Array.isArray(data)) {
      throw new Error("Unexpected API response format. Response is not an array.");
    }

    // The API usually returns [string, string, jobsArray]. 
    let jobs: unknown = data.find((item: unknown) => Array.isArray(item));

    // Fallback logic
    if (!jobs && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
       jobs = data;
    }

    if (!jobs || !Array.isArray(jobs)) {
       throw new Error(`Unexpected API response format. Could not find jobs array.`);
    }

    const processedJobs: Web3Job[] = jobs.map((job: unknown) => {
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

      let description: string | undefined;
      if (typeof jobObj.description === 'string') {
        description = jobObj.description
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (description.length > 500) {
          description = description.substring(0, 500) + "...";
        }
      }
      processed.description = description;

      Object.keys(jobObj).forEach((key) => {
        if (!(key in processed)) {
          processed[key] = jobObj[key];
        }
      });

      return processed;
    });

    this.cache.set(cacheKey, processedJobs);
    logger.info("Jobs fetched and cached", { count: processedJobs.length });
    
    return processedJobs;
  }
}

