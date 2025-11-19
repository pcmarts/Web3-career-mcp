import { LogEntry, LogLevel } from "../types/index.js";

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

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
  debug: (message: string, data?: Record<string, unknown>) => log("debug", message, data),
};

