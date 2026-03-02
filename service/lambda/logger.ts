export interface LogEntry {
  event: string;
  [key: string]: unknown;
}

const write = (level: "info" | "warn" | "error", entry: LogEntry) =>
  console[level](JSON.stringify({ level, ...entry }));

export const logger = {
  info:  (entry: LogEntry) => write("info",  entry),
  warn:  (entry: LogEntry) => write("warn",  entry),
  error: (entry: LogEntry) => write("error", entry),
};
