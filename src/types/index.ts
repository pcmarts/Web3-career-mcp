export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  data?: Record<string, unknown>;
}

export interface Web3Job {
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
  [key: string]: unknown;
}

export interface Web3CareerApiResponse {
  data: unknown;
}

export interface JobFilters {
  remote?: boolean;
  limit?: number;
  country?: string;
  tag?: string;
  show_description?: boolean;
}

