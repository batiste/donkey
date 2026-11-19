/**
 * Minimal structured logger: one JSON object per line.
 *
 * The level is read from the LOG_LEVEL environment variable:
 * debug, info (default), warn, error or silent.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
type Level = Exclude<keyof typeof LEVELS, "silent">;

function currentLevel(): number {
  const level = (process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[level as keyof typeof LEVELS] ?? LEVELS.info;
}

/** JSON.stringify drops Error properties, serialise them explicitly */
function replacer(_key: string, value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: (value as { code?: unknown }).code,
      stack: value.stack,
    };
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function write(level: Level, msg: string | Error, extras?: object) {
  if (LEVELS[level] < currentLevel()) {
    return;
  }
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: msg instanceof Error ? msg.message : msg,
    ...(msg instanceof Error ? { error: msg } : {}),
    ...extras,
  };
  let line: string;
  try {
    line = JSON.stringify(entry, replacer);
  } catch {
    line = JSON.stringify({ time: entry.time, level, msg: entry.msg });
  }
  if (LEVELS[level] >= LEVELS.warn) {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug: (msg: string, extras?: object) => write("debug", msg, extras),
  log: (msg: string, extras?: object) => write("info", msg, extras),
  info: (msg: string, extras?: object) => write("info", msg, extras),
  warn: (msg: string, extras?: object) => write("warn", msg, extras),
  error: (msg: string | Error, extras?: object) => write("error", msg, extras),
};

export function onShutdown(shutdown: () => void) {
  process.on("SIGHUP", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
