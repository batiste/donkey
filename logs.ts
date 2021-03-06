export const logger = {
  log: (msg: string, extras?: object) => {
    console.log({ msg, ...extras });
  },
  error: (msg: string | Error, extras?: object) => {
    console.error({ msg, ...extras });
  },
  warn: (msg: string, extras?: object) => {
    console.warn({ msg, ...extras });
  },
};

export function onShutdown(shutdown: () => void) {
  process.on("SIGHUP", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
