import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LOG_FILE = fileURLToPath(
  new URL("../../logs/sync-mono.log", import.meta.url),
);

type SyncLoggerOptions = {
  source: "cli" | "ui";
  accountId: number;
  toStdout?: boolean;
};

export type SyncLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

let logDirReady = false;

function ensureLogDir() {
  if (logDirReady) return;
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    logDirReady = true;
  } catch (err) {
    process.stderr.write(
      `(sync log dir failed: ${
        err instanceof Error ? err.message : String(err)
      })\n`,
    );
  }
}

export function createSyncLogger(options: SyncLoggerOptions): SyncLogger {
  ensureLogDir();
  const prefix = `pid=${process.pid} source=${options.source} accountId=${options.accountId}`;

  function emit(level: "info" | "error", message: string) {
    const line = `[${new Date().toISOString()}] [${level}] [${prefix}] ${message}\n`;
    try {
      appendFileSync(LOG_FILE, line);
    } catch (err) {
      process.stderr.write(
        `(sync log write failed: ${
          err instanceof Error ? err.message : String(err)
        })\n`,
      );
    }
    if (options.toStdout ?? options.source === "ui") {
      const stream = level === "error" ? process.stderr : process.stdout;
      stream.write(line);
    }
  }

  return {
    info: (message) => emit("info", message),
    error: (message) => emit("error", message),
  };
}
