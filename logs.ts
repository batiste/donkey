
export const logger = {
  log: (msg: string, extras?: object) => {
    console.log({ msg: msg, ...extras })
  },
  error: (msg: string | Error, extras?: object) => {
    console.error({ msg: msg, ...extras })
  },
  warn: (msg: string, extras?: object) => {
    console.warn({ msg: msg, ...extras })
  }
}